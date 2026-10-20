"""Benchmark failure integration checks; fixtures, never GPU acceptance."""
import io
import json
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from benchmark import http_failure


class BenchmarkTests(unittest.TestCase):
    def test_only_exact_known_status_code_pairs_enter_reports(self):
        cases = [
            (504, b'{"code":"execution-timeout"}', 'execution-timeout'),
            (400, b'{"code":"invalid-request-or-output"}', 'invalid-request-or-output'),
            (503, b'{"code":"runtime-unavailable"}', 'runtime-unavailable'),
            (502, b'{"code":"model-output-limit"}', 'model-output-limit'),
            (502, b'{"code":"model-json-invalid"}', 'model-json-invalid'),
            (502, b'{"code":"model-evidence-invalid"}', 'model-evidence-invalid'),
            (502, b'{"code":"model-output-invalid"}', 'model-output-invalid'),
            (503, b'{"code":"model-output-limit"}', None),
            (502, b'{"code":"model-output-limit","detail":"private text"}', None),
            (502, b'{"code":"private text"}', None),
            (502, b'{"code":[]}', None),
            (504, b'{"code":"runtime-unavailable"}', None),
            (504, b'{"code":"execution-timeout","secret":"private"}', None),
            (504, b'{"code":"private customer text"}', None),
            (504, b'{"code":"execution-timeout","code":"execution-timeout"}', None),
            (504, b'x' * 300, None),
            (504, b'not json', None),
            (302, b'{"code":"execution-timeout"}', None),
        ]
        for status, body, expected in cases:
            with self.subTest(status=status, body=body):
                stream = io.BytesIO(body)
                error = urllib.error.HTTPError('http://127.0.0.1/private', status,
                                               'private message', {'private': 'secret'}, stream)
                result = http_failure(error)
                self.assertTrue(stream.closed)
                self.assertEqual(result, dict(httpStatus=status, **(
                    {'runtimeErrorCode': expected} if expected else {})))

    def test_real_http_failure_stops_after_one_request_and_saves_safe_report(self):
        class FailingRuntime(BaseHTTPRequestHandler):
            calls = 0

            def do_POST(self):
                type(self).calls += 1
                self.rfile.read(int(self.headers['Content-Length']))
                body = b'{"code":"execution-timeout"}'
                self.send_response(504)
                self.send_header('Content-Length', str(len(body)))
                self.send_header('X-Private', 'must-not-be-saved')
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *_):
                pass

        with HTTPServer(('127.0.0.1', 0), FailingRuntime) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with tempfile.TemporaryDirectory() as directory:
                    root = Path(directory)
                    (root / 'secret').write_text('fixture-secret-not-a-real-credential')
                    (root / 'manifest').write_text('{}')
                    result = subprocess.run([
                        sys.executable, str(Path(__file__).with_name('benchmark.py')),
                        '--origin', f'http://127.0.0.1:{server.server_port}',
                        '--local-hardware-only', '--secret-file', str(root / 'secret'),
                        '--weights-manifest', str(root / 'manifest'),
                        '--runtime-code-hash', 'a' * 64, '--output', str(root / 'report.json')
                    ], capture_output=True, text=True, timeout=10)
                    self.assertEqual(result.returncode, 0, result.stderr)
                    raw = (root / 'report.json').read_text()
                    report = json.loads(raw)
                    self.assertEqual(FailingRuntime.calls, 1)
                    self.assertEqual(len(report['results']), 1)
                    self.assertEqual(report['results'][0]['runtimeErrorCode'], 'execution-timeout')
                    self.assertFalse(report['results'][0]['passed'])
                    for field in ['twoSecondBoundaryPassed', 'productAccuracyVerified',
                                  'multilingualAccuracyVerified', 'activationApproved']:
                        self.assertFalse(report[field])
                    self.assertEqual(report['timeoutMs'], 2000)
                    for private in ['fixture-secret', 'must-not-be-saved', 'X-Private']:
                        self.assertNotIn(private, raw + result.stdout + result.stderr)
            finally:
                server.shutdown()
                thread.join(2)


if __name__ == '__main__':
    unittest.main()
