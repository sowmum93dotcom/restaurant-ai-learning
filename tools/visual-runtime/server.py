"""Private, authenticated single-GPU supervisor. Standard library HTTP only."""
import hashlib
import ctypes
import errno
import hmac
import json
import os
import selectors
import signal
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from contracts import (MAX_OUTPUT, MAX_REQUEST, MODEL_ID, MODEL_VERSION, TIMEOUT_MS,
                       MODEL_FAILURE_CODES, ModelOutputError, exact,
                       strict_json, validate_output, validate_request)


def deny_outbound_network():
    """Fail closed unless Linux enforces inherited outbound syscall denial.

    Inbound authenticated HTTP can accept/read/write accepted sockets. No
    outbound sockets are inherited by the model child (Popen closes other fds).
    io_uring is denied too, so it cannot submit network operations around this
    syscall filter. This is an egress restriction, not a general OS sandbox.
    """
    library = ctypes.CDLL('libseccomp.so.2')
    library.seccomp_init.argtypes, library.seccomp_init.restype = [ctypes.c_uint32], ctypes.c_void_p
    library.seccomp_release.argtypes = [ctypes.c_void_p]
    library.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
    library.seccomp_syscall_resolve_name.restype = ctypes.c_int
    library.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
    library.seccomp_rule_add_array.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint, ctypes.c_void_p]
    library.seccomp_attr_set.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint32]
    library.seccomp_load.argtypes = [ctypes.c_void_p]
    context = library.seccomp_init(0x7fff0000)  # SCMP_ACT_ALLOW
    if not context:
        raise RuntimeError('egress-filter-unavailable')
    try:
        # CTL_TSYNC applies the restriction to any existing threads; future
        # threads, forks and execs inherit it. NO_NEW_PRIVS defaults to enabled.
        if library.seccomp_attr_set(context, 4, 1) != 0:
            raise RuntimeError('egress-filter-unavailable')
        for name in ('connect', 'sendmsg', 'sendmmsg',
                     'io_uring_setup', 'io_uring_enter', 'io_uring_register'):
            number = library.seccomp_syscall_resolve_name(name.encode())
            if number < 0 or library.seccomp_rule_add(context, 0x00050000 | errno.EPERM, number, 0) != 0:
                raise RuntimeError('egress-filter-unavailable')
        # Python's sendall uses sendto with a NULL destination on an already
        # accepted connection. Permit that reply path; deny addressed datagrams.
        class ArgumentComparison(ctypes.Structure):
            _fields_ = [('arg', ctypes.c_uint), ('op', ctypes.c_uint),
                        ('a', ctypes.c_uint64), ('b', ctypes.c_uint64)]
        destination = ArgumentComparison(4, 1, 0, 0)  # arg4 != NULL, SCMP_CMP_NE
        number = library.seccomp_syscall_resolve_name(b'sendto')
        if number < 0 or library.seccomp_rule_add_array(context, 0x00050000 | errno.EPERM, number, 1, ctypes.byref(destination)) != 0:
            raise RuntimeError('egress-filter-unavailable')
        if library.seccomp_load(context) != 0:
            raise RuntimeError('egress-filter-unavailable')
    finally:
        library.seccomp_release(context)


class Supervisor:
    def __init__(self, command, child_env, startup_timeout=180):
        self.command, self.child_env, self.startup_timeout = command, child_env, startup_timeout
        self.lock, self.process, self.ready = threading.Lock(), None, False
        self.closed = False

    def _line(self, deadline, maximum):
        result = bytearray()
        with selectors.DefaultSelector() as selector:
            selector.register(self.process.stdout, selectors.EVENT_READ)
            while time.monotonic() < deadline:
                if not selector.select(max(0, deadline - time.monotonic())):
                    break
                chunk = os.read(self.process.stdout.fileno(), 4096)
                if not chunk:
                    raise RuntimeError('worker-exited')
                result.extend(chunk)
                if len(result) > maximum:
                    raise RuntimeError('worker-output-too-large')
                if b'\n' in result:
                    if result.count(b'\n') != 1 or not result.endswith(b'\n'):
                        raise RuntimeError('invalid-worker-protocol')
                    return strict_json(result)
        raise TimeoutError('execution-timeout')

    def _kill(self, wait=True):
        self.ready = False
        if self.process is not None:
            try:
                os.killpg(self.process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            if not wait:
                return  # Recovery retains the process and admission stays closed until reaped.
            self.process.wait(timeout=2)
            self.process.stdin.close()
            self.process.stdout.close()
            self.process = None

    def start(self):
        with self.lock:
            if self.closed:
                return
            self._kill()
            try:
                self.process = subprocess.Popen(self.command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                                stderr=subprocess.DEVNULL, env=self.child_env,
                                                start_new_session=True, bufsize=0)
                startup = self._line(time.monotonic() + self.startup_timeout, 4096)
                if startup != {'ready': True, 'modelVersion': MODEL_VERSION}:
                    raise RuntimeError('worker-startup-failed')
                self.ready = True
            except Exception:
                self._kill()
                raise

    def execute(self, request):
        if not self.lock.acquire(blocking=False):
            raise BlockingIOError('runtime-busy')
        try:
            if not self.ready or self.process is None or self.process.poll() is not None:
                raise BlockingIOError('runtime-not-ready')
            remaining = min(TIMEOUT_MS, request['deadline'] - time.time() * 1000 - 75) / 1000
            if remaining <= 0:
                raise TimeoutError('execution-timeout')
            # Writing a bounded job to a live worker must also respect its deadline.
            payload = json.dumps(request, separators=(',', ':')).encode() + b'\n'
            deadline = time.monotonic() + remaining
            os.set_blocking(self.process.stdin.fileno(), False)
            with selectors.DefaultSelector() as selector:
                selector.register(self.process.stdin, selectors.EVENT_WRITE)
                written = 0
                while written < len(payload):
                    if not selector.select(max(0, deadline - time.monotonic())):
                        raise TimeoutError('execution-timeout')
                    try:
                        written += os.write(self.process.stdin.fileno(), memoryview(payload)[written:])
                    except BlockingIOError:
                        continue
            result = self._line(deadline, MAX_OUTPUT + 4096)
            if isinstance(result, dict) and 'error' in result:
                if (not exact(result, ['error']) or not exact(result['error'], ['code'])
                    or not isinstance(result['error']['code'], str)
                    or result['error']['code'] not in MODEL_FAILURE_CODES):
                    raise RuntimeError('invalid-worker-protocol')
                raise ModelOutputError(result['error']['code'])
            try:
                validate_output(result['output'], request['input']['media'],
                                output_locale=request['input'].get('outputLocale', 'en'))
            except ValueError:
                raise ModelOutputError('model-output-invalid') from None
            return result
        except BlockingIOError:
            raise
        except Exception:
            # Kill the entire child process group; cancelling HTTP alone is insufficient.
            self._kill(wait=False)
            threading.Thread(target=self._recover, daemon=True).start()
            raise
        finally:
            self.lock.release()

    def _recover(self):
        try:
            self.start()
        except Exception:
            pass  # Remain unavailable; never claim a replacement worker is ready.

    def close(self):
        with self.lock:
            self.closed = True
            self._kill()


class RuntimeHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 8

    def __init__(self, address, supervisor, secret, weights_hash, code_hash=None):
        self.supervisor, self.secret, self.weights_hash = supervisor, secret, weights_hash
        self.code_hash = code_hash or runtime_code_hash()
        self.connections = threading.BoundedSemaphore(8)
        self.replays, self.replay_lock = {}, threading.Lock()
        super().__init__(address, Handler)

    def process_request(self, request, client_address):
        if not self.connections.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.connections.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.connections.release()


class Handler(BaseHTTPRequestHandler):
    server_version = 'DEMEOS'
    protocol_version = 'HTTP/1.1'

    def setup(self):
        super().setup()
        self.connection.settimeout(3)

    def log_message(self, *_):
        pass  # Never log product text, request bytes, tokens or signed headers.

    def send_json(self, status, body):
        data = json.dumps(body, separators=(',', ':')).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        # Reuse only a successful, fully consumed authenticated request. Errors
        # close before another request can be parsed; unread health bodies must
        # never become another client's request on a proxy's pooled connection.
        keep = (status == 200 and self.request_version == 'HTTP/1.1'
                and 'close' not in [part.strip().lower() for part in self.headers.get('Connection', '').split(',')])
        self.close_connection = not keep
        self.send_header('Connection', 'keep-alive' if keep else 'close')
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != '/v1/infer':
            return self.send_json(404, {'code': 'not-found'})
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), b'Bearer ' + self.server.secret):
            return self.send_json(401, {'code': 'authentication-required'})
        raw_length = self.headers.get('Content-Length', '')
        if (self.headers.get('Transfer-Encoding') or len(self.headers.get_all('Content-Length', [])) != 1
            or not raw_length.isascii() or not raw_length.isdigit() or not 0 < int(raw_length) <= MAX_REQUEST
            or self.headers.get('Content-Type') != 'application/json'):
            return self.send_json(400, {'code': 'invalid-request'})
        try:
            raw = self.rfile.read(int(raw_length))
            signature = self.headers.get('X-DEMEOS-Signature', '')
            expected = hmac.new(self.server.secret, raw, hashlib.sha256).hexdigest()
            if len(raw) != int(raw_length) or not hmac.compare_digest(signature, expected):
                return self.send_json(401, {'code': 'authentication-required'})
            request = strict_json(raw)
            validate_request(request, self.server.weights_hash, code_hash=self.server.code_hash)
            with self.server.replay_lock:
                now = time.monotonic()
                self.server.replays = {key: expiry for key, expiry in self.server.replays.items() if expiry > now}
                if request['jobId'] in self.server.replays or len(self.server.replays) >= 1024:
                    return self.send_json(409, {'code': 'duplicate-or-busy'})
                self.server.replays[request['jobId']] = now + 60
            result = self.server.supervisor.execute(request)
            result.update(protocolVersion=1, jobId=request['jobId'], inputHash=request['inputHash'],
                          modelVersion=MODEL_VERSION, weightsManifestHash=self.server.weights_hash, runtimeCodeHash=self.server.code_hash)
            return self.send_json(200, result)
        except BlockingIOError:
            return self.send_json(429, {'code': 'runtime-busy'})
        except TimeoutError:
            return self.send_json(504, {'code': 'execution-timeout'})
        except ModelOutputError as error:
            return self.send_json(502, {'code': error.code})
        except (ValueError, KeyError, TypeError, OverflowError):
            return self.send_json(400, {'code': 'invalid-request-or-output'})
        except (BrokenPipeError, ConnectionError, OSError):
            self.close_connection = True
        except Exception:
            return self.send_json(503, {'code': 'runtime-unavailable'})

    def do_GET(self):
        if self.path != '/healthz':
            return self.send_json(404, {'code': 'not-found'})
        expected = b'Bearer ' + self.server.secret
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), expected):
            return self.send_json(401, {'code': 'authentication-required'})
        lengths = self.headers.get_all('Content-Length', [])
        if self.headers.get('Transfer-Encoding') or len(lengths) > 1 or lengths and lengths != ['0']:
            return self.send_json(400, {'code': 'invalid-request'})
        ready = self.server.supervisor.ready
        return self.send_json(200 if ready else 503, {'ready': ready, 'busy': self.server.supervisor.lock.locked(),
                              'modelId': MODEL_ID, 'modelVersion': MODEL_VERSION,
                              'weightsManifestHash': self.server.weights_hash, 'runtimeCodeHash': self.server.code_hash})


def verify_weights(model_path, manifest_path, require_read_only=False):
    root = Path(model_path).resolve(strict=True)
    if require_read_only and (os.access(root, os.W_OK) or os.access(manifest_path, os.W_OK)):
        raise ValueError('Model directory and checksum manifest must be read-only to the service user.')
    raw = Path(manifest_path).read_bytes()
    if len(raw) > 32768:
        raise ValueError('manifest-too-large')
    manifest = strict_json(raw)
    required = {'README.md', 'chat_template.json', 'config.json', 'generation_config.json',
                'merges.txt', 'model-00001-of-00002.safetensors', 'model-00002-of-00002.safetensors',
                'model.safetensors.index.json', 'preprocessor_config.json', 'tokenizer.json',
                'tokenizer_config.json', 'video_preprocessor_config.json', 'vocab.json'}
    if (not isinstance(manifest, dict) or manifest.get('modelId') != MODEL_ID
        or manifest.get('modelVersion') != MODEL_VERSION or set(manifest.get('files', {})) != required):
        raise ValueError('invalid-weights-manifest')
    for name, digest in manifest['files'].items():
        path = (root / name).resolve(strict=True)
        if path.parent != root or not path.is_file() or require_read_only and os.access(path, os.W_OK):
            raise ValueError('invalid-model-path')
        checksum = hashlib.sha256()
        with path.open('rb') as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b''):
                checksum.update(chunk)
        if not isinstance(digest, str) or not hmac.compare_digest(checksum.hexdigest(), digest):
            raise ValueError('weights-integrity-failed')
    config = strict_json((root / 'config.json').read_bytes())
    if config.get('model_type') != 'qwen3_vl' or config.get('architectures') != ['Qwen3VLForConditionalGeneration']:
        raise ValueError('unexpected-model-configuration')
    return hashlib.sha256(raw).hexdigest()


def runtime_code_hash():
    root = Path(__file__).resolve().parent
    files = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in ['contracts.py', 'server.py', 'worker.py']}
    return hashlib.sha256(json.dumps(files, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def worker_environment():
    allowed = ['PATH', 'LD_LIBRARY_PATH', 'CUDA_VISIBLE_DEVICES', 'CUDA_HOME']
    child_env = {key: os.environ[key] for key in allowed if key in os.environ}
    child_env.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1',
                     HF_HUB_ENABLE_HF_TRANSFER='0', TOKENIZERS_PARALLELISM='false',
                     OMP_NUM_THREADS='4', PYTHONUNBUFFERED='1')
    return child_env


def main():
    if os.geteuid() == 0:
        raise RuntimeError('Run the model service as a dedicated non-root user.')
    code_root = Path(__file__).resolve().parent
    if os.access(code_root, os.W_OK) or any(os.access(code_root / name, os.W_OK) for name in ['server.py', 'worker.py', 'contracts.py']):
        raise ValueError('Runtime code must be read-only to the service user.')
    model_path = os.environ['DEMEOS_MODEL_PATH']
    weights_hash = verify_weights(model_path, os.environ['DEMEOS_WEIGHTS_MANIFEST'], require_read_only=True)
    secret = Path(os.environ['DEMEOS_RUNTIME_SECRET_FILE']).read_bytes().strip()
    if not 32 <= len(secret) <= 256 or any(byte <= 32 or byte > 126 for byte in secret):
        raise ValueError('invalid-secret')
    deny_outbound_network()
    # The model child receives no parent environment credentials or proxy settings.
    child_env = worker_environment()
    code_hash = runtime_code_hash()
    supervisor = Supervisor([sys.executable, '-I', '-u', str(Path(__file__).with_name('worker.py')), model_path, weights_hash, code_hash], child_env)
    server = None
    try:
        supervisor.start()
        bind = os.environ.get('DEMEOS_RUNTIME_BIND', '127.0.0.1')
        if bind not in ['127.0.0.1', '0.0.0.0'] or bind == '0.0.0.0' and os.environ.get('DEMEOS_RUNTIME_BEHIND_TLS_PROXY') != 'true':
            raise ValueError('A non-loopback listener requires an explicitly configured TLS proxy.')
        server = RuntimeHTTPServer((bind, int(os.environ.get('DEMEOS_RUNTIME_PORT', '8081'))), supervisor, secret, weights_hash, code_hash)
        def stop(*_):
            raise SystemExit(0)
        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        server.serve_forever()
    finally:
        supervisor.close()
        if server is not None:
            server.server_close()


if __name__ == '__main__':
    main()
