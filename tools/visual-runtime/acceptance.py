"""Run reviewed repository media through the real runtime; never approve quality."""
import argparse
import base64
import hashlib
import hmac
import io
import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from benchmark import NoRedirects, http_failure
from contracts import MODEL_ID, MODEL_VERSION, TIMEOUT_MS, TOKEN, strict_json, validate_output

LOCALES = ('en', 'es', 'fr', 'ar', 'pt', 'zh', 'hi', 'de', 'ja', 'tr')


def bounded_file(path, maximum):
    if not path.is_file():
        raise ValueError('regular-file-required')
    with path.open('rb') as handle:
        raw = handle.read(maximum + 1)
    if len(raw) > maximum:
        raise ValueError('file-too-large')
    return raw


def load_pack(path, media_root):
    """Preflight every case before making any paid inference request."""
    from PIL import Image
    raw = bounded_file(Path(path), 65536)
    pack = strict_json(raw)
    if (not isinstance(pack, dict) or set(pack) != {'schemaVersion', 'scope', 'assets', 'cases'}
        or type(pack['schemaVersion']) is not int or pack['schemaVersion'] != 1
        or pack['scope'] != 'repository-controlled-fixtures'
        or not isinstance(pack['assets'], dict) or not 1 <= len(pack['assets']) <= 10
        or not isinstance(pack['cases'], list) or not 1 <= len(pack['cases']) <= 40):
        raise ValueError('invalid-acceptance-pack')
    root = Path(media_root).resolve(strict=True)
    allowed = (root / 'images/controlled-test').resolve(strict=True)
    if not allowed.is_relative_to(root):
        raise ValueError('fixture-directory-outside-root')
    assets = {}
    for asset_id, asset in pack['assets'].items():
        if (not isinstance(asset_id, str) or not TOKEN.fullmatch(asset_id)
            or not isinstance(asset, dict) or set(asset) != {'path', 'sha256'}
            or not isinstance(asset['path'], str) or not asset['path'].startswith('images/controlled-test/')
            or not isinstance(asset['sha256'], str) or len(asset['sha256']) != 64):
            raise ValueError('invalid-fixture-asset')
        path = (root / asset['path']).resolve(strict=True)
        if not path.is_relative_to(allowed):
            raise ValueError('fixture-outside-controlled-directory')
        blob = bounded_file(path, 4 * 1024 * 1024)
        if hashlib.sha256(blob).hexdigest() != asset['sha256']:
            raise ValueError('fixture-integrity-failed')
        with Image.open(io.BytesIO(blob)) as image:
            if (image.format not in ('PNG', 'JPEG', 'WEBP') or getattr(image, 'n_frames', 1) != 1
                or not 1 <= image.width <= 1600 or not 1 <= image.height <= 1600):
                raise ValueError('invalid-fixture-image')
            descriptor = dict(assetId=asset_id, contentHash=asset['sha256'], sizeBytes=len(blob),
                              width=image.width, height=image.height,
                              contentType={'PNG': 'image/png', 'JPEG': 'image/jpeg', 'WEBP': 'image/webp'}[image.format])
            image.verify()
        assets[asset_id] = (descriptor, base64.b64encode(blob).decode())
    seen = set()
    for case in pack['cases']:
        if (not isinstance(case, dict) or set(case) != {'id', 'locale', 'asset', 'text', 'reviewFocus'}
            or not isinstance(case['id'], str) or not TOKEN.fullmatch(case['id']) or case['id'] in seen
            or case['locale'] not in LOCALES or not isinstance(case['asset'], str) or case['asset'] not in assets
            or not isinstance(case['text'], str) or not 1 <= len(case['text']) <= 2000
            or not isinstance(case['reviewFocus'], list) or not 1 <= len(case['reviewFocus']) <= 8
            or any(not isinstance(item, str) or not 1 <= len(item) <= 400 for item in case['reviewFocus'])):
            raise ValueError('invalid-acceptance-case')
        seen.add(case['id'])
    return pack, assets, hashlib.sha256(raw).hexdigest()


def run_case(case, asset, origin, secret, weights_hash, code_hash, opener):
    descriptor, encoded = asset
    request_input = dict(schemaVersion=2, inputSchema='demeos-visual-input-v2', capability='image-semantics',
                         businessId='test-business-acceptance', productId=case['id'],
                         productRevision=hashlib.sha256(case['text'].encode()).hexdigest(),
                         mediaRevision=descriptor['contentHash'], media=[descriptor], text=case['text'])
    request_hash = hashlib.sha256(json.dumps(request_input, sort_keys=True).encode()).hexdigest()
    now, job_id = int(time.time() * 1000), str(uuid.uuid4())
    payload = json.dumps(dict(protocolVersion=1, jobId=job_id, issuedAt=now, deadline=now + TIMEOUT_MS,
                             modelId=MODEL_ID, modelVersion=MODEL_VERSION, weightsManifestHash=weights_hash,
                             runtimeCodeHash=code_hash, inputHash=request_hash, input=request_input,
                             media=[encoded])).encode()
    result = dict(caseId=case['id'], locale=case['locale'], assetHash=descriptor['contentHash'],
                  reviewFocus=case['reviewFocus'], humanReview='pending')
    started = time.perf_counter()
    try:
        request = urllib.request.Request(origin.rstrip('/') + '/v1/infer', payload, {
            'Content-Type': 'application/json', 'Authorization': 'Bearer ' + secret.decode(),
            'X-DEMEOS-Signature': hmac.new(secret, payload, hashlib.sha256).hexdigest()})
        with opener.open(request, timeout=3) as response:
            raw = response.read(36865)
        if len(raw) > 36864:
            raise ValueError('oversized-runtime-response')
        body = strict_json(raw)
        if (not isinstance(body, dict) or set(body) != {'protocolVersion', 'jobId', 'inputHash', 'modelVersion',
                'weightsManifestHash', 'runtimeCodeHash', 'output', 'measurements'}
            or type(body['protocolVersion']) is not int or body['protocolVersion'] != 1
            or body['jobId'] != job_id or body['inputHash'] != request_hash
            or body['modelVersion'] != MODEL_VERSION or body['weightsManifestHash'] != weights_hash
            or body['runtimeCodeHash'] != code_hash):
            raise ValueError('runtime-provenance-mismatch')
        measurements = body['measurements']
        if (not isinstance(measurements, dict) or set(measurements) != {'durationMs', 'peakVramBytes'}
            or type(measurements['durationMs']) not in (int, float)
            or not math.isfinite(measurements['durationMs']) or not 0 <= measurements['durationMs'] <= TIMEOUT_MS
            or type(measurements['peakVramBytes']) is not int or not 0 <= measurements['peakVramBytes'] <= 64 * 1024**3):
            raise ValueError('invalid-runtime-measurements')
        output = validate_output(body['output'], [descriptor])
        elapsed = (time.perf_counter() - started) * 1000
        result.update(passed=elapsed <= TIMEOUT_MS, endToEndMs=elapsed, measurements=measurements, output=output)
    except Exception as error:
        result.update(passed=False, endToEndMs=(time.perf_counter() - started) * 1000,
                      errorType=type(error).__name__)
        if isinstance(error, urllib.error.HTTPError):
            result.update(http_failure(error))
    return result


def main():
    parser = argparse.ArgumentParser()
    for field in ('pack', 'media-root'):
        parser.add_argument('--' + field, required=True)
    for field in ('origin', 'secret-file', 'weights-manifest', 'runtime-code-hash', 'output'):
        parser.add_argument('--' + field)
    parser.add_argument('--validate-only', action='store_true')
    parser.add_argument('--local-hardware-only', action='store_true')
    args = parser.parse_args()
    pack, assets, pack_hash = load_pack(args.pack, args.media_root)
    if args.validate_only:
        print(json.dumps(dict(packHash=pack_hash, caseCount=len(pack['cases']),
                              locales=sorted({case['locale'] for case in pack['cases']}),
                              gpuRequests=0, qualityReview='pending', activationApproved=False)))
        return
    if any(getattr(args, field) is None for field in ('origin', 'secret_file', 'weights_manifest', 'runtime_code_hash', 'output')):
        parser.error('Live evaluation requires origin, secret file, weights manifest, runtime code hash and new output path.')
    url = urllib.parse.urlsplit(args.origin)
    local = args.local_hardware_only and url.scheme == 'http' and url.hostname == '127.0.0.1'
    if ((not local and url.scheme != 'https') or not url.hostname or url.username or url.password
        or url.query or url.fragment or url.path not in ('', '/')):
        raise ValueError('private-https-or-explicit-loopback-required')
    if len(args.runtime_code_hash) != 64 or any(c not in '0123456789abcdef' for c in args.runtime_code_hash):
        raise ValueError('invalid-runtime-code-hash')
    secret = bounded_file(Path(args.secret_file), 257).strip()
    if not 32 <= len(secret) <= 256 or any(c <= 32 or c > 126 for c in secret):
        raise ValueError('invalid-runtime-secret')
    weights_hash = hashlib.sha256(bounded_file(Path(args.weights_manifest), 32768)).hexdigest()
    # Reserve the report before spending, and never overwrite existing evidence.
    with Path(args.output).open('x') as handle:
        report = dict(schemaVersion=1, scope=pack['scope'], packHash=pack_hash,
                      modelId=MODEL_ID, modelVersion=MODEL_VERSION, weightsManifestHash=weights_hash,
                      runtimeCodeHash=args.runtime_code_hash,
                      route='loopback-hardware-only' if local else 'https-client-to-runtime', timeoutMs=TIMEOUT_MS,
                      plannedCaseCount=len(pack['cases']), results=[], executionPassed=False,
                      productAccuracyVerified=False, multilingualAccuracyVerified=False,
                      categoryAccuracyVerified=False, activationApproved=False)
        def checkpoint():
            handle.seek(0); handle.truncate()
            json.dump(report, handle, indent=2, ensure_ascii=False); handle.write('\n'); handle.flush()
        checkpoint()
        opener = urllib.request.build_opener(NoRedirects())
        for case in pack['cases']:
            result = run_case(case, assets[case['asset']], args.origin, secret, weights_hash,
                              args.runtime_code_hash, opener)
            report['results'].append(result)
            checkpoint()
            print(case['id'] + ': ' + ('passed; quality review pending' if result['passed'] else 'failed'), flush=True)
            if not result['passed']:
                break
        report['executionPassed'] = len(report['results']) == len(pack['cases']) and all(r['passed'] for r in report['results'])
        checkpoint()


if __name__ == '__main__':
    main()
