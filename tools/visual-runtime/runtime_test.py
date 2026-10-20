"""Real supervisor/HTTP tests with a declared fake child; no GPU inference."""
import base64
import hashlib
import hmac
import http.client
import json
import os
import socket
import sys
import tempfile
import threading
import time
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
from contracts import MODEL_ID, MODEL_VERSION, strict_json, validate_request, validate_output
from server import RuntimeHTTPServer, Supervisor, verify_weights, worker_environment, runtime_code_hash, main as runtime_main
from worker import expand_compact_output

FAKE_CHILD = '''import json,sys,time
print(json.dumps({'ready':True,'modelVersion':%r}),flush=True)
for line in sys.stdin:
 r=json.loads(line)
 if r['input']['text']=='hang':time.sleep(10)
 print(json.dumps({'output':{'schemaVersion':2,'outputSchema':'demeos-visual-output-v2','proposals':[]},'measurements':{'durationMs':1,'peakVramBytes':0}}),flush=True)
''' % MODEL_VERSION
SECRET = b'fixture-secret-for-supervisor-tests-only'
WEIGHTS = 'a' * 64


def request(text='', deadline=2000):
    blob = b'fixture, not a decoded product image'
    descriptor = dict(assetId='image', contentHash=hashlib.sha256(blob).hexdigest(),
                      sizeBytes=len(blob), width=20, height=20, contentType='image/png')
    now = int(time.time() * 1000)
    return dict(protocolVersion=1, jobId=str(uuid.uuid4()), issuedAt=now, deadline=now + deadline,
                modelId=MODEL_ID, modelVersion=MODEL_VERSION, weightsManifestHash=WEIGHTS, runtimeCodeHash=runtime_code_hash(),
                inputHash='b' * 64, media=[base64.b64encode(blob).decode()],
                input=dict(schemaVersion=2, inputSchema='demeos-visual-input-v2', capability='image-semantics',
                           businessId='test-business-runtime', productId='p', productRevision='c' * 64,
                           mediaRevision='d' * 64, media=[descriptor], text=text))


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.supervisor = Supervisor([sys.executable, '-I', '-u', '-c', FAKE_CHILD], worker_environment(), 2)
        self.supervisor.start()

    def tearDown(self):
        self.supervisor.close()

    def test_compact_model_output_cannot_invent_or_escape_media_evidence(self):
        descriptors = [dict(contentHash='a' * 64), dict(contentHash='b' * 64)]
        output = expand_compact_output([['video-summary', 'Two sampled red frames.', [0, 1]]], descriptors)
        self.assertEqual(output['proposals'][0]['evidence'], ['a' * 64, 'b' * 64])
        self.assertIsNone(output['proposals'][0]['confidence'])
        self.assertEqual(expand_compact_output([], descriptors)['proposals'], [])
        self.assertEqual(expand_compact_output([['description', 'Solid red color', '0']], descriptors)['proposals'][0]['evidence'], ['a' * 64])
        self.assertEqual(expand_compact_output([['Solid red color', '0']], descriptors), expand_compact_output([['description', 'Solid red color', '0']], descriptors))
        same_frames = [dict(contentHash='a' * 64)] * 4
        self.assertEqual(len(expand_compact_output([['Four sampled red frames.', '0,1,2,3']], same_frames)['proposals'][0]['evidence']), 4)
        self.assertEqual(expand_compact_output([['video-summary', 'Two sampled red frames.', '0,1']], descriptors), output)
        for indices in [[-1], [2], [True], ['0'], [0, 0], [], ['a' * 64]]:
            with self.assertRaises(ValueError):
                expand_compact_output([['description', 'Red.', indices]], descriptors)
        for indices in ['', '00', '-1', '2', '4', '0,0', '0,', ',0', '0, 1', '0.0', '０', 'a' * 64, True, 0, {}]:
            with self.assertRaises(ValueError):
                expand_compact_output([['description', 'Red.', indices]], descriptors)
        for kind, value in [('price', '10'), ('description', '<script>'), ('description', '')]:
            with self.assertRaises(ValueError):
                expand_compact_output([[kind, value, [0]]], descriptors)
        for value in ['<script>', '', '\x00']:
            with self.assertRaises(ValueError):
                expand_compact_output([[value, '0']], descriptors)

    def test_occupied_listener_port_does_not_leave_a_worker_running(self):
        with tempfile.TemporaryDirectory() as directory, socket.socket() as occupied:
            secret_path = Path(directory) / 'secret'
            secret_path.write_bytes(SECRET)
            occupied.bind(('127.0.0.1', 0))
            occupied.listen()
            environment = dict(DEMEOS_MODEL_PATH=directory, DEMEOS_WEIGHTS_MANIFEST='fixture',
                               DEMEOS_RUNTIME_SECRET_FILE=str(secret_path), DEMEOS_RUNTIME_BIND='127.0.0.1',
                               DEMEOS_RUNTIME_PORT=str(occupied.getsockname()[1]))
            with patch.dict(os.environ, environment), patch('server.os.geteuid', return_value=1001), \
                 patch('server.os.access', return_value=False), patch('server.verify_weights', return_value=WEIGHTS), \
                 patch('server.Supervisor', return_value=self.supervisor):
                with self.assertRaises(OSError):
                    runtime_main()
            self.assertTrue(self.supervisor.closed)
            self.assertFalse(self.supervisor.ready)
            self.assertIsNone(self.supervisor.process)

    def test_contract_rejects_untrusted_urls_privileged_output_and_bad_hashes(self):
        good = request()
        validate_request(good, WEIGHTS)
        bad = request()
        bad['input']['sourceUrl'] = 'https://foreign.example'
        with self.assertRaises(ValueError): validate_request(bad, WEIGHTS)
        bad = request()
        bad['media'][0] = base64.b64encode(b'changed').decode()
        with self.assertRaises(ValueError): validate_request(bad, WEIGHTS)
        with self.assertRaises(ValueError): strict_json('{"a":1,"a":2}')
        with self.assertRaises(ValueError): strict_json('{"a":NaN}')
        with self.assertRaises(ValueError):
            validate_output(dict(schemaVersion=2, outputSchema='demeos-visual-output-v2',
                                 proposals=[dict(kind='price', value='10', confidence=None,
                                                 evidence=[good['input']['media'][0]['contentHash']])]), good['input']['media'])

    def test_timeout_kills_worker_and_admission_never_queues_a_second_job(self):
        old_pid = self.supervisor.process.pid
        errors = []
        def run():
            try: self.supervisor.execute(request('hang', 350))
            except Exception as error: errors.append(error)
        job = threading.Thread(target=run)
        started = time.monotonic()
        job.start()
        while not self.supervisor.lock.locked(): time.sleep(.001)
        with self.assertRaises(BlockingIOError): self.supervisor.execute(request())
        job.join(2)
        self.assertFalse(job.is_alive())
        self.assertTrue(any(isinstance(error, TimeoutError) for error in errors))
        self.assertLess(time.monotonic() - started, 1.5)
        with self.assertRaises(ProcessLookupError): os.kill(old_pid, 0)

    def test_authenticated_http_replay_protection_and_health(self):
        server = RuntimeHTTPServer(('127.0.0.1', 0), self.supervisor, SECRET, WEIGHTS)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        def post(body, secret=SECRET):
            raw = json.dumps(body).encode()
            conn = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=3)
            conn.request('POST', '/v1/infer', raw, {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SECRET.decode(),
                         'X-DEMEOS-Signature': hmac.new(secret, raw, hashlib.sha256).hexdigest()})
            response = conn.getresponse()
            status, result = response.status, json.loads(response.read())
            conn.close()
            return status, result
        try:
            job = request()
            self.assertEqual(post(job, b'wrong')[0], 401)
            status, result = post(job)
            self.assertEqual(status, 200)
            self.assertEqual(result['inputHash'], job['inputHash'])
            self.assertEqual(result['weightsManifestHash'], WEIGHTS)
            self.assertEqual(post(job)[0], 409)
            conn = http.client.HTTPConnection('127.0.0.1', server.server_port)
            conn.request('GET', '/healthz')
            response = conn.getresponse()
            self.assertEqual(response.status, 401)
            response.read(); conn.close()
        finally:
            server.shutdown(); server.server_close(); thread.join(2)

    def test_model_child_environment_drops_credentials(self):
        with patch.dict(os.environ, {'POSTGRES_URL': 'secret', 'HF_TOKEN': 'secret',
                                    'BLOB_READ_WRITE_TOKEN': 'secret', 'HTTP_PROXY': 'secret',
                                    'DEMEOS_VISUAL_RUNTIME_SECRET': 'secret'}):
            environment = worker_environment()
            self.assertFalse(any('secret' in value for value in environment.values()))
            self.assertEqual(environment['HF_HUB_OFFLINE'], '1')

    def test_weights_verification_detects_a_corrupt_copy(self):
        names = ['README.md', 'chat_template.json', 'config.json', 'generation_config.json', 'merges.txt',
                 'model-00001-of-00002.safetensors', 'model-00002-of-00002.safetensors',
                 'model.safetensors.index.json', 'preprocessor_config.json', 'tokenizer.json',
                 'tokenizer_config.json', 'video_preprocessor_config.json', 'vocab.json']
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in names: (root / name).write_bytes(b'fixture, not model weights')
            (root / 'config.json').write_text(json.dumps({'model_type': 'qwen3_vl', 'architectures': ['Qwen3VLForConditionalGeneration']}))
            manifest = dict(modelId=MODEL_ID, modelVersion=MODEL_VERSION,
                            files={name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in names})
            path = root / 'weights-manifest.json'
            path.write_text(json.dumps(manifest))
            self.assertEqual(len(verify_weights(root, path)), 64)
            (root / names[5]).write_bytes(b'corrupted')
            with self.assertRaises(ValueError): verify_weights(root, path)


if __name__ == '__main__':
    unittest.main()
