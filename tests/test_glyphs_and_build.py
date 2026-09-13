"""Tests for the glyph sources, the logo allocation and the build pipeline.

These guard the things that are easy to get quietly wrong: a glyph that is
not 12x18, an arrow pointing the wrong side of the compass, a variant that
silently ships a blank index, or a module name that shadows the standard
library.
"""

from __future__ import annotations

import importlib
import math
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))
sys.path.insert(0, str(REPO_ROOT / "tools"))

import build_font  # noqa: E402
from glyphs import glyph_map  # noqa: E402
from glyphs.glyph_map import GLYPH_MAP, PROTECTED, arrow_bearing  # noqa: E402
from glyphs.icons import ICONS  # noqa: E402
from glyphs.letters import LETTERS  # noqa: E402
from glyphs.logo import (  # noqa: E402
    CRAFT_NAME_SLOTS,
    LOGO_START,
    LOGO_TILES,
    RESERVED_INDEX,
    TILES_HORIZ,
    TILES_VERT,
    WORDMARK_INDEXES,
)
from glyphs.numbers import NUMBERS  # noqa: E402
from glyphs.punctuation import PUNCTUATION  # noqa: E402
from mcm_decode import read_font  # noqa: E402
from mcm_encode import (  # noqa: E402
    GLYPH_COUNT,
    GLYPH_HEIGHT,
    GLYPH_WIDTH,
    TRANSPARENT,
    Glyph,
    encode_font,
)
from outline_art import missing_outline  # noqa: E402

ART_MODULES = {
    "letters": LETTERS,
    "numbers": NUMBERS,
    "punctuation": PUNCTUATION,
    "icons": ICONS,
    "logo": LOGO_TILES,
}


def all_art() -> dict[int, str]:
    merged: dict[int, str] = {}
    for table in ART_MODULES.values():
        merged.update(table)
    return merged


class TestGlyphSources(unittest.TestCase):
    def test_every_glyph_parses_as_12x18(self):
        for name, table in ART_MODULES.items():
            for index, art in table.items():
                with self.subTest(module=name, index=f"0x{index:02X}"):
                    glyph = Glyph.from_ascii(art, name=f"{name} 0x{index:02X}")
                    self.assertEqual(len(glyph.rows), GLYPH_HEIGHT)
                    for row in glyph.rows:
                        self.assertEqual(len(row), GLYPH_WIDTH)

    def test_art_modules_do_not_overlap(self):
        seen: dict[int, str] = {}
        for name, table in ART_MODULES.items():
            for index in table:
                self.assertNotIn(
                    index,
                    seen,
                    f"0x{index:02X} defined in both {seen.get(index)} and {name}",
                )
                seen[index] = name

    def test_art_covers_every_unprotected_index(self):
        covered = set(all_art()) | set(PROTECTED)
        missing = sorted(set(range(GLYPH_COUNT)) - covered)
        self.assertEqual(
            missing, [], f"undefined: {[f'0x{i:02X}' for i in missing]}"
        )

    def test_protected_indexes_have_no_authored_art(self):
        for index in PROTECTED:
            self.assertNotIn(index, all_art(), f"0x{index:02X} is protected")

    def test_every_white_pixel_keeps_its_black_surround(self):
        for name, table in ART_MODULES.items():
            for index, art in table.items():
                with self.subTest(module=name, index=f"0x{index:02X}"):
                    glyph = Glyph.from_ascii(art)
                    self.assertEqual(missing_outline(glyph.rows), [])

    def test_numbers_module_does_not_shadow_the_stdlib(self):
        """glyphs/numbers.py is only safe as a package submodule.

        Putting glyphs/ directly on sys.path makes `import numbers` resolve
        to our art and breaks decimal, fractions and Pillow. Everything
        must import it as glyphs.numbers.
        """
        import numbers as stdlib_numbers

        self.assertTrue(hasattr(stdlib_numbers, "Number"))
        self.assertNotIn("NUMBERS", vars(stdlib_numbers))


class TestGlyphMap(unittest.TestCase):
    def test_map_is_complete_and_consistent(self):
        self.assertEqual(len(GLYPH_MAP), GLYPH_COUNT)
        for index, slot in GLYPH_MAP.items():
            self.assertEqual(index, slot.index)
            self.assertTrue(slot.meaning)

    def test_protected_indexes_are_categorised_as_such(self):
        for index in PROTECTED:
            self.assertEqual(GLYPH_MAP[index].category, "protected")

    def test_ascii_block_keeps_ascii_meanings(self):
        for index in range(0x41, 0x5B):
            self.assertEqual(GLYPH_MAP[index].meaning, f"letter {chr(index)}")
        for index in range(0x30, 0x3A):
            self.assertEqual(GLYPH_MAP[index].meaning, f"digit {index - 0x30}")

    def test_arrow_bearings_run_anticlockwise_from_south(self):
        """0x60 S, 0x64 E, 0x68 N, 0x6C W -- bearings decrease.

        Getting this backwards mirrors every home arrow about the N-S axis,
        which is both wrong and easy not to notice.
        """
        self.assertEqual(arrow_bearing(0x60), 180.0)
        self.assertEqual(arrow_bearing(0x64), 90.0)
        self.assertEqual(arrow_bearing(0x68), 0.0)
        self.assertEqual(arrow_bearing(0x6C), 270.0)
        self.assertEqual(glyph_map.ARROW_BEARING_STEP, -22.5)


class TestArrowArt(unittest.TestCase):
    """Each arrow must actually point along its bearing."""

    def direction_agrees(self, index: int) -> bool:
        glyph = Glyph.from_ascii(ICONS[index])
        points = [
            (x, y)
            for y, row in enumerate(glyph.rows)
            for x, char in enumerate(row)
            if char == "#"
        ]
        theta = math.radians(arrow_bearing(index))
        ux, uy = math.sin(theta), -math.cos(theta)  # screen y grows downward
        projections = [x * ux + y * uy for x, y in points]
        low, high = min(projections), max(projections)
        span = high - low
        head = sum(1 for v in projections if v >= high - 0.4 * span)
        stem = sum(1 for v in projections if v <= low + 0.4 * span)
        # The head is a broad triangle, the stem a narrow bar: more ink
        # sits at the pointing end than the blunt one.
        return head > stem

    def test_all_sixteen_arrows_point_correctly(self):
        for index in range(0x60, 0x70):
            with self.subTest(index=f"0x{index:02X}", bearing=arrow_bearing(index)):
                self.assertTrue(self.direction_agrees(index))

    def test_arrows_are_all_distinct(self):
        shapes = {ICONS[i] for i in range(0x60, 0x70)}
        self.assertEqual(len(shapes), 16, "two headings share the same art")


class TestLogoAllocation(unittest.TestCase):
    def test_splash_block_geometry(self):
        self.assertEqual(LOGO_START, 0xA0)
        self.assertEqual(TILES_HORIZ * TILES_VERT, 96)
        self.assertEqual(RESERVED_INDEX, 0xFF)

    def test_reserved_tile_is_not_written(self):
        self.assertNotIn(RESERVED_INDEX, LOGO_TILES)
        self.assertEqual(len(LOGO_TILES), 95)

    def test_tiles_fill_the_block_except_the_reserved_one(self):
        expected = set(range(LOGO_START, LOGO_START + 96)) - {RESERVED_INDEX}
        self.assertEqual(set(LOGO_TILES), expected)

    def test_wordmark_is_contiguous_and_nested_in_the_splash(self):
        indexes = list(WORDMARK_INDEXES)
        self.assertTrue(indexes)
        self.assertEqual(
            indexes, list(range(indexes[0], indexes[-1] + 1)), "not contiguous"
        )
        for index in indexes:
            self.assertIn(index, LOGO_TILES)
        self.assertNotIn(RESERVED_INDEX, indexes)

    def test_wordmark_is_between_8_and_12_tiles(self):
        self.assertGreaterEqual(len(WORDMARK_INDEXES), 8)
        self.assertLessEqual(len(WORDMARK_INDEXES), 12)

    def test_wordmark_tiles_carry_ink(self):
        for index in (WORDMARK_INDEXES[0], WORDMARK_INDEXES[-1]):
            glyph = Glyph.from_ascii(LOGO_TILES[index])
            inked = any(c != TRANSPARENT for row in glyph.rows for c in row)
            self.assertTrue(inked, f"0x{index:02X} is blank")

    def test_craft_name_slots_are_typeable_ascii_and_sufficient(self):
        self.assertGreaterEqual(len(CRAFT_NAME_SLOTS), len(WORDMARK_INDEXES))
        for index, char in CRAFT_NAME_SLOTS:
            self.assertTrue(0x20 <= index <= 0x7E, f"0x{index:02X} not typeable")
            self.assertEqual(ord(char), index)

    def test_craft_name_avoids_cli_hazardous_characters(self):
        """The craft name must survive being set over the CLI.

        Betaflight strips everything from '#' onward as a comment before
        parsing the line, so a craft name containing one is silently
        truncated -- the OSD would show a fragment of the wordmark and the
        pilot would have no idea why.
        """
        import slice_logo

        self.assertIn("#", slice_logo.CLI_HAZARDOUS)
        name = "".join(c for _, c in CRAFT_NAME_SLOTS[: len(WORDMARK_INDEXES)])
        for char in slice_logo.CLI_HAZARDOUS:
            self.assertNotIn(char, name, f"{char!r} truncates the craft name")

    def test_craft_name_fits_betaflight_name_length(self):
        # MAX_NAME_LENGTH is 16 in the firmware; Configurator's field is
        # maxlength=16 to match.
        name = "".join(c for _, c in CRAFT_NAME_SLOTS[: len(WORDMARK_INDEXES)])
        self.assertLessEqual(len(name), 16)


class TestBuildPipeline(unittest.TestCase):
    def setUp(self):
        self.stock = read_font(
            REPO_ROOT / "assets" / "references" / "stock" / "default_v2.mcm"
        )

    def assemble(self, **kwargs):
        params = {
            "text_set": "standard",
            "icon_overrides": [],
            "logo_module": "glyphs.logo",
            "extra_outline": 0,
            "stock": self.stock,
        }
        params.update(kwargs)
        return build_font.assemble(**params)

    def test_assembles_256_glyphs(self):
        glyphs = self.assemble()
        self.assertEqual(len(glyphs), GLYPH_COUNT)

    def test_protected_glyphs_come_from_stock(self):
        glyphs = self.assemble()
        for index in build_font.PROTECTED_INDEXES:
            self.assertEqual(glyphs[index], self.stock[index])

    def test_overrides_replace_rather_than_collide(self):
        base = self.assemble()
        clean = self.assemble(icon_overrides=["glyphs.icons_clean"])
        overridden = importlib.import_module("glyphs.icons_clean").ICONS_CLEAN
        for index in overridden:
            self.assertNotEqual(
                base[index], clean[index], f"0x{index:02X} override had no effect"
            )
        untouched = [i for i in range(GLYPH_COUNT) if i not in overridden]
        for index in untouched:
            self.assertEqual(base[index], clean[index])

    def test_extra_outline_only_thickens_the_ascii_block(self):
        base = self.assemble()
        heavy = self.assemble(extra_outline=1)
        for index in range(GLYPH_COUNT):
            if index in build_font.ASCII_BLOCK and index not in PROTECTED:
                continue
            self.assertEqual(
                base[index], heavy[index], f"0x{index:02X} changed unexpectedly"
            )

    def test_extra_outline_adds_black_without_moving_white(self):
        base = self.assemble()
        heavy = self.assemble(extra_outline=1)
        changed = 0
        for index in build_font.ASCII_BLOCK:
            before, after = base[index], heavy[index]
            for y in range(GLYPH_HEIGHT):
                for x in range(GLYPH_WIDTH):
                    if before.rows[y][x] == "#":
                        self.assertEqual(after.rows[y][x], "#", "white pixel moved")
            if before != after:
                changed += 1
        self.assertGreater(changed, 0, "extra_outline did nothing")

    def test_missing_index_fails_the_build_loudly(self):
        original = build_font.TEXT_SETS["standard"]
        build_font.TEXT_SETS["gappy"] = original[:-1]  # drop punctuation
        try:
            with self.assertRaisesRegex(build_font.BuildError, "undefined"):
                self.assemble(text_set="gappy")
        finally:
            del build_font.TEXT_SETS["gappy"]

    def test_unknown_text_set_is_rejected(self):
        with self.assertRaisesRegex(build_font.BuildError, "unknown text_set"):
            self.assemble(text_set="nope")

    def test_craft_name_copies_wordmark_onto_sacrificial_slots(self):
        glyphs = self.assemble()
        patched, craft_text, slots = build_font.apply_craft_name(
            glyphs, "glyphs.logo"
        )
        self.assertEqual(len(craft_text), len(WORDMARK_INDEXES))
        for (slot_index, _), tile_index in zip(slots, WORDMARK_INDEXES, strict=True):
            self.assertEqual(patched[slot_index], glyphs[tile_index])
        # Everything outside the sacrificed slots is untouched.
        sacrificed = {i for i, _ in slots}
        for index in range(GLYPH_COUNT):
            if index not in sacrificed:
                self.assertEqual(glyphs[index], patched[index])

    def test_clean_overrides_are_each_closer_to_stock(self):
        """The `clean` variant's selling point, made checkable.

        Every icon it overrides must be measurably nearer the stock art
        than the flagship's version is. Without this the variant could
        drift into being merely *different* while still claiming to be
        familiar.
        """
        full = self.assemble()
        clean = self.assemble(icon_overrides=["glyphs.icons_clean"])
        overridden = importlib.import_module("glyphs.icons_clean").ICONS_CLEAN

        def distance(a: Glyph, b: Glyph) -> int:
            return sum(
                1
                for ra, rb in zip(a.rows, b.rows, strict=True)
                for x, y in zip(ra, rb, strict=True)
                if x != y
            )

        for index in overridden:
            with self.subTest(index=f"0x{index:02X}"):
                self.assertLess(
                    distance(clean[index], self.stock[index]),
                    distance(full[index], self.stock[index]),
                    f"0x{index:02X}: the clean override is not closer to stock",
                )

    def test_clean_differs_from_flagship_only_where_declared(self):
        """`clean` is a handful of overrides, not a second icon set.

        The README says so in as many words; this keeps the two honest
        about each other if someone adds an override without updating it.
        """
        full = self.assemble()
        clean = self.assemble(icon_overrides=["glyphs.icons_clean"])
        overridden = set(importlib.import_module("glyphs.icons_clean").ICONS_CLEAN)
        differing = {i for i in range(GLYPH_COUNT) if full[i] != clean[i]}
        self.assertEqual(differing, overridden)

    def test_high_readability_adds_black_and_no_white(self):
        """Its whole premise: more contrast, identical letterforms."""
        full = self.assemble()
        heavy = self.assemble(extra_outline=1)
        ascii_block = [i for i in build_font.ASCII_BLOCK if i not in PROTECTED]

        def count(glyphs, index, char):
            return sum(row.count(char) for row in glyphs[index].rows)

        added_black = sum(
            count(heavy, i, "-") - count(full, i, "-") for i in ascii_block
        )
        added_white = sum(
            count(heavy, i, "#") - count(full, i, "#") for i in ascii_block
        )
        self.assertGreater(added_black, 0, "no extra black surround")
        self.assertEqual(added_white, 0, "white strokes moved; they must not")

    def test_build_is_deterministic(self):
        first = encode_font(self.assemble())
        second = encode_font(self.assemble())
        self.assertEqual(first, second)

    def test_committed_fonts_match_a_fresh_build(self):
        """The .mcm files in fonts/ are the deliverable; they must not
        drift from the sources that produced them."""
        import tomllib

        config = REPO_ROOT / "variants.toml"
        if not config.exists():
            self.skipTest("variants.toml missing")
        spec = tomllib.loads(config.read_text())
        for name, variant in spec["variants"].items():
            committed = REPO_ROOT / "fonts" / variant["output"]
            if not committed.exists():
                self.skipTest(f"{committed.name} not built yet")
            glyphs = self.assemble(
                icon_overrides=variant.get("icon_overrides", []),
                extra_outline=int(variant.get("extra_outline", 0)),
            )
            with self.subTest(variant=name):
                self.assertEqual(
                    encode_font(glyphs),
                    committed.read_text(encoding="ascii"),
                    f"{committed.name} is stale; re-run tools/build_font.py",
                )


if __name__ == "__main__":
    unittest.main()
