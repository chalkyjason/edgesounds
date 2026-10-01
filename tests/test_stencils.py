"""Tests for the shared stencil alphabets in assets/splash_stencils.json.

The file is read by tools/make_logo.py (the Army Jay splash) and by the web
app's start-screen page, so its shape is a contract: every character the
page offers must exist in both fonts, every glyph must be rectangular and the
right height, and moving the original letterforms into it must not have
changed a pixel of the shipped splash.
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "tools"))

import build_previews  # noqa: E402
import make_logo  # noqa: E402

STENCILS_PATH = REPO_ROOT / "assets" / "splash_stencils.json"
LOGO_PATH = REPO_ROOT / "assets" / "logo_288x72.png"

#: Every character the start-screen page lets a pilot type.
CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -.!'/"

#: The letterforms as they were in make_logo.py before the move, pinned so the
#: shipped wordmark cannot drift. Everything else in the file is new art.
ORIGINAL_BIG_A = [
    "...######...",
    "..########..",
    ".###....###.",
    "###......###",
    "###......###",
    "###......###",
    "############",
    "############",
    "###......###",
    "###......###",
    "###......###",
    "###......###",
    "###......###",
    "###......###",
]
ORIGINAL_SMALL_T = [
    "######",
    "######",
    "..##..",
    "..##..",
    "..##..",
    "..##..",
    "..##..",
    "..##..",
    "..##..",
]


class StencilFileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(STENCILS_PATH.read_text(encoding="utf-8"))

    def test_has_both_fonts_with_their_heights(self):
        self.assertEqual(self.data["big"]["height"], 14)
        self.assertEqual(self.data["small"]["height"], 9)

    def test_covers_the_character_set(self):
        for name in ("big", "small"):
            missing = [c for c in CHARSET if c not in self.data[name]["glyphs"]]
            self.assertEqual(missing, [], f"{name} is missing {missing!r}")

    def test_every_glyph_is_rectangular_and_binary(self):
        for name in ("big", "small"):
            font = self.data[name]
            for char, rows in font["glyphs"].items():
                with self.subTest(font=name, char=char):
                    self.assertEqual(len(rows), font["height"])
                    widths = {len(r) for r in rows}
                    self.assertEqual(len(widths), 1, f"ragged rows: {widths}")
                    self.assertTrue(set("".join(rows)) <= {".", "#"})

    def test_space_widths_are_the_originals(self):
        # Changing either would move every word on the shipped splash.
        self.assertEqual(len(self.data["big"]["glyphs"][" "][0]), 12)
        self.assertEqual(len(self.data["small"]["glyphs"][" "][0]), 6)

    def test_moved_letterforms_are_unchanged(self):
        self.assertEqual(self.data["big"]["glyphs"]["A"], ORIGINAL_BIG_A)
        self.assertEqual(self.data["small"]["glyphs"]["T"], ORIGINAL_SMALL_T)

    def test_no_glyph_is_blank_except_space(self):
        for name in ("big", "small"):
            for char, rows in self.data[name]["glyphs"].items():
                if char == " ":
                    continue
                self.assertIn("#", "".join(rows), f"{name} {char!r} draws nothing")


class SplashRasterTests(unittest.TestCase):
    def test_make_logo_reproduces_the_committed_raster(self):
        # Pixel for pixel, not byte for byte: PNG encoders differ across
        # Pillow and zlib versions, the picture must not.
        rendered = make_logo.render()
        committed = Image.open(LOGO_PATH).convert("RGB")
        self.assertEqual(rendered.size, committed.size)
        self.assertEqual(rendered.tobytes(), committed.tobytes())

    def test_stencil_sheet_renders_every_character(self):
        sheet = build_previews.render_stencil_sheet(scale=1)
        self.assertGreater(sheet.width, 100)
        self.assertGreater(sheet.height, 40)
        self.assertIn(b"\xff\xff\xff", sheet.tobytes())


if __name__ == "__main__":
    unittest.main()
