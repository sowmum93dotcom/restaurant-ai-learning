"""Operator preparation fixtures only; no model or GPU execution."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from prepare_bounded_pack import prepare


class BoundedPackTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        folder = self.root / 'images/controlled-test'
        folder.mkdir(parents=True)
        self.source = folder / 'source.webp'
        Image.new('RGB', (640, 480), 'blue').save(self.source, 'WEBP')
        self.original = self.source.read_bytes()
        self.pack = self.root / 'source.json'
        self.pack.write_text(json.dumps(dict(schemaVersion=1, scope='repository-controlled-fixtures',
            assets={'source': dict(path='images/controlled-test/source.webp', sha256=hashlib.sha256(self.original).hexdigest())},
            cases=[dict(id='case', locale='en', asset='source', text='Supplied fixture', reviewFocus=['Fixture only'])])))
        self.output, self.manifest = self.root / 'derived.json', self.root / 'manifest.json'

    def tearDown(self):
        self.temp.cleanup()

    def test_separate_hashes_bounded_dimensions_and_identical_rerun_preserve_original(self):
        result = prepare(self.pack, self.root, self.output, self.manifest)
        self.assertEqual(self.source.read_bytes(), self.original)
        row = result['assets'][0]
        self.assertLessEqual(max(row['width'], row['height']), 320)
        self.assertEqual(row['sourceHash'], hashlib.sha256(self.original).hexdigest())
        derived = self.root / row['derivedPath']
        self.assertEqual(row['derivedHash'], hashlib.sha256(derived.read_bytes()).hexdigest())
        self.assertNotEqual(row['derivedHash'], row['sourceHash'])
        self.assertFalse(result['gpuExecuted']); self.assertFalse(result['activationApproved'])
        self.assertEqual(prepare(self.pack, self.root, self.output, self.manifest), result)

    def test_differing_existing_copy_is_never_replaced(self):
        destination = self.source.with_name('source-bounded-320.webp')
        destination.write_bytes(b'preserved-existing-data')
        with self.assertRaisesRegex(ValueError, 'existing-diagnostic-differs'):
            prepare(self.pack, self.root, self.output, self.manifest)
        self.assertEqual(destination.read_bytes(), b'preserved-existing-data')
        self.assertEqual(self.source.read_bytes(), self.original)
        self.assertFalse(self.output.exists())

    def test_corrupt_source_fails_before_any_diagnostic_file_is_created(self):
        self.source.write_bytes(b'changed-source')
        with self.assertRaisesRegex(ValueError, 'fixture-integrity-failed'):
            prepare(self.pack, self.root, self.output, self.manifest)
        self.assertFalse(self.output.exists())
        self.assertFalse(self.source.with_name('source-bounded-320.webp').exists())


if __name__ == '__main__':
    unittest.main()
