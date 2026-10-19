"""Record local file checksums. This does not certify the model's source."""
import argparse
import hashlib
import json
from pathlib import Path
from contracts import MODEL_ID, MODEL_VERSION
from server import runtime_code_hash


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('model_path')
    parser.add_argument('output')
    args = parser.parse_args()
    root = Path(args.model_path).resolve(strict=True)
    names = ['README.md', 'chat_template.json', 'config.json', 'generation_config.json', 'merges.txt',
             'model-00001-of-00002.safetensors', 'model-00002-of-00002.safetensors',
             'model.safetensors.index.json', 'preprocessor_config.json', 'tokenizer.json',
             'tokenizer_config.json', 'video_preprocessor_config.json', 'vocab.json']
    total = sum((root / name).stat().st_size for name in names)
    checked, files = 0, {}
    for name in names:
        path = (root / name).resolve(strict=True)
        if path.parent != root:
            raise ValueError('Model files must remain inside the selected directory.')
        digest = hashlib.sha256()
        with path.open('rb') as handle:
            for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b''):
                digest.update(chunk)
                checked += len(chunk)
                print(f'Checking model files: {checked * 100 // total}%', end='\r', flush=True)
        files[name] = digest.hexdigest()
    raw = (json.dumps(dict(modelId=MODEL_ID, modelVersion=MODEL_VERSION, files=files), indent=2, sort_keys=True) + '\n').encode()
    output = Path(args.output)
    if output.exists():
        raise ValueError('Choose a new output path; an existing trusted manifest is never overwritten.')
    output.write_bytes(raw)
    print('\nLocal checksums saved. Compare them with trusted snapshot/source checksums before approval.')
    print('weightsManifestHash: ' + hashlib.sha256(raw).hexdigest())
    print('runtimeCodeHash: ' + runtime_code_hash())


if __name__ == '__main__':
    main()
