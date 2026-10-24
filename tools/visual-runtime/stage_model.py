"""Copy verified stored files to a root-owned local directory, with progress."""
import argparse
import hashlib
import json
import os
import shutil
import tempfile
from pathlib import Path
from server import verify_weights


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('trusted_manifest')
    parser.add_argument('destination')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise ValueError('Stage model files as root; the running model service must be non-root.')
    source, manifest_path, destination = Path(args.source).resolve(), Path(args.trusted_manifest).resolve(), Path(args.destination).absolute()
    if destination.exists() or destination.is_symlink():
        raise ValueError('Destination already exists. Validate/reuse it rather than overwriting a model copy.')
    manifest = json.loads(manifest_path.read_bytes())
    names = manifest.get('files', {})
    if not isinstance(names, dict) or not names or len(names) > 32 or any(Path(name).name != name for name in names):
        raise ValueError('Invalid file manifest')
    total = sum((source / name).stat().st_size for name in names)
    if shutil.disk_usage(destination.parent).free < total + 2 * 1024**3:
        raise ValueError('Not enough local disk space to stage the model safely.')
    temporary = Path(tempfile.mkdtemp(prefix='demeos-model-', dir=destination.parent))
    copied = 0
    try:
        for name, expected in names.items():
            input_path = (source / name).resolve(strict=True)
            if input_path.parent != source:
                raise ValueError('Model file escaped its source directory')
            digest = hashlib.sha256()
            with input_path.open('rb') as reader, (temporary / name).open('xb') as writer:
                for chunk in iter(lambda: reader.read(8 * 1024 * 1024), b''):
                    digest.update(chunk); writer.write(chunk); copied += len(chunk)
                    print(f'Copying stored model: {copied * 100 // total}%', end='\r', flush=True)
            if digest.hexdigest() != expected:
                raise ValueError('Stored model copy does not match the trusted checksum manifest')
            (temporary / name).chmod(0o644)
        # Verifies names, pinned model configuration and every staged file before use.
        verify_weights(temporary, manifest_path)
        temporary.chmod(0o755)
        temporary.rename(destination)
        print('\nVerified local model copy is ready. No download or model service was started.')
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)


if __name__ == '__main__':
    main()
