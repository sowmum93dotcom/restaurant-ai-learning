"""Bounded, data-only wire contract for the DEMEOS-owned GPU worker."""
import base64
import hashlib
import json
import re
import time

MODEL_ID = 'Qwen3-VL-4B-Instruct'
MODEL_VERSION = 'ebb281ec70b05090aa6165b016eac8ec08e71b17'
MAX_REQUEST = 6 * 1024 * 1024
MAX_OUTPUT = 32768
TIMEOUT_MS = 2000
TEXT_KINDS = {'title', 'description', 'observable-attribute', 'image-description',
              'video-summary', 'media-consistency', 'visible-product', 'image-quality'}
TOKEN = re.compile(r'^[a-zA-Z0-9_.:-]{1,120}$')
DIGEST = re.compile(r'^[a-f0-9]{64}$')


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError('duplicate-key')
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite')))


def exact(value, keys):
    return isinstance(value, dict) and set(value) == set(keys)


def integer(value, low, high):
    return type(value) is int and low <= value <= high


def validate_request(value, weights_hash, now=None, code_hash=None):
    now = time.time() * 1000 if now is None else now
    keys = ['protocolVersion', 'jobId', 'issuedAt', 'deadline', 'modelId', 'modelVersion',
            'weightsManifestHash', 'runtimeCodeHash', 'inputHash', 'input', 'media']
    if not exact(value, keys) or value['protocolVersion'] != 1:
        raise ValueError('invalid-protocol')
    if (not isinstance(value['jobId'], str) or not TOKEN.fullmatch(value['jobId'])
        or value['modelId'] != MODEL_ID or value['modelVersion'] != MODEL_VERSION
        or value['weightsManifestHash'] != weights_hash
        or not isinstance(value['runtimeCodeHash'], str) or not DIGEST.fullmatch(value['runtimeCodeHash'])
        or code_hash is not None and value['runtimeCodeHash'] != code_hash
        or not isinstance(value['inputHash'], str) or not DIGEST.fullmatch(value['inputHash'])
        or not integer(value['issuedAt'], int(now - 15000), int(now + 1000))
        or not integer(value['deadline'], int(now + 1), int(now + TIMEOUT_MS))):
        raise ValueError('invalid-job')
    request = value['input']
    if (not exact(request, ['schemaVersion', 'inputSchema', 'capability', 'businessId',
                          'productId', 'productRevision', 'mediaRevision', 'media', 'text'])
        or request['schemaVersion'] != 2 or request['inputSchema'] != 'demeos-visual-input-v2'
        or request['capability'] not in ['image-semantics', 'video-frame-semantics']
        or any(not isinstance(request[k], str) or not TOKEN.fullmatch(request[k])
               for k in ['businessId', 'productId'])
        or any(not isinstance(request[k], str) or not DIGEST.fullmatch(request[k])
               for k in ['productRevision', 'mediaRevision'])
        or not isinstance(request['text'], str) or len(request['text']) > 2000
        or len(json.dumps(request).encode()) > 32768):
        raise ValueError('invalid-input')
    descriptors, media = request['media'], value['media']
    count = 1 if request['capability'] == 'image-semantics' else 4
    if not isinstance(descriptors, list) or not 1 <= len(descriptors) <= count or not isinstance(media, list) or len(media) != len(descriptors):
        raise ValueError('invalid-media')
    decoded, seen, size = [], set(), 0
    for descriptor, encoded in zip(descriptors, media):
        keys = ['assetId', 'contentHash', 'sizeBytes', 'width', 'height', 'contentType']
        if count == 4:
            keys += ['frameIndex', 'timestampSeconds']
        if (not exact(descriptor, keys)
            or not isinstance(descriptor['assetId'], str) or not TOKEN.fullmatch(descriptor['assetId'])
            or not isinstance(descriptor['contentHash'], str) or not DIGEST.fullmatch(descriptor['contentHash'])
            or not integer(descriptor['sizeBytes'], 1, 4 * 1024 * 1024)
            or any(not integer(descriptor[k], 1, 1600) for k in ['width', 'height'])
            or descriptor['contentType'] not in ['image/webp', 'image/jpeg', 'image/png']):
            raise ValueError('invalid-descriptor')
        frame = descriptor.get('frameIndex')
        if count == 4 and (not integer(frame, 0, 3) or type(descriptor['timestampSeconds']) not in [int, float] or not 0 <= descriptor['timestampSeconds'] <= 60):
            raise ValueError('invalid-frame')
        key = (descriptor['assetId'], frame)
        if key in seen or not isinstance(encoded, str) or len(encoded) > 5592408:
            raise ValueError('invalid-media')
        seen.add(key)
        blob = base64.b64decode(encoded, validate=True)
        size += len(blob)
        if len(blob) != descriptor['sizeBytes'] or hashlib.sha256(blob).hexdigest() != descriptor['contentHash'] or size > 4 * 1024 * 1024:
            raise ValueError('media-integrity-failed')
        decoded.append(blob)
    return decoded


def validate_output(value, descriptors):
    if (not exact(value, ['schemaVersion', 'outputSchema', 'proposals'])
        or value['schemaVersion'] != 2 or value['outputSchema'] != 'demeos-visual-output-v2'
        or not isinstance(value['proposals'], list) or len(value['proposals']) > 16
        or len(json.dumps(value).encode()) > MAX_OUTPUT):
        raise ValueError('invalid-output')
    hashes = {item['contentHash'] for item in descriptors}
    for proposal in value['proposals']:
        if (not exact(proposal, ['kind', 'value', 'evidence', 'confidence'])
            or proposal['kind'] not in TEXT_KINDS or proposal['confidence'] is not None
            or not isinstance(proposal['value'], str)
            or not 1 <= len(proposal['value'].strip()) <= (200 if proposal['kind'] == 'title' else 2000)
            or re.search(r'[<>\x00-\x08]', proposal['value'])
            or not isinstance(proposal['evidence'], list) or not 1 <= len(proposal['evidence']) <= 4
            or any(not isinstance(item, str) or item not in hashes for item in proposal['evidence'])):
            raise ValueError('invalid-proposal')
    return value
