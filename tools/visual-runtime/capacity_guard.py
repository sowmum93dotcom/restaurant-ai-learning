"""Bound an explicitly authorised lease of the existing evaluation GPU.

Read-only by default. Never creates, recreates, migrates or deletes resources.
This operator process must stay outside the model worker and its environment.
"""
import argparse
import json
import math
import signal
import stat
import time
import urllib.request
from decimal import Decimal, InvalidOperation
from pathlib import Path

INSTANCE_ID = 56929706
TOTAL_CAP = Decimal('35')
BRIDGE_HOURLY = Decimal('0.30')
MAX_LEASE_SECONDS = 720


class LeaseRejected(Exception):
    pass


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_):
        return None


class VastClient:
    def __init__(self, key):
        self.key = key
        self.opener = urllib.request.build_opener(NoRedirects())

    def call(self, state=None):
        url = f'https://console.vast.ai/api/v0/instances/{INSTANCE_ID}/'
        data = None if state is None else json.dumps({'state': state}).encode()
        if state is None:
            url += '?owner=me'
        if state not in (None, 'running', 'stopped'):
            raise ValueError('unsupported-state')
        request = urllib.request.Request(url, data=data, method='GET' if state is None else 'PUT',
                                        headers={'Authorization': 'Bearer ' + self.key,
                                                 'Content-Type': 'application/json'})
        with self.opener.open(request, timeout=10) as response:
            raw = response.read(65537)
        if len(raw) > 65536:
            raise ValueError('provider-response-too-large')
        value = json.loads(raw)
        return value['instances'] if state is None else value


def stopped(client):
    """Read back cancellation, rather than trust a successful PUT alone."""
    try:
        reply = client.call('stopped')
        current = client.call()
        return (isinstance(reply, dict) and reply.get('success') is True
                and current.get('id') == INSTANCE_ID
                and current.get('intended_status') == 'stopped'
                and current.get('actual_status') == 'exited')
    except Exception:
        return False


def rate(value):
    if isinstance(value, bool):
        raise ValueError('invalid-price')
    try:
        result = Decimal(str(value))
    except InvalidOperation:
        raise ValueError('invalid-price') from None
    if not result.is_finite() or result < 0:
        raise ValueError('invalid-price')
    return result


def lease(client, seconds, maximum_hourly, spent_usd, reserve_usd, emit,
          clock=time.monotonic, wait=time.sleep):
    """A provider running state permits a bridge, but never proves CUDA/inference."""
    if type(seconds) is not int or not 1 <= seconds <= MAX_LEASE_SECONDS:
        raise ValueError('invalid-lease-duration')
    maximum_hourly, spent_usd, reserve_usd = map(rate, (maximum_hourly, spent_usd, reserve_usd))
    if maximum_hourly > Decimal('0.55') or reserve_usd < Decimal('1'):
        raise ValueError('invalid-evaluation-bound')
    current = client.call()
    if current.get('id') != INSTANCE_ID:
        raise ValueError('wrong-instance')
    if current.get('actual_status') != 'exited' or current.get('intended_status') != 'stopped':
        raise ValueError('existing-instance-not-stopped')
    hourly = rate(current.get('dph_total'))
    if hourly > maximum_hourly or hourly + BRIDGE_HOURLY > Decimal('0.85'):
        raise ValueError('price-exceeds-approved-limit')
    estimate = (hourly + BRIDGE_HOURLY) * seconds / Decimal(3600)
    if spent_usd + reserve_usd + estimate > TOTAL_CAP:
        raise ValueError('evaluation-cap-exceeded')
    end = clock() + seconds
    reason = 'provider-connection-failed'
    try:
        reply = client.call('running')
        # In particular, success=false/resources_unavailable is NOT a start.
        # It may queue a future restart, so the finally guard must cancel it.
        if not isinstance(reply, dict) or reply.get('success') is not True:
            reason = ('resources_unavailable' if isinstance(reply, dict)
                      and reply.get('error') == 'resources_unavailable' else 'provider-start-rejected')
            raise LeaseRejected
        startup_end = min(end, clock() + 60)
        while clock() < startup_end:
            current = client.call()
            if current.get('id') != INSTANCE_ID:
                raise ValueError('wrong-instance')
            if current.get('actual_status') == 'running' and current.get('intended_status') == 'running':
                if clock() >= end:
                    reason = 'provider-start-timeout'
                    raise LeaseRejected
                emit({'event': 'provider-running', 'instanceId': INSTANCE_ID,
                      'cpuBridgeAllowed': True, 'gpuInferenceVerified': False,
                      'remainingSeconds': max(0, math.floor(end - clock()))})
                break
            wait(min(1, max(0, startup_end - clock())))
        else:
            reason = 'provider-start-timeout'
            raise LeaseRejected
        reason = 'lease-ended'
        while clock() < end:
            wait(min(20, max(0, end - clock())))
    except LeaseRejected:
        pass
    except (KeyboardInterrupt, SystemExit):
        reason = 'operator-stopped'
    except Exception:
        pass  # Never emit provider response text, request headers or secrets.
    finally:
        confirmed = stopped(client)
        report = {'event': 'lease-closed', 'instanceId': INSTANCE_ID, 'reason': reason,
                  'cpuBridgeAllowed': False, 'confirmedStopped': confirmed,
                  'cpuStopVerified': False}
        emit(report)
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--api-key-file', required=True)
    parser.add_argument('--start', action='store_true')
    parser.add_argument('--max-seconds', type=int, default=600)
    parser.add_argument('--max-hourly', default='0.55')
    parser.add_argument('--spent-usd', help='Operator-verified total evaluation usage across providers; required to start.')
    parser.add_argument('--reserve-usd', default='1', help='Reserve for delayed/retained/transfer charges; at least $1.')
    args = parser.parse_args()
    key_path = Path(args.api_key_file)
    if not key_path.is_file() or stat.S_IMODE(key_path.stat().st_mode) & 0o077:
        raise ValueError('key-file-must-be-private')
    key = key_path.read_text().strip()
    if not key or any(char.isspace() for char in key):
        raise ValueError('invalid-key-file')
    client = VastClient(key)
    emit = lambda value: print(json.dumps(value, separators=(',', ':')), flush=True)
    if not args.start:
        current = client.call()
        if current.get('id') != INSTANCE_ID:
            raise ValueError('wrong-instance')
        emit({k: current.get(k) for k in ['id', 'actual_status', 'intended_status', 'dph_total']})
        return
    if args.spent_usd is None:
        raise ValueError('verified-spending-required')
    def interrupt(*_):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupt)
    report = lease(client, args.max_seconds, args.max_hourly, args.spent_usd, args.reserve_usd, emit)
    if report['reason'] != 'lease-ended' or not report['confirmedStopped']:
        raise SystemExit(1)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'event': 'operator-check-failed', 'cpuBridgeAllowed': False}), flush=True)
        raise SystemExit(1)
