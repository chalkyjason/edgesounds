"""Round-trip and format tests for the `.mcm` encoder/decoder.

Stdlib ``unittest`` only -- the step-1 toolchain has no third-party
dependencies, so this runs anywhere Python 3.11+ does.

Run with::

    python -m unittest discover -s tests -v
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import validate  # noqa: E402
from mcm_decode import (  # noqa: E402
    McmParseError,
    dump_ascii,
    parse_ascii_dump,
    parse_mcm,
    parse_mcm_raw,
    read_font,
    split_lines,
)
from mcm_encode import (  # noqa: E402
    BLACK,
    DATA_BYTES_PER_GLYPH,
    FIELD_BYTES_PER_GLYPH,
    GLYPH_COUNT,
    GLYPH_HEIGHT,
    GLYPH_WIDTH,
    HEADER,
    PAD_BYTE,
    TOTAL_LINE_COUNT,
    TRANSPARENT,
    WHITE,
    Glyph,
    GlyphError,
    encode_font,
    glyphs_from_ascii_map,
    write_font,
)

STOCK_DIR = REPO_ROOT / "assets" / "references" / "stock"
STOCK_FONTS = sorted(STOCK_DIR.glob("*.mcm"))


def checkerboard() -> Glyph:
    """A glyph using all three pixel states, with odd geometry on purpose."""
    rows = []
    for y in range(GLYPH_HEIGHT):
        row = "".join(
            (BLACK, WHITE, TRANSPARENT)[(x + y) % 3] for x in range(GLYPH_WIDTH)
        )
        rows.append(row)
    return Glyph(rows, name="checkerboard")


def synthetic_font() -> list[Glyph]:
    """256 distinct glyphs -- every index gets a unique pixel pattern."""
    glyphs = []
    for index in range(GLYPH_COUNT):
        rows = []
        for y in range(GLYPH_HEIGHT):
            row = "".join(
                (BLACK, WHITE, TRANSPARENT)[(x + y + index) % 3]
                for x in range(GLYPH_WIDTH)
            )
            rows.append(row)
        glyphs.append(Glyph(rows, name=f"synthetic-0x{index:02X}"))
    return glyphs


class TestGlyphModel(unittest.TestCase):
    def test_geometry_constants_agree(self):
        self.assertEqual(GLYPH_WIDTH * GLYPH_HEIGHT, 216)
        self.assertEqual(216 // 4, DATA_BYTES_PER_GLYPH)
        self.assertEqual(FIELD_BYTES_PER_GLYPH - DATA_BYTES_PER_GLYPH, 10)
        self.assertEqual(GLYPH_COUNT * FIELD_BYTES_PER_GLYPH + 1, TOTAL_LINE_COUNT)

    def test_from_ascii_strips_surrounding_blank_lines(self):
        art = "\n" + "\n".join([TRANSPARENT * GLYPH_WIDTH] * GLYPH_HEIGHT) + "\n\n"
        glyph = Glyph.from_ascii(art, name="blank")
        self.assertEqual(glyph, Glyph.blank())

    def test_wrong_row_count_is_rejected(self):
        art = "\n".join([TRANSPARENT * GLYPH_WIDTH] * (GLYPH_HEIGHT - 1))
        with self.assertRaisesRegex(GlyphError, "expected 18 rows"):
            Glyph.from_ascii(art, name="short")

    def test_wrong_row_width_is_rejected(self):
        rows = [TRANSPARENT * GLYPH_WIDTH] * GLYPH_HEIGHT
        rows[4] = TRANSPARENT * (GLYPH_WIDTH + 1)
        with self.assertRaisesRegex(GlyphError, "row 4 has 13 chars"):
            Glyph.from_ascii("\n".join(rows), name="wide")

    def test_illegal_character_is_rejected(self):
        rows = [TRANSPARENT * GLYPH_WIDTH] * GLYPH_HEIGHT
        rows[0] = "X" + TRANSPARENT * (GLYPH_WIDTH - 1)
        with self.assertRaisesRegex(GlyphError, "illegal characters"):
            Glyph.from_ascii("\n".join(rows), name="bogus")

    def test_glyph_bytes_are_padded_with_0x55(self):
        data = checkerboard().to_bytes()
        self.assertEqual(len(data), FIELD_BYTES_PER_GLYPH)
        self.assertEqual(
            data[DATA_BYTES_PER_GLYPH:],
            bytes([PAD_BYTE] * 10),
        )

    def test_glyph_bytes_round_trip(self):
        glyph = checkerboard()
        self.assertEqual(Glyph.from_bytes(glyph.to_bytes()), glyph)

    def test_glyph_ascii_round_trips(self):
        glyph = checkerboard()
        self.assertEqual(Glyph.from_ascii(glyph.to_ascii()), glyph)

    def test_eleven_pairs_decode_to_transparent_and_never_re_emit(self):
        # 0xFF is four '11' pairs. Some third-party fonts contain them.
        field = bytes([0xFF] * DATA_BYTES_PER_GLYPH) + bytes([PAD_BYTE] * 10)
        glyph = Glyph.from_bytes(field)
        self.assertEqual(glyph, Glyph.blank())
        self.assertNotIn(0xFF, glyph.to_bytes()[:DATA_BYTES_PER_GLYPH])


class TestFontEncoding(unittest.TestCase):
    def test_encode_requires_exactly_256_glyphs(self):
        with self.assertRaisesRegex(GlyphError, "exactly 256 glyphs"):
            encode_font([Glyph.blank()] * 255)

    def test_encoded_font_has_the_right_shape(self):
        text = encode_font(synthetic_font())
        lines = text.split("\n")
        self.assertEqual(lines[0], HEADER)
        self.assertEqual(len(lines), TOTAL_LINE_COUNT)
        self.assertFalse(text.endswith("\n"), "stock fonts have no trailing newline")
        for line in lines[1:]:
            self.assertEqual(len(line), 8)
            self.assertFalse(set(line) - {"0", "1"})

    def test_synthetic_font_round_trips(self):
        glyphs = synthetic_font()
        self.assertEqual(parse_mcm(encode_font(glyphs)), glyphs)

    def test_ascii_dump_round_trips(self):
        glyphs = synthetic_font()
        self.assertEqual(parse_ascii_dump(dump_ascii(glyphs)), glyphs)

    def test_glyphs_from_ascii_map_rejects_gaps(self):
        art = "\n".join([TRANSPARENT * GLYPH_WIDTH] * GLYPH_HEIGHT)
        source = [(i, f"g{i}", art) for i in range(GLYPH_COUNT - 1)]
        with self.assertRaisesRegex(GlyphError, "1 glyph indexes are undefined"):
            glyphs_from_ascii_map(source)

    def test_glyphs_from_ascii_map_rejects_duplicates(self):
        art = "\n".join([TRANSPARENT * GLYPH_WIDTH] * GLYPH_HEIGHT)
        source = [(i, f"g{i}", art) for i in range(GLYPH_COUNT)]
        source.append((0x41, "duplicate-A", art))
        with self.assertRaisesRegex(GlyphError, "0x41 defined twice"):
            glyphs_from_ascii_map(source)

    def test_write_font_emits_lf_and_no_trailing_newline(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = write_font(Path(tmp) / "out.mcm", synthetic_font())
            raw = path.read_bytes()
            self.assertNotIn(b"\r", raw)
            self.assertFalse(raw.endswith(b"\n"))
            self.assertEqual(raw.count(b"\n"), TOTAL_LINE_COUNT - 1)


class TestParserRejectsMalformedFiles(unittest.TestCase):
    def good_text(self) -> str:
        return encode_font(synthetic_font())

    def test_missing_header(self):
        text = self.good_text().replace(HEADER, "MAX7457", 1)
        with self.assertRaisesRegex(McmParseError, "line 1 must be"):
            parse_mcm(text)

    def test_wrong_line_count(self):
        text = self.good_text() + "\n01010101"
        with self.assertRaisesRegex(McmParseError, "16386 total"):
            parse_mcm(text)

    def test_short_line(self):
        lines = self.good_text().split("\n")
        lines[100] = "0101010"
        with self.assertRaisesRegex(McmParseError, "line 101 has 7 characters"):
            parse_mcm("\n".join(lines))

    def test_non_binary_line(self):
        lines = self.good_text().split("\n")
        lines[7] = "0101010X"
        with self.assertRaisesRegex(McmParseError, "line 8 is not binary"):
            parse_mcm("\n".join(lines))

    def test_trailing_newline_and_crlf_are_tolerated(self):
        text = self.good_text()
        expected = parse_mcm(text)
        self.assertEqual(parse_mcm(text + "\n"), expected)
        self.assertEqual(parse_mcm(text.replace("\n", "\r\n")), expected)
        self.assertEqual(parse_mcm(text.replace("\n", "\r\n") + "\r\n"), expected)

    def test_split_lines_yields_the_documented_count(self):
        self.assertEqual(len(split_lines(self.good_text())), TOTAL_LINE_COUNT)


@unittest.skipUnless(STOCK_FONTS, f"no vendored stock fonts in {STOCK_DIR}")
class TestAgainstStockFonts(unittest.TestCase):
    """The real proof: our encoder must reproduce Betaflight's own files."""

    def test_stock_fonts_are_present(self):
        names = {p.name for p in STOCK_FONTS}
        self.assertIn("default_v2.mcm", names, "the current Configurator font")

    def test_byte_identical_disk_round_trip(self):
        for path in STOCK_FONTS:
            with self.subTest(font=path.name):
                original = path.read_bytes()
                glyphs = read_font(path)
                self.assertEqual(len(glyphs), GLYPH_COUNT)
                with tempfile.TemporaryDirectory() as tmp:
                    out = write_font(Path(tmp) / path.name, glyphs)
                    self.assertEqual(out.read_bytes(), original)

    def test_stock_padding_is_0x55(self):
        for path in STOCK_FONTS:
            with self.subTest(font=path.name):
                for index, field in enumerate(parse_mcm_raw(path.read_text())):
                    self.assertEqual(
                        field[DATA_BYTES_PER_GLYPH:],
                        bytes([PAD_BYTE] * 10),
                        f"glyph 0x{index:02X} padding",
                    )

    def test_stock_uses_no_eleven_pairs(self):
        for path in STOCK_FONTS:
            with self.subTest(font=path.name):
                for index, field in enumerate(parse_mcm_raw(path.read_text())):
                    for byte in field[:DATA_BYTES_PER_GLYPH]:
                        bits = f"{byte:08b}"
                        pairs = {bits[i : i + 2] for i in range(0, 8, 2)}
                        self.assertNotIn(
                            "11", pairs, f"glyph 0x{index:02X} byte 0b{bits}"
                        )

    def test_stock_ascii_re_render_matches(self):
        for path in STOCK_FONTS:
            with self.subTest(font=path.name):
                glyphs = read_font(path)
                self.assertEqual(parse_ascii_dump(dump_ascii(glyphs)), glyphs)

    def test_validate_passes_on_every_stock_font(self):
        for path in STOCK_FONTS:
            with self.subTest(font=path.name):
                reporter = validate.validate_font(
                    path, validate.DEFAULT_STOCK, verbose=False
                )
                self.assertEqual(reporter.failures, [])


class TestValidatorCatchesCorruption(unittest.TestCase):
    """A validator that never fails is not a validator."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.dir = Path(self.tmp.name)

    def write(self, name: str, text: str) -> Path:
        path = self.dir / name
        path.write_text(text, encoding="ascii", newline="\n")
        return path

    def run_checks(self, path: Path) -> list[str]:
        return validate.validate_font(
            path, validate.DEFAULT_STOCK, verbose=False
        ).failures

    def test_a_built_font_passes_every_check(self):
        built = REPO_ROOT / "fonts" / "armyjay_full.mcm"
        if not built.exists():
            self.skipTest("fonts/armyjay_full.mcm not built yet")
        self.assertEqual(self.run_checks(built), [])

    def test_stock_font_fails_the_house_outline_rule(self):
        """Check 10 is stricter than stock, deliberately.

        Stock leaves plenty of white touching transparent. That is why the
        vendored references are exempt -- and why the exemption must be
        path-based rather than an unconditional pass.
        """
        path = self.write("stocklike.mcm", encode_font(read_font(validate.DEFAULT_STOCK)))
        failures = self.run_checks(path)
        self.assertTrue(any("outline integrity" in f for f in failures), failures)
        self.assertTrue(validate.is_vendored(validate.DEFAULT_STOCK))
        self.assertFalse(validate.is_vendored(path))

    def test_bad_padding_is_caught(self):
        lines = encode_font(synthetic_font()).split("\n")
        # Last padding byte of glyph 0x02.
        lines[1 + 2 * FIELD_BYTES_PER_GLYPH + 63] = "00000000"
        path = self.write("padding.mcm", "\n".join(lines))
        failures = self.run_checks(path)
        self.assertTrue(any("padding" in f for f in failures), failures)

    def test_eleven_pair_is_caught(self):
        lines = encode_font(synthetic_font()).split("\n")
        lines[1 + 5 * FIELD_BYTES_PER_GLYPH] = "11000000"
        path = self.write("eleven.mcm", "\n".join(lines))
        failures = self.run_checks(path)
        self.assertTrue(any("pixel encoding" in f for f in failures), failures)

    def test_truncated_file_is_caught(self):
        lines = encode_font(synthetic_font()).split("\n")
        path = self.write("short.mcm", "\n".join(lines[:-1]))
        failures = self.run_checks(path)
        self.assertTrue(any("structure" in f for f in failures), failures)

    def test_protected_index_change_is_caught(self):
        glyphs = read_font(validate.DEFAULT_STOCK)
        glyphs[0x00] = checkerboard()
        path = self.write("protected.mcm", encode_font(glyphs))
        failures = self.run_checks(path)
        self.assertTrue(any("protected glyphs" in f for f in failures), failures)


if __name__ == "__main__":
    unittest.main()
