"""Declared provider fixtures, never real capacity, spending or GPU measurements."""
import contextlib
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from capacity_guard import INSTANCE_ID, lease, main


class FixtureProvider:
    def __init__(self, response=None):
        self.response = response if response is not None else {'success': True}
        self.calls = []
        self.current = dict(id=INSTANCE_ID, actual_status='exited', intended_status='stopped', dph_total=.55)
        self.fail_stop = False

    def call(self, state=None):
        self.calls.append(state)
        if state == 'running':
            if isinstance(self.response, Exception): raise self.response
            self.current['intended_status'] = 'running'
            if self.response.get('success') is True: self.current['actual_status'] = 'running'
            return self.response
        if state == 'stopped':
            if self.fail_stop: raise OSError('private provider error')
            self.current.update(actual_status='exited', intended_status='stopped')
            return {'success': True}
        return dict(self.current)


class CapacityTests(unittest.TestCase):
    def run_lease(self, provider, **kwargs):
        now = [0]
        events = []
        def advance(seconds): now[0] += seconds
        lease(provider, 10, '.55', '10', '1', events.append,
              clock=lambda: now[0], wait=kwargs.get('wait', advance))
        return events

    def test_unavailable_queued_start_is_cancelled_without_bridge_permission(self):
        provider = FixtureProvider({'success': False, 'error': 'resources_unavailable', 'msg': 'private detail'})
        events = self.run_lease(provider)
        self.assertEqual(provider.calls, [None, 'running', 'stopped', None])
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]['reason'], 'resources_unavailable')
        self.assertTrue(events[0]['confirmedStopped'])
        self.assertFalse(events[0]['cpuBridgeAllowed'])
        self.assertNotIn('private', str(events))

    def test_lease_expires_and_operator_interrupt_always_stop_existing_instance(self):
        for interrupt in [False, True]:
            with self.subTest(interrupt=interrupt):
                provider = FixtureProvider()
                def stop(_): raise KeyboardInterrupt
                events = self.run_lease(provider, **({'wait': stop} if interrupt else {}))
                self.assertEqual(events[0]['event'], 'provider-running')
                self.assertFalse(events[0]['gpuInferenceVerified'])
                self.assertTrue(events[-1]['confirmedStopped'])
                self.assertFalse(events[-1]['cpuStopVerified'])
                self.assertEqual(provider.calls[-2:], ['stopped', None])

    def test_failed_or_unconfirmed_stop_never_claims_billing_stopped(self):
        provider = FixtureProvider(OSError('private network error'))
        provider.fail_stop = True
        events = self.run_lease(provider)
        self.assertFalse(events[-1]['confirmedStopped'])
        self.assertFalse(events[-1]['cpuBridgeAllowed'])
        self.assertNotIn('private', str(events))

    def test_invalid_price_budget_or_existing_state_cannot_start(self):
        for change in [dict(dph_total=.56), dict(dph_total=float('nan')),
                       dict(id=1), dict(actual_status='running')]:
            provider = FixtureProvider(); provider.current.update(change)
            with self.assertRaises(ValueError): self.run_lease(provider)
            self.assertNotIn('running', provider.calls)
        provider = FixtureProvider()
        with self.assertRaises(ValueError):
            lease(provider, 720, '.55', '34', '1', lambda _: None)
        self.assertNotIn('running', provider.calls)

    def test_cli_is_read_only_by_default_and_rejected_start_has_nonzero_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            key = Path(directory) / 'key'
            key.write_text('declared-fixture-key-not-a-provider-credential')
            key.chmod(0o600)
            provider = FixtureProvider({'success': False, 'error': 'resources_unavailable'})
            output = io.StringIO()
            arguments = ['capacity_guard.py', '--api-key-file', str(key)]
            with patch('capacity_guard.VastClient', return_value=provider), \
                 patch('sys.argv', arguments), contextlib.redirect_stdout(output):
                main()
            self.assertEqual(provider.calls, [None])
            with patch('capacity_guard.VastClient', return_value=provider), \
                 patch('sys.argv', arguments + ['--start', '--spent-usd', '10']), \
                 contextlib.redirect_stdout(output), self.assertRaises(SystemExit) as caught:
                main()
            self.assertEqual(caught.exception.code, 1)
            self.assertNotIn(key.read_text(), output.getvalue())

    def test_slow_provider_read_cannot_authorise_a_bridge_after_deadline(self):
        now = [0]
        provider = FixtureProvider()
        original = provider.call
        def slow(state=None):
            value = original(state)
            if state is None and value['actual_status'] == 'running': now[0] += 11
            return value
        provider.call = slow
        events = []
        lease(provider, 10, '.55', '10', '1', events.append, clock=lambda: now[0], wait=lambda _: None)
        self.assertFalse(any(e.get('cpuBridgeAllowed') for e in events))
        self.assertTrue(events[-1]['confirmedStopped'])


if __name__ == '__main__': unittest.main()
