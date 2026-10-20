"""Measure a running DEMEOS private service with synthetic media; never auto-enable."""
import argparse
import base64
import hashlib
import hmac
import io
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from contracts import MODEL_ID, MODEL_VERSION, strict_json, validate_output


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_):
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--origin', required=True)
    parser.add_argument('--secret-file', required=True)
    parser.add_argument('--weights-manifest', required=True)
    parser.add_argument('--runtime-code-hash', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--local-hardware-only', action='store_true')
    args = parser.parse_args()
    url = urllib.parse.urlsplit(args.origin)
    local = args.local_hardware_only and url.scheme == 'http' and url.hostname == '127.0.0.1'
    if (not local and url.scheme != 'https') or url.username or url.password or url.query or url.fragment or url.path not in ['', '/']:
        raise ValueError('Use an HTTPS service origin, or explicitly choose loopback hardware-only measurement.')
    output = Path(args.output)
    if output.exists():
        raise ValueError('Choose a new report path.')
    secret = Path(args.secret_file).read_bytes().strip()
    weights_hash = hashlib.sha256(Path(args.weights_manifest).read_bytes()).hexdigest()
    from PIL import Image
    image = Image.new('RGB', (280, 280), 'red')
    stream = io.BytesIO(); image.save(stream, format='PNG')
    blob = stream.getvalue()
    digest = hashlib.sha256(blob).hexdigest()
    opener = urllib.request.build_opener(NoRedirects())
    results = []
    for count in [1, 4]:
        for sample in range(5):
            descriptor = dict(assetId='synthetic-image' if count == 1 else 'synthetic-video', contentHash=digest,
                              sizeBytes=len(blob), width=280, height=280, contentType='image/png')
            descriptors = [dict(descriptor, **(dict(frameIndex=i, timestampSeconds=i + .5) if count == 4 else {})) for i in range(count)]
            request_input = dict(schemaVersion=2, inputSchema='demeos-visual-input-v2',
                                 capability='image-semantics' if count == 1 else 'video-frame-semantics',
                                 businessId='test-business-benchmark', productId='synthetic', productRevision='a' * 64,
                                 mediaRevision='b' * 64, media=descriptors, text='Describe the visible colour briefly.')
            now = int(time.time() * 1000)
            request_hash = hashlib.sha256(json.dumps(request_input, sort_keys=True).encode()).hexdigest()
            job_id = str(uuid.uuid4())
            payload = json.dumps(dict(protocolVersion=1, jobId=job_id, issuedAt=now, deadline=now + 2000,
                                      modelId=MODEL_ID, modelVersion=MODEL_VERSION, weightsManifestHash=weights_hash, runtimeCodeHash=args.runtime_code_hash,
                                      inputHash=request_hash, input=request_input,
                                      media=[base64.b64encode(blob).decode()] * count)).encode()
            started = time.perf_counter()
            report = {'mediaCount': count, 'sample': sample + 1}
            try:
                req = urllib.request.Request(args.origin.rstrip('/') + '/v1/infer', payload,
                                             {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + secret.decode(),
                                              'X-DEMEOS-Signature': hmac.new(secret, payload, hashlib.sha256).hexdigest()})
                with opener.open(req, timeout=3) as response:
                    raw = response.read(36865)
                if len(raw) > 36864:
                    raise ValueError('Oversized runtime response')
                result = strict_json(raw)
                if result['jobId'] != job_id or result['inputHash'] != request_hash or result['modelVersion'] != MODEL_VERSION or result['weightsManifestHash'] != weights_hash or result['runtimeCodeHash'] != args.runtime_code_hash:
                    raise ValueError('Runtime provenance mismatch')
                validate_output(result['output'], descriptors)
                duration = (time.perf_counter() - started) * 1000
                report.update(passed=duration <= 2000, endToEndMs=duration, measurements=result['measurements'], output=result['output'])
            except Exception as error:
                report.update(passed=False, errorType=type(error).__name__, endToEndMs=(time.perf_counter() - started) * 1000)
                if isinstance(error, urllib.error.HTTPError):
                    report['httpStatus'] = error.code
                    error.close()  # Never store response bodies, headers or credential values.
            results.append(report)
            print(f'{count} image(s), sample {sample + 1}: ' + ('passed' if report['passed'] else 'failed'), flush=True)
            if not report['passed']:
                break  # Do not keep spending GPU time/reloading after the first failed deadline.
        if not results[-1]['passed']:
            break
    report = dict(modelId=MODEL_ID, modelVersion=MODEL_VERSION, weightsManifestHash=weights_hash, runtimeCodeHash=args.runtime_code_hash,
                  route='loopback-hardware-only' if local else 'https-client-to-runtime',
                  timeoutMs=2000, results=results, twoSecondBoundaryPassed=len(results) == 10 and all(r['passed'] for r in results),
                  productAccuracyVerified=False, multilingualAccuracyVerified=False, activationApproved=False)
    output.write_text(json.dumps(report, indent=2) + '\n')
    print('Report saved. This report does not enable the dashboard or approve model quality.')


if __name__ == '__main__':
    main()
