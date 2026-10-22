"""Prepare reproducible diagnostic media; never replace source files or infer."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path

import PIL
from PIL import Image
from acceptance import load_pack


def preserve(path, data):
    if path.exists():
        if not path.is_file() or path.read_bytes() != data:
            raise ValueError('existing-diagnostic-differs')
        return
    with path.open('xb') as handle:
        handle.write(data)


def prepare(source_pack, root, output_pack, manifest_path):
    root = Path(root).resolve(strict=True)
    pack, assets, source_hash = load_pack(source_pack, root)
    proof = []
    for asset_id, asset in pack['assets'].items():
        source = root / asset['path']
        destination = source.with_name(source.stem + '-bounded-320.webp')
        if destination == source or destination.is_symlink():
            raise ValueError('diagnostic-destination-required')
        # Transform the exact bytes already hash-verified by load_pack, rather
        # than reopening a mutable source path after its integrity check.
        with Image.open(io.BytesIO(base64.b64decode(assets[asset_id][1], validate=True))) as image:
            image.thumbnail((320, 320))
            encoded = io.BytesIO()
            image.save(encoded, 'WEBP', quality=82)
            dimensions = image.size
        data = encoded.getvalue()
        digest = hashlib.sha256(data).hexdigest()
        preserve(destination, data)
        proof.append(dict(assetId=asset_id, sourcePath=asset['path'],
                          sourceHash=assets[asset_id][0]['contentHash'],
                          derivedPath=str(destination.relative_to(root)),
                          derivedHash=digest, sizeBytes=len(data),
                          width=dimensions[0], height=dimensions[1]))
        asset.update(path=proof[-1]['derivedPath'], sha256=digest)
    # Identical reruns are safe; different existing outputs are never overwritten.
    encoded_pack = json.dumps(pack, ensure_ascii=False, indent=2).encode() + b'\n'
    preserve(Path(output_pack), encoded_pack)
    _, _, derived_hash = load_pack(output_pack, root)
    manifest = dict(schemaVersion=1, scope='diagnostic-only', sourcePackHash=source_hash,
                    derivedPackHash=derived_hash, pillowVersion=PIL.__version__,
                    transformation=dict(maxWidth=320, maxHeight=320, format='WEBP', quality=82),
                    assets=proof, gpuExecuted=False, activationApproved=False)
    preserve(Path(manifest_path), json.dumps(manifest, indent=2).encode() + b'\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    for name in ('source-pack', 'root', 'output-pack', 'manifest'):
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    result = prepare(args.source_pack, args.root, args.output_pack, args.manifest)
    print(json.dumps(dict(verifiedCopies=len(result['assets']),
                          derivedPackHash=result['derivedPackHash'], gpuRequests=0)))
