"""Optional tool test; never overwrite the existing icon files."""
import hashlib
import io
import unittest
from pathlib import Path
import sys
from PIL import Image, __version__

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


class IconsTest(unittest.TestCase):
    def test_draw_without_modifying_assets(self):
        originals = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT / 'icons').glob('*.png')}
        from gen_icons import draw_icon
        self.assertEqual(__version__, '13.0.0')
        for size in (16, 48, 128):
            image = draw_icon(size)
            self.assertEqual(image.size, (size, size))
            output = io.BytesIO()
            image.save(output, format='PNG')
            output.seek(0)
            with Image.open(output, formats=['PNG']) as decoded:
                decoded.load()
                self.assertEqual(decoded.size, (size, size))
        self.assertEqual(originals, {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in originals})


if __name__ == '__main__':
    unittest.main()
