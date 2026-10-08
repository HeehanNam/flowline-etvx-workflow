import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('recovery', Path(__file__).resolve().parents[1] / 'restore_missing_files.py')
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class RecoveryTests(unittest.TestCase):
    def test_missing_binary_restored_without_overwriting_edits_or_db(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'existing.js').write_bytes(b'local edit')
            (root / 'data').mkdir()
            (root / 'data/flowline.db').write_bytes(b'database')
            entries = b'100644 blob abc\tnested/missing.bin\0' + b'100644 blob def\texisting.js\0'
            with patch.object(recovery, 'git', side_effect=[entries, b'\x00\xff\r\n']):
                self.assertEqual(recovery.restore_missing(root), ['nested/missing.bin'])
            self.assertEqual((root / 'nested/missing.bin').read_bytes(), b'\x00\xff\r\n')
            self.assertEqual((root / 'existing.js').read_bytes(), b'local edit')
            self.assertEqual((root / 'data/flowline.db').read_bytes(), b'database')

    def test_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(recovery, 'git', return_value=b'100644 blob abc\t../outside\0'):
                with self.assertRaises(RuntimeError):
                    recovery.restore_missing(Path(directory))


if __name__ == '__main__':
    unittest.main()
