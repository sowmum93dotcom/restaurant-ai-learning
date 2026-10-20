"""Declared HTTP fixtures test the evaluator, not model accuracy or GPU speed."""
import copy
import hashlib
import hmac
import io
import json
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from acceptance import load_pack, run_case
from benchmark import NoRedirects
import urllib.request


class AcceptanceTests(unittest.TestCase):
    def fixture(self, root):
        from PIL import Image
        directory = root / 'images/controlled-test'
        directory.mkdir(parents=True)
        image = directory / 'fixture.png'
        Image.new('RGB', (28, 28), 'red').save(image)
        pack = dict(schemaVersion=1, scope='repository-controlled-fixtures',
                    assets={'fixture': dict(path='images/controlled-test/fixture.png',
                                           sha256=hashlib.sha256(image.read_bytes()).hexdigest())},
                    cases=[dict(id='fixture-en', locale='en', asset='fixture', text='Red fixture',
                                reviewFocus=['Declared fixture, never model accuracy.'])])
        path = root / 'pack.json'
        path.write_text(json.dumps(pack))
        return path, pack

    def test_all_cases_and_bytes_are_checked_before_execution(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); path, pack = self.fixture(root)
            self.assertEqual(len(load_pack(path, root)[1]), 1)
            bad_cases = []
            p = copy.deepcopy(pack); p['cases'].append(dict(p['cases'][0])); bad_cases.append(p)
            p = copy.deepcopy(pack); p['cases'][0]['locale'] = 'unsupported'; bad_cases.append(p)
            p = copy.deepcopy(pack); p['assets']['fixture']['sha256'] = '0' * 64; bad_cases.append(p)
            p = copy.deepcopy(pack); p['assets']['fixture']['path'] = '../../private'; bad_cases.append(p)
            p = copy.deepcopy(pack); p['scope'] = 'live-business'; bad_cases.append(p)
            for bad in bad_cases:
                path.write_text(json.dumps(bad))
                with self.assertRaises(ValueError): load_pack(path, root)
            path.write_text(json.dumps(pack))
            outside = root / 'private.png'
            (root / pack['assets']['fixture']['path']).rename(outside)
            (root / pack['assets']['fixture']['path']).symlink_to(outside)
            with self.assertRaises(ValueError): load_pack(path, root)

    def test_signed_real_http_retains_outputs_but_does_not_approve_quality(self):
        secret = b'declared-fixture-secret-not-a-real-credential'
        class Fixture(BaseHTTPRequestHandler):
            calls = 0
            mode = 'valid'
            def do_POST(self):
                type(self).calls += 1
                raw = self.rfile.read(int(self.headers['Content-Length']))
                assert self.headers['Authorization'] == 'Bearer ' + secret.decode()
                assert hmac.compare_digest(self.headers['X-DEMEOS-Signature'], hmac.new(secret, raw, hashlib.sha256).hexdigest())
                request = json.loads(raw)
                response = {k: request[k] for k in ['protocolVersion', 'jobId', 'inputHash', 'modelVersion', 'weightsManifestHash', 'runtimeCodeHash']}
                response.update(output=dict(schemaVersion=2, outputSchema='demeos-visual-output-v2', proposals=[]),
                                measurements=dict(durationMs=1, peakVramBytes=100))
                if self.mode == 'wrong-hash': response['runtimeCodeHash'] = 'b' * 64
                if self.mode == 'bad-measurement': response['measurements']['durationMs'] = -1
                if self.mode == 'extra': response['private'] = 'private-runtime-secret'
                if self.mode == 'timeout':
                    status, body = 504, b'{"code":"execution-timeout"}'
                else: status, body = 200, json.dumps(response).encode()
                self.send_response(status); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
            def log_message(self, *_): pass

        with HTTPServer(('127.0.0.1', 0), Fixture) as server, tempfile.TemporaryDirectory() as d:
            thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
            try:
                root = Path(d); path, pack = self.fixture(root)
                _, assets, _ = load_pack(path, root)
                origin = f'http://127.0.0.1:{server.server_port}'
                opener = urllib.request.build_opener(NoRedirects())
                for mode in ['valid', 'wrong-hash', 'bad-measurement', 'extra', 'timeout']:
                    Fixture.mode = mode
                    result = run_case(pack['cases'][0], assets['fixture'], origin, secret, 'a'*64, 'a'*64, opener)
                    self.assertEqual(result['passed'], mode == 'valid')
                    self.assertEqual(result['humanReview'], 'pending')
                    self.assertNotIn('private-runtime-secret', json.dumps(result))
                Fixture.mode = 'timeout'; Fixture.calls = 0
                pack['cases'].append(dict(pack['cases'][0], id='fixture-tr', locale='tr'))
                path.write_text(json.dumps(pack)); (root/'secret').write_bytes(secret); (root/'manifest').write_text('{}')
                command = [sys.executable, str(Path(__file__).with_name('acceptance.py')), '--pack', str(path),
                           '--media-root', str(root), '--origin', origin, '--local-hardware-only',
                           '--secret-file', str(root/'secret'), '--weights-manifest', str(root/'manifest'),
                           '--runtime-code-hash', 'a'*64, '--output', str(root/'report.json')]
                process = subprocess.run(command, capture_output=True, text=True, timeout=10)
                self.assertEqual(process.returncode, 0, process.stderr)
                report = json.loads((root/'report.json').read_text())
                self.assertEqual(Fixture.calls, 1)
                self.assertEqual(report['results'][0]['runtimeErrorCode'], 'execution-timeout')
                self.assertEqual(report['plannedCaseCount'], 2)
                for field in ['executionPassed', 'productAccuracyVerified', 'multilingualAccuracyVerified', 'categoryAccuracyVerified', 'activationApproved']:
                    self.assertFalse(report[field])
                before = (root/'report.json').read_bytes()
                process = subprocess.run(command, capture_output=True, text=True, timeout=10)
                self.assertNotEqual(process.returncode, 0)
                self.assertEqual(Fixture.calls, 1)
                self.assertEqual((root/'report.json').read_bytes(), before)
                self.assertNotIn(secret.decode(), before.decode())
            finally:
                server.shutdown(); thread.join(2)

    def test_repository_pack_covers_ten_selling_locales_and_claim_conflict(self):
        root = Path(__file__).resolve().parents[2]
        pack, _, _ = load_pack(Path(__file__).with_name('acceptance-cases.json'), root)
        from acceptance import LOCALES
        for locale in LOCALES:
            self.assertEqual(len([c for c in pack['cases'] if c['locale'] == locale and c['id'] != 'advertising-claim-conflict-en']), 3)
        self.assertTrue(any(c['id'] == 'advertising-claim-conflict-en' for c in pack['cases']))
        checked = subprocess.run([sys.executable, str(Path(__file__).with_name('acceptance.py')),
                                  '--pack', str(Path(__file__).with_name('acceptance-cases.json')),
                                  '--media-root', str(root), '--validate-only'], capture_output=True, text=True, timeout=10)
        self.assertEqual(checked.returncode, 0, checked.stderr)
        summary = json.loads(checked.stdout)
        self.assertEqual(summary['caseCount'], 31)
        self.assertEqual(summary['gpuRequests'], 0)
        self.assertFalse(summary['activationApproved'])


if __name__ == '__main__': unittest.main()
