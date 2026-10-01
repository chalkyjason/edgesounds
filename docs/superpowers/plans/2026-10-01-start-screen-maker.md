# Start Screen Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/osd/splash` page where a pilot designs the 288 × 72 Betaflight boot splash from typed text, any image, or painted pixels, and exports it inside an Army Jay variant or the stock Betaflight font.

**Architecture:** One *generator* (the text template or the image tool) produces a base raster of `white | black | transparent`; *paint* is a sparse layer of pixel overrides on top, the glyph editor's base-plus-edits pattern. Everything downstream — preview, tile slicing, `.mcm` and PNG export — reads the composed raster. The stencil letterforms move out of `make_logo.py` into `assets/splash_stencils.json`, read by both Python and the web, and the web compositor is proven against the shipped font tile for tile.

**Tech Stack:** React 19 + TypeScript + Vite 8 + Vitest 5 (existing web stack); Python 3.11 + Pillow (existing pipeline); IndexedDB (`armyjay_osd`, bumped to v2); the existing `.mcm` codec, `logo.ts` slicer and `SaveLink`.

**Spec:** `docs/superpowers/specs/2026-10-01-start-screen-maker-design.md`

Every file in this plan was run before it was written down, in a scratch copy of the repo: the full web suite (130 tests), lint, `tsc -b` and `vite build` pass; the Python suite (76 tests) and `ruff` pass; `make_logo.py` reading the JSON reproduces `assets/logo_288x72.png` pixel for pixel; and the finished page was driven in a browser — text set in the stencils, a valid 147,463-byte export, the design restored after reload, and the paint canvas scrolling inside its column at phone width. Copy it exactly.

## Global Constraints

- Node 22 for everything under `web/` (`nvm use`; the shell default is 20.18). Python commands run from the repo root with the system `python3` (3.13 here; CI uses 3.11).
- `assets/logo_288x72.png` and `fonts/*.mcm` must not change: `python tools/make_logo.py` must reproduce the raster **pixel for pixel** (not byte for byte — PNG encoders differ) and CI's existing `fonts/` staleness check must stay green.
- The big stencil's space is 12 px wide and the small one's 6 px, as today; letters join with a 2 px gap; the big line sits in tile row 1, the small in row 2; rules are 3 px thick from x = 24 to x = 264, chevron caps on the **top rule only** (that is how the shipped splash is drawn, whatever `make_logo.py`'s comment says).
- Stencil character set: `A–Z`, `0–9`, space, `- . ! ' /`. Lowercase is uppercased; anything else is left out of the rendering and named in a warning.
- The web behaviour outside `/osd/splash` is unchanged except for one nav item and one link in the glyph editor.
- IndexedDB `armyjay_osd` goes to version 2 through one shared `openDB`; no module opens the database with its own version.
- Vendored stock font: `assets/references/stock/default_v2.mcm` is staged as `public/osd/fonts/betaflight_default.mcm` and labelled GPL-3.0 in the UI.
- `npm run build` rewrites `web/public/sitemap.xml`'s dates; revert with `git checkout -- web/public/sitemap.xml` before committing.
- Commit messages: an imperative sentence, repo style, ending with the `Co-Authored-By` trailer shown in each commit step.
- The ~60 new stencil glyphs ship only after Jason has looked at `previews/stencil_sheet.png` (Task 7 is that gate).

## Review Focus

Inputs the spec is silent on that would bite a person using this; each has a test in the owning task.

1. **A character with no stencil** (`@`, `#`, lowercase `ß`): the line still renders the rest, and the missing characters are named — never dropped silently. → Task 2, `names unsupported characters and still draws the rest`.
2. **A line too wide for 288 px**: reported with the pixel count and not drawn clipped. → Task 2, `reports a line that is too wide and leaves it undrawn`.
3. **Ink in the reserved `0xFF` tile** (bottom-right): the export says it will not be written and leaves `0xFF` as the base's own glyph. → Task 3, `replaces only the splash block and keeps every other glyph by identity`.
4. **A design saved by version 1 of the database** (someone with glyph edits already saved): the upgrade adds the `splash` store and leaves `font_edits` alone. → Task 4, `leaves a version-1 database its font_edits and adds only splash`.
5. **A transparent or semi-transparent image pixel** with a dark or inverted threshold: alpha below 128 stays transparent whatever the threshold or background. → Task 3, `thresholds grey to white, leaves the rest transparent, honours alpha` and `inverts`.

## File Structure

| File | Responsibility |
|---|---|
| `assets/splash_stencils.json` | The two stencil fonts; the one source for Python and web. |
| `tools/make_logo.py` | Reads the JSON instead of its own dicts; renders the Army Jay splash as before. |
| `tools/build_previews.py` | Also renders `previews/stencil_sheet.png`. |
| `tests/test_stencils.py` | File shape, coverage, pinned originals, pixel-identical raster. |
| `web/scripts/stage-osd-assets.mjs` | Also stages `stencils.json` and the stock font. |
| `web/src/lib/splash/raster.ts` | `Raster` type, outline, paint application, RGBA/tiles, brush offsets. |
| `web/src/lib/splash/stencils.ts` | `StencilFont`, `composeText`, `validateStencils`. |
| `web/src/lib/splash/template.ts` | `renderTemplate`: lines + rules → raster, with per-line reports. |
| `web/src/lib/splash/image.ts` | `fitInside`, `rasterizeImage` (threshold / invert / background / outline). |
| `web/src/lib/splash/compose.ts` | `fontWithSplash`, `splashPng` (stored-deflate PNG, no dependency). |
| `web/src/lib/splash/paint.ts` | `paintReducer` with undo/redo. |
| `web/src/lib/splash/bases.ts` | `ExportBase`, `STOCK_BASE`. |
| `web/src/utils/osdDb.ts` | The shared `armyjay_osd` open/upgrade (v2), `withStore`. |
| `web/src/utils/fontStorage.ts` | Uses `osdDb`; API unchanged. |
| `web/src/utils/splashStorage.ts` | `SplashDesign`, load/save/clear of the one record. |
| `web/src/hooks/useStencils.ts` | Fetch + validate `/osd/stencils.json`. |
| `web/src/hooks/useSplashDesign.ts` | Design state, image decode, paint history, persistence, composed raster. |
| `web/src/components/splash/*.tsx` | `TextTemplatePanel`, `ImagePanel`, `PaintCanvas`, `SplashPreview`, `ExportPanel`. |
| `web/src/pages/osd/SplashMaker.tsx` | The page; `App.tsx` route, `Nav.tsx` item, `FontEditor.tsx` link. |

---

### Task 1: The shared stencil alphabet (Python side)

**Files:**
- Create: `assets/splash_stencils.json`, `tests/test_stencils.py`, `previews/stencil_sheet.png` (generated)
- Modify: `tools/make_logo.py`, `tools/build_previews.py`, `README.md`

**Interfaces:**
- Produces: `assets/splash_stencils.json` — `{ "big": { "height": 14, "glyphs": { "A": [rows] } }, "small": { "height": 9, "glyphs": { ... } } }`, rows of `.`/`#`, rectangular, widths vary per glyph. `make_logo.load_stencils()`. Task 2's web code and tests read the same file.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_stencils.py`:

```python
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `python3 -m unittest tests.test_stencils 2>&1 | tail -5`
Expected: `StencilFileTests` all ERROR with `FileNotFoundError: ... assets/splash_stencils.json`; `test_stencil_sheet_renders_every_character` ERRORs with `AttributeError: module 'build_previews' has no attribute 'render_stencil_sheet'`. `test_make_logo_reproduces_the_committed_raster` already passes — the old dicts draw the same picture, which is the point of pinning it before the move.

- [ ] **Step 3: Write the stencil file**

Create `assets/splash_stencils.json`. The `A J M R Y` and `A C D I L O S T` glyphs are the originals from `make_logo.py` moved verbatim; everything else is new art in the same idiom (3 px strokes in `big`, 2 px in `small`, squared terminals, closed counters).

```json
{
  "big": {
    "height": 14,
    "glyphs": {
      "A": ["...######...", "..########..", ".###....###.", "###......###", "###......###", "###......###", "############", "############", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###"],
      "B": ["##########..", "###########.", "###......###", "###......###", "###......###", "###########.", "###########.", "###......###", "###......###", "###......###", "###......###", "###......###", "###########.", "##########.."],
      "C": ["..##########", ".###########", "###......###", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###......###", ".###########", "..##########"],
      "D": ["##########..", "###########.", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###########.", "##########.."],
      "E": ["############", "############", "###.........", "###.........", "###.........", "###.........", "##########..", "##########..", "###.........", "###.........", "###.........", "###.........", "############", "############"],
      "F": ["############", "############", "###.........", "###.........", "###.........", "###.........", "##########..", "##########..", "###.........", "###.........", "###.........", "###.........", "###.........", "###........."],
      "G": ["..##########", ".###########", "###......###", "###.........", "###.........", "###.........", "###.........", "###...######", "###...######", "###......###", "###......###", "###......###", ".###########", "..##########"],
      "H": ["###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "############", "############", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###"],
      "I": ["#######", "#######", "..###..", "..###..", "..###..", "..###..", "..###..", "..###..", "..###..", "..###..", "..###..", "..###..", "#######", "#######"],
      "J": ["......######", "......######", ".........###", ".........###", ".........###", ".........###", ".........###", ".........###", ".........###", "###......###", "###......###", "####....####", ".##########.", "..########.."],
      "K": ["###......###", "###.....###.", "###....###..", "###...###...", "###..###....", "###.###.....", "######......", "######......", "###.###.....", "###..###....", "###...###...", "###....###..", "###.....###.", "###......###"],
      "L": ["###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "############", "############"],
      "M": ["###......###", "####....####", "############", "############", "###.####.###", "###..##..###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###"],
      "N": ["###......###", "####.....###", "####.....###", "#####....###", "#####....###", "###.##...###", "###.###..###", "###..###.###", "###...##.###", "###....#####", "###....#####", "###.....####", "###.....####", "###......###"],
      "O": ["..########..", ".##########.", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", ".##########.", "..########.."],
      "P": ["##########..", "###########.", "###......###", "###......###", "###......###", "###########.", "##########..", "###.........", "###.........", "###.........", "###.........", "###.........", "###.........", "###........."],
      "Q": ["..########..", ".##########.", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###..###.###", "###...######", ".##########.", "..########..", ".........###"],
      "R": ["##########..", "###########.", "###......###", "###......###", "###......###", "###########.", "##########..", "###...###...", "###....###..", "###.....###.", "###......###", "###......###", "###......###", "###......###"],
      "S": ["..##########", ".###########", "###......###", "###.........", "###.........", ".###........", "..########..", "...########.", "........###.", ".........###", ".........###", "###......###", "###########.", "##########.."],
      "T": ["############", "############", "....####....", "....####....", "....####....", "....####....", "....####....", "....####....", "....####....", "....####....", "....####....", "....####....", "....####....", "....####...."],
      "U": ["###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", ".##########.", "..########.."],
      "V": ["###......###", "###......###", "###......###", "###......###", "###......###", "###......###", ".###....###.", ".###....###.", "..###..###..", "..###..###..", "...######...", "...######...", "....####....", "....####...."],
      "W": ["###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###......###", "###..##..###", "###.####.###", "############", "############", "####....####", "###......###"],
      "X": ["###......###", "###......###", ".###....###.", "..###..###..", "...######...", "....####....", "....####....", "....####....", "....####....", "...######...", "..###..###..", ".###....###.", "###......###", "###......###"],
      "Y": ["###......###", "###......###", ".###....###.", "..###..###..", "...######...", "....####....", "....####....", "....####....", "....####....", "....####....", "....####....", "....####....", "....####....", "....####...."],
      "Z": ["############", "############", ".........###", "........###.", ".......###..", "......###...", ".....###....", "....###.....", "...###......", "..###.......", ".###........", "###.........", "############", "############"],
      "0": ["..########..", ".##########.", "###......###", "###.....####", "###....#####", "###...##.###", "###..###.###", "###.###..###", "###.##...###", "#####....###", "####.....###", "###......###", ".##########.", "..########.."],
      "1": ["...###..", "..####..", ".#####..", "######..", "...###..", "...###..", "...###..", "...###..", "...###..", "...###..", "...###..", "...###..", "########", "########"],
      "2": ["..########..", ".##########.", "###......###", ".........###", ".........###", ".........###", ".......####.", ".....####...", "...####.....", ".###........", "###.........", "###.........", "############", "############"],
      "3": ["..########..", ".##########.", "###......###", ".........###", ".........###", ".........###", "....#######.", "....#######.", ".........###", ".........###", ".........###", "###......###", ".##########.", "..########.."],
      "4": [".......####.", "......#####.", ".....######.", "....###.###.", "...###..###.", "..###...###.", ".###....###.", "###.....###.", "############", "############", "........###.", "........###.", "........###.", "........###."],
      "5": ["############", "############", "###.........", "###.........", "###.........", "##########..", "###########.", ".........###", ".........###", ".........###", ".........###", "###......###", ".##########.", "..########.."],
      "6": ["..########..", ".##########.", "###......###", "###.........", "###.........", "##########..", "###########.", "###......###", "###......###", "###......###", "###......###", "###......###", ".##########.", "..########.."],
      "7": ["############", "############", ".........###", ".........###", "........###.", ".......###..", "......###...", ".....###....", "....###.....", "....###.....", "....###.....", "....###.....", "....###.....", "....###....."],
      "8": ["..########..", ".##########.", "###......###", "###......###", "###......###", ".##########.", "..########..", ".##########.", "###......###", "###......###", "###......###", "###......###", ".##########.", "..########.."],
      "9": ["..########..", ".##########.", "###......###", "###......###", "###......###", "###......###", ".###########", "..##########", ".........###", ".........###", ".........###", "###......###", ".##########.", "..########.."],
      " ": ["............", "............", "............", "............", "............", "............", "............", "............", "............", "............", "............", "............", "............", "............"],
      "-": ["......", "......", "......", "......", "......", "......", "######", "######", "......", "......", "......", "......", "......", "......"],
      ".": ["...", "...", "...", "...", "...", "...", "...", "...", "...", "...", "...", "###", "###", "###"],
      "!": ["###", "###", "###", "###", "###", "###", "###", "###", "###", "###", "...", "###", "###", "###"],
      "'": ["###", "###", "###", "###", "...", "...", "...", "...", "...", "...", "...", "...", "...", "..."],
      "/": [".........###", ".........###", "........###.", ".......###..", "......###...", ".....###....", "....###.....", "...###......", "..###.......", ".###........", "###.........", "###.........", "###.........", "###........."]
    }
  },
  "small": {
    "height": 9,
    "glyphs": {
      "A": [".####.", "######", "##..##", "##..##", "######", "######", "##..##", "##..##", "##..##"],
      "B": ["#####.", "######", "##..##", "##..##", "#####.", "#####.", "##..##", "######", "#####."],
      "C": [".#####", "######", "##....", "##....", "##....", "##....", "##....", "######", ".#####"],
      "D": ["#####.", "######", "##..##", "##..##", "##..##", "##..##", "##..##", "######", "#####."],
      "E": ["######", "######", "##....", "##....", "#####.", "#####.", "##....", "######", "######"],
      "F": ["######", "######", "##....", "##....", "#####.", "#####.", "##....", "##....", "##...."],
      "G": [".#####", "######", "##....", "##....", "##.###", "##.###", "##..##", "######", ".#####"],
      "H": ["##..##", "##..##", "##..##", "######", "######", "##..##", "##..##", "##..##", "##..##"],
      "I": ["######", "######", "..##..", "..##..", "..##..", "..##..", "..##..", "######", "######"],
      "J": ["..####", "..####", "....##", "....##", "....##", "....##", "##..##", "######", ".####."],
      "K": ["##..##", "##..##", "##.##.", "####..", "####..", "##.##.", "##..##", "##..##", "##..##"],
      "L": ["##....", "##....", "##....", "##....", "##....", "##....", "##....", "######", "######"],
      "M": ["##..##", "######", "######", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##"],
      "N": ["##..##", "###.##", "###.##", "######", "######", "##.###", "##.###", "##..##", "##..##"],
      "O": [".####.", "######", "##..##", "##..##", "##..##", "##..##", "##..##", "######", ".####."],
      "P": ["#####.", "######", "##..##", "##..##", "######", "#####.", "##....", "##....", "##...."],
      "Q": [".####.", "######", "##..##", "##..##", "##..##", "##.###", "######", ".####.", "....##"],
      "R": ["#####.", "######", "##..##", "##..##", "######", "#####.", "##.##.", "##..##", "##..##"],
      "S": [".#####", "######", "##....", "####..", ".####.", "..####", "....##", "######", "#####."],
      "T": ["######", "######", "..##..", "..##..", "..##..", "..##..", "..##..", "..##..", "..##.."],
      "U": ["##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "######", ".####."],
      "V": ["##..##", "##..##", "##..##", "##..##", "##..##", ".####.", ".####.", "..##..", "..##.."],
      "W": ["##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "######", "######", "##..##"],
      "X": ["##..##", "##..##", ".####.", "..##..", "..##..", "..##..", ".####.", "##..##", "##..##"],
      "Y": ["##..##", "##..##", "##..##", ".####.", "..##..", "..##..", "..##..", "..##..", "..##.."],
      "Z": ["######", "######", "....##", "...##.", "..##..", ".##...", "##....", "######", "######"],
      "0": [".####.", "######", "##..##", "##.###", "######", "###.##", "##..##", "######", ".####."],
      "1": ["..##..", ".###..", "####..", "..##..", "..##..", "..##..", "..##..", "######", "######"],
      "2": [".####.", "######", "##..##", "....##", "...##.", "..##..", ".##...", "######", "######"],
      "3": [".####.", "######", "##..##", "....##", "..###.", "..###.", "....##", "######", ".####."],
      "4": ["##..##", "##..##", "##..##", "######", "######", "....##", "....##", "....##", "....##"],
      "5": ["######", "######", "##....", "#####.", "######", "....##", "....##", "######", "#####."],
      "6": [".####.", "######", "##....", "#####.", "######", "##..##", "##..##", "######", ".####."],
      "7": ["######", "######", "....##", "....##", "...##.", "..##..", "..##..", "..##..", "..##.."],
      "8": [".####.", "######", "##..##", ".####.", ".####.", "##..##", "##..##", "######", ".####."],
      "9": [".####.", "######", "##..##", "##..##", "######", ".#####", "....##", "######", ".####."],
      " ": ["......", "......", "......", "......", "......", "......", "......", "......", "......"],
      "-": ["....", "....", "....", "####", "####", "....", "....", "....", "...."],
      ".": ["..", "..", "..", "..", "..", "..", "..", "##", "##"],
      "!": ["##", "##", "##", "##", "##", "##", "..", "##", "##"],
      "'": ["##", "##", "##", "..", "..", "..", "..", "..", ".."],
      "/": ["....##", "....##", "...##.", "...##.", "..##..", "..##..", ".##...", "##....", "##...."]
    }
  }
}
```

- [ ] **Step 4: Make `make_logo.py` read it**

Apply this diff. The stencil dicts go; `_rows` goes (glyphs are already row lists); `_compose` takes `dict[str, list[str]]`.

```diff
--- a/tools/make_logo.py
+++ b/tools/make_logo.py
@@ -26,6 +26,7 @@
 
 from __future__ import annotations
 
+import json
 import sys
 from pathlib import Path
 
@@ -53,109 +54,27 @@
 WHITE_RGB = UPLOAD_PALETTE["#"]
 GREEN_RGB = UPLOAD_PALETTE["."]
 
-# -- Stencil alphabet, 12 wide x 14 tall, 3px strokes ----------------------
-# Only the letters the wordmark needs. Squared terminals and closed
+# -- Stencil alphabets ------------------------------------------------------
+# The letterforms live in assets/splash_stencils.json, which the web app's
+# start-screen page reads too (staged to /osd/stencils.json), so there is
+# one source for both. ``big`` is 14 px tall with 3 px strokes, ``small`` is
+# 9 px tall; glyphs may differ in width. Squared terminals and closed
 # counters: military stencil weight without the breaks, which cost
 # legibility on a noisy analog feed for no real gain.
 
-BIG_STENCIL = {
-    "A": """
-...######...
-..########..
-.###....###.
-###......###
-###......###
-###......###
-############
-############
-###......###
-###......###
-###......###
-###......###
-###......###
-###......###
-""",
-    "R": """
-##########..
-###########.
-###......###
-###......###
-###......###
-###########.
-##########..
-###...###...
-###....###..
-###.....###.
-###......###
-###......###
-###......###
-###......###
-""",
-    "M": """
-###......###
-####....####
-############
-############
-###.####.###
-###..##..###
-###......###
-###......###
-###......###
-###......###
-###......###
-###......###
-###......###
-###......###
-""",
-    "Y": """
-###......###
-###......###
-.###....###.
-..###..###..
-...######...
-....####....
-....####....
-....####....
-....####....
-....####....
-....####....
-....####....
-....####....
-....####....
-""",
-    "J": """
-......######
-......######
-.........###
-.........###
-.........###
-.........###
-.........###
-.........###
-.........###
-###......###
-###......###
-####....####
-.##########.
-..########..
-""",
-    " ": "\n".join(["." * 12] * 14),
-}
+STENCILS_PATH = REPO_ROOT / "assets" / "splash_stencils.json"
 
-# -- Subtitle alphabet, 6 wide x 9 tall ------------------------------------
 
-SMALL_STENCIL = {
-    "T": "######|######|..##..|..##..|..##..|..##..|..##..|..##..|..##..",
-    "A": ".####.|######|##..##|##..##|######|######|##..##|##..##|##..##",
-    "C": ".#####|######|##....|##....|##....|##....|##....|######|.#####",
-    "I": "######|######|..##..|..##..|..##..|..##..|..##..|######|######",
-    "L": "##....|##....|##....|##....|##....|##....|##....|######|######",
-    "O": ".####.|######|##..##|##..##|##..##|##..##|##..##|######|.####.",
-    "S": ".#####|######|##....|####..|.####.|..####|....##|######|#####.",
-    "D": "#####.|######|##..##|##..##|##..##|##..##|##..##|######|#####.",
-    " ": "......|......|......|......|......|......|......|......|......",
-}
+def load_stencils(path: Path = STENCILS_PATH) -> dict[str, dict[str, list[str]]]:
+    """Read the stencil file: ``{"big": {"A": [rows...]}, "small": {...}}``."""
+    data = json.loads(path.read_text(encoding="utf-8"))
+    return {name: data[name]["glyphs"] for name in ("big", "small")}
 
+
+_STENCILS = load_stencils()
+BIG_STENCIL = _STENCILS["big"]
+SMALL_STENCIL = _STENCILS["small"]
+
 WORDMARK_TEXT = "ARMY JAY"
 SUBTITLE_TEXT = "TACTICAL OSD"
 
@@ -169,15 +88,9 @@
 RULE_THICKNESS = 3
 
 
-def _rows(spec: str) -> list[str]:
-    if "|" in spec:
-        return spec.split("|")
-    return [line for line in spec.split("\n") if line.strip()]
-
-
-def _compose(font: dict[str, str], text: str, gap: int) -> list[str]:
+def _compose(font: dict[str, list[str]], text: str, gap: int) -> list[str]:
     """Lay a string out in a stencil font, returning white-only rows."""
-    glyphs = [_rows(font[ch]) for ch in text]
+    glyphs = [font[ch] for ch in text]
     height = len(glyphs[0])
     filler = "." * gap
     return [filler.join(g[y] for g in glyphs) for y in range(height)]
```

- [ ] **Step 5: Prove the raster did not move**

Run:
```bash
python3 tools/make_logo.py -o /tmp/logo-check.png && python3 -c "
from PIL import Image
a = Image.open('/tmp/logo-check.png').convert('RGB'); b = Image.open('assets/logo_288x72.png').convert('RGB')
print('pixel-identical:', a.tobytes() == b.tobytes())"
```
Expected: `pixel-identical: True`. Do **not** overwrite `assets/logo_288x72.png`: the picture is identical but the PNG bytes differ by encoder, and the committed file is what `glyphs/logo.py` was sliced from.

- [ ] **Step 6: Add the stencil sheet to the previews**

```diff
--- a/tools/build_previews.py
+++ b/tools/build_previews.py
@@ -14,6 +14,10 @@
     arrow and the crosshair -- so the visual balance can be judged rather
     than guessed at.
 
+And once, not per variant, ``stencil_sheet.png``: both stencil alphabets
+from ``assets/splash_stencils.json`` at 4x, every character the start-screen
+page can set, so the letterforms can be reviewed as a set.
+
 The mock screen is a PAL analog layout, 30 columns by 16 rows of 12x18
 glyphs, drawn from the font itself. Nothing here is mocked up in another
 typeface: if it looks wrong on this sheet, it looks wrong in the goggles.
@@ -32,6 +36,7 @@
 
 from PIL import Image, ImageDraw
 
+from make_logo import load_stencils
 from mcm_decode import read_font
 from mcm_encode import GLYPH_HEIGHT, GLYPH_WIDTH, Glyph
 from render import (
@@ -179,8 +184,59 @@
     return sheet
 
 
+STENCIL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.!'/"
+STENCIL_PER_ROW = 13
+STENCIL_GAP = 2
+
+
+def render_stencil_sheet(
+    stencils: dict[str, dict[str, list[str]]] | None = None, scale: int = 4
+) -> Image.Image:
+    """Both stencil alphabets, white on the panel colour, one font per block."""
+    stencils = stencils or load_stencils()
+    blocks: list[Image.Image] = []
+    for name in ("big", "small"):
+        font = stencils[name]
+        height = len(next(iter(font.values())))
+        lines = [
+            STENCIL_CHARS[i : i + STENCIL_PER_ROW]
+            for i in range(0, len(STENCIL_CHARS), STENCIL_PER_ROW)
+        ]
+        rows: list[Image.Image] = []
+        for line in lines:
+            width = sum(len(font[c][0]) for c in line) + STENCIL_GAP * (len(line) - 1)
+            row = Image.new("RGB", (width, height), PANEL_BG)
+            x = 0
+            for char in line:
+                glyph = font[char]
+                for y, spec in enumerate(glyph):
+                    for dx, cell in enumerate(spec):
+                        if cell == "#":
+                            row.putpixel((x + dx, y), (255, 255, 255))
+                x += len(glyph[0]) + STENCIL_GAP
+            rows.append(row)
+        block_w = max(r.width for r in rows)
+        block_h = sum(r.height + STENCIL_GAP * 2 for r in rows)
+        block = Image.new("RGB", (block_w, block_h), PANEL_BG)
+        y = 0
+        for r in rows:
+            block.paste(r, (0, y))
+            y += r.height + STENCIL_GAP * 2
+        blocks.append(block)
+
+    margin = 4
+    width = max(b.width for b in blocks) + margin * 2
+    height = sum(b.height + margin * 2 for b in blocks)
+    sheet = Image.new("RGB", (width, height), PANEL_BG)
+    y = margin
+    for b in blocks:
+        sheet.paste(b, (margin, y))
+        y += b.height + margin * 2
+    return sheet.resize((width * scale, height * scale), Image.Resampling.NEAREST)
+
+
 def build(variant_paths: Sequence[Path]) -> list[Path]:
-    written: list[Path] = []
+    written: list[Path] = [save(render_stencil_sheet(), PREVIEW_DIR / "stencil_sheet.png")]
     for path in variant_paths:
         glyphs = read_font(path)
         name = path.stem
```

Run: `python3 tools/build_previews.py && git status --short previews/`
Expected: `wrote 13 images to previews`; `?? previews/stencil_sheet.png` is the only change. If the variant PNGs show as modified they are byte-different re-encodes of identical pictures — revert them: `git checkout -- previews/*_glyph_sheet.png previews/*_logo_preview.png`. Open `previews/stencil_sheet.png`: both alphabets, A–Z 0–9 and the five marks, white on near-black.

- [ ] **Step 7: Run the tests, the whole Python suite, and ruff**

Run: `python3 -m unittest discover -s tests 2>&1 | tail -3 && (ruff check . || uvx ruff check --config ruff.toml tools tests)`
Expected: `Ran 76 tests ... OK` (68 + 8) and `All checks passed!`.

- [ ] **Step 8: Note it in the README**

In `README.md`'s "Repo layout" block, change the `assets/` lines to:

```
├── assets/
│   ├── logo_288x72.png    boot splash source raster
│   ├── splash_stencils.json  the stencil alphabets, read by make_logo.py and the website
│   └── references/        decoded stock fonts, reference only
```

and the `make_logo.py` line to:

```
│   ├── make_logo.py       draws assets/logo_288x72.png from splash_stencils.json
```

- [ ] **Step 9: Commit**

```bash
cd .
git add assets/splash_stencils.json tools/make_logo.py tools/build_previews.py tests/test_stencils.py previews/stencil_sheet.png README.md
git commit -m "$(cat <<'EOF'
Move the splash stencils to a shared file and complete the alphabet

assets/splash_stencils.json now holds both stencil fonts: the original
wordmark letters moved verbatim, plus the rest of A-Z, 0-9 and five
marks so the website's start-screen page can set any callsign. The
splash raster is pixel-identical, asserted by test rather than by PNG
bytes. previews/stencil_sheet.png shows both alphabets for review.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Web core — raster, stencils, template, staging

**Files:**
- Create: `web/src/lib/splash/raster.ts`, `web/src/lib/splash/stencils.ts`, `web/src/lib/splash/template.ts`
- Test: `web/src/lib/splash/__tests__/raster.test.ts`, `.../stencils.test.ts`, `.../template.test.ts`
- Modify: `web/scripts/stage-osd-assets.mjs`

**Interfaces:**
- Consumes: `assets/splash_stencils.json` (Task 1); `rasterToTiles`, `UPLOAD_PALETTE`, `LOGO_*` from `web/src/lib/mcm/logo.ts`.
- Produces: `Raster = Pixel[]` (288 × 72 row-major), `PaintLayer`, `emptyRaster`, `maskToRaster`, `outlineMask`, `applyPaint`, `rasterToRgba`, `rasterToGlyphs`, `isRasterEmpty`, `brushOffsets`; `StencilFont`, `Stencils`, `composeText`, `validateStencils`, `LETTER_GAP`; `renderTemplate(stencils, {big, small, rules}) -> {raster, big: LineReport, small: LineReport}`.

- [ ] **Step 1: Stage the two new assets**

```diff
--- a/web/scripts/stage-osd-assets.mjs
+++ b/web/scripts/stage-osd-assets.mjs
@@ -5,7 +5,7 @@
 // repo root is their only author, and duplicating them would let the two
 // copies drift. This runs on predev and prebuild.
 
-import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
+import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
 import { dirname, join, resolve } from 'node:path'
 import { fileURLToPath } from 'node:url'
 
@@ -59,6 +59,20 @@
 const fonts = copyDir('fonts', 'fonts', '.mcm')
 copyDir('previews', 'previews', '.png')
 
+// The start-screen page needs two more things from the repo: the stencil
+// alphabets the Python splash builder also reads, and Betaflight's stock
+// font as an export base. Both are vendored at the root, neither is ours to
+// duplicate under web/.
+function copyFile(fromRel, toRel) {
+  const from = join(REPO, fromRel)
+  if (!existsSync(from)) fail(`missing ${fromRel}`)
+  mkdirSync(dirname(join(DEST, toRel)), { recursive: true })
+  copyFileSync(from, join(DEST, toRel))
+  console.log(`[stage-osd-assets] ${fromRel} -> public/osd/${toRel}`)
+}
+copyFile('assets/splash_stencils.json', 'stencils.json')
+copyFile('assets/references/stock/default_v2.mcm', 'fonts/betaflight_default.mcm')
+
 const variants = readVariants().map((v) => {
   const craftName = v.output.replace(/\.mcm$/, '_craftname.mcm')
   return { ...v, craftName: fonts.includes(craftName) ? craftName : null }
```

Run: `cd web && node scripts/stage-osd-assets.mjs | tail -3 && ls public/osd/stencils.json public/osd/fonts/betaflight_default.mcm`
Expected: both files listed.

- [ ] **Step 2: Write the failing tests**

Create `web/src/lib/splash/__tests__/raster.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  RASTER_HEIGHT,
  RASTER_SIZE,
  RASTER_WIDTH,
  applyPaint,
  brushOffsets,
  emptyRaster,
  isRasterEmpty,
  maskToRaster,
  outlineMask,
  rasterToGlyphs,
  rasterToRgba,
} from '../raster'

const at = (x: number, y: number) => y * RASTER_WIDTH + x

describe('outlineMask', () => {
  it('gives a lone white pixel eight black neighbours', () => {
    const mask = new Array<boolean>(RASTER_SIZE).fill(false)
    mask[at(10, 10)] = true
    const halo = outlineMask(mask)
    const black = halo.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
    expect(black.sort((a, b) => a - b)).toEqual(
      [at(9, 9), at(10, 9), at(11, 9), at(9, 10), at(11, 10), at(9, 11), at(10, 11), at(11, 11)].sort(
        (a, b) => a - b,
      ),
    )
  })

  it('never marks a white pixel as halo and stays inside the raster', () => {
    const mask = new Array<boolean>(RASTER_SIZE).fill(false)
    mask[at(0, 0)] = true
    mask[at(RASTER_WIDTH - 1, RASTER_HEIGHT - 1)] = true
    const halo = outlineMask(mask)
    expect(halo[at(0, 0)]).toBe(false)
    expect(halo.filter(Boolean)).toHaveLength(6)
  })
})

describe('maskToRaster', () => {
  it('maps white and halo, or white only', () => {
    const mask = new Array<boolean>(RASTER_SIZE).fill(false)
    mask[at(5, 5)] = true
    const outlined = maskToRaster(mask, true)
    expect(outlined[at(5, 5)]).toBe('white')
    expect(outlined[at(4, 5)]).toBe('black')
    const plain = maskToRaster(mask, false)
    expect(plain[at(4, 5)]).toBe('transparent')
  })
})

describe('applyPaint', () => {
  it('overrides pixels without mutating the base and ignores out-of-range offsets', () => {
    const base = emptyRaster()
    const out = applyPaint(base, { [at(1, 1)]: 'white', [-5]: 'black', [RASTER_SIZE]: 'black' })
    expect(out[at(1, 1)]).toBe('white')
    expect(base[at(1, 1)]).toBe('transparent')
    expect(out.filter((p) => p !== 'transparent')).toHaveLength(1)
  })
})

describe('brushOffsets', () => {
  it('covers 1, 4 and 9 pixels and clips at the edges', () => {
    expect(brushOffsets(10, 10, 1)).toEqual([at(10, 10)])
    expect(brushOffsets(10, 10, 2).sort((a, b) => a - b)).toEqual(
      [at(10, 10), at(11, 10), at(10, 11), at(11, 11)].sort((a, b) => a - b),
    )
    expect(brushOffsets(10, 10, 3)).toHaveLength(9)
    expect(brushOffsets(0, 0, 3)).toHaveLength(4)
    expect(brushOffsets(RASTER_WIDTH - 1, RASTER_HEIGHT - 1, 2)).toEqual([at(RASTER_WIDTH - 1, RASTER_HEIGHT - 1)])
  })
})

describe('rasterToRgba / rasterToGlyphs', () => {
  it('uses the upload palette and slices into 96 tiles', () => {
    const raster = emptyRaster()
    raster[at(0, 0)] = 'white'
    raster[at(1, 0)] = 'black'
    const rgba = rasterToRgba(raster)
    expect([...rgba.subarray(0, 12)]).toEqual([255, 255, 255, 255, 0, 0, 0, 255, 0, 255, 0, 255])
    const tiles = rasterToGlyphs(raster)
    expect(tiles).toHaveLength(96)
    expect(tiles[0].pixels[0]).toBe('white')
    expect(tiles[0].pixels[1]).toBe('black')
    expect(isRasterEmpty(raster)).toBe(false)
    expect(isRasterEmpty(emptyRaster())).toBe(true)
  })
})
```

Create `web/src/lib/splash/__tests__/stencils.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { composeText, validateStencils } from '../stencils'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const RAW = JSON.parse(readFileSync(resolve(REPO, 'assets/splash_stencils.json'), 'utf8'))
const STENCILS = validateStencils(RAW)

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -.!'/"

describe('assets/splash_stencils.json', () => {
  it('covers the whole character set in both fonts', () => {
    for (const font of [STENCILS.big, STENCILS.small]) {
      for (const char of CHARSET) expect(font.glyphs, char).toHaveProperty([char])
    }
  })

  it('is 14 and 9 rows tall', () => {
    expect(STENCILS.big.height).toBe(14)
    expect(STENCILS.small.height).toBe(9)
  })
})

describe('validateStencils', () => {
  it('rejects a ragged glyph and a wrong height', () => {
    const ragged = structuredClone(RAW)
    ragged.big.glyphs.A[3] = '###'
    expect(() => validateStencils(ragged)).toThrow('big "A" has a malformed row')
    const short = structuredClone(RAW)
    short.small.glyphs.T.pop()
    expect(() => validateStencils(short)).toThrow('small "T" is not 9 rows tall')
    expect(() => validateStencils({ big: RAW.big })).toThrow('no "small" font')
  })
})

describe('composeText', () => {
  it('joins glyphs with a 2 px gap and reports the width', () => {
    const { rows, width } = composeText(STENCILS.small, 'IT')
    expect(width).toBe(6 + 2 + 6)
    expect(rows).toHaveLength(9)
    expect(rows[0]).toBe('######..######')
  })

  it('uppercases, and names unsupported characters once each', () => {
    const { rows, width, unsupported } = composeText(STENCILS.big, 'a@b@~')
    expect(unsupported).toEqual(['@', '~'])
    expect(width).toBe(12 + 2 + 12)
    expect(rows[0]).toBe(STENCILS.big.glyphs.A[0] + '..' + STENCILS.big.glyphs.B[0])
  })

  it('handles variable-width glyphs', () => {
    const { width } = composeText(STENCILS.big, 'I1')
    expect(width).toBe(7 + 2 + 8)
  })

  it('returns empty rows and width 0 for nothing renderable', () => {
    const { rows, width } = composeText(STENCILS.big, '@@')
    expect(width).toBe(0)
    expect(rows).toEqual(new Array(14).fill(''))
  })
})
```

Create `web/src/lib/splash/__tests__/template.test.ts` — the first test here is the decisive one:

```ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodeFont } from '../../mcm/decode'
import { LOGO_START, RESERVED_INDEX, TILE_COUNT, isTileEmpty } from '../../mcm/logo'
import { rasterToGlyphs } from '../raster'
import { validateStencils } from '../stencils'
import { renderTemplate } from '../template'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const STENCILS = validateStencils(
  JSON.parse(readFileSync(resolve(REPO, 'assets/splash_stencils.json'), 'utf8')),
)
const FULL = decodeFont(readFileSync(resolve(REPO, 'fonts/armyjay_full.mcm'), 'latin1'))

describe('renderTemplate', () => {
  // The decisive test: the web compositor must reproduce the shipped splash
  // tile for tile. That pins the stencil port, the outline, the gaps, the
  // rules and the centring against an artifact CI keeps current.
  it('reproduces the Army Jay splash in fonts/armyjay_full.mcm exactly', () => {
    const { raster, big, small } = renderTemplate(STENCILS, {
      big: 'ARMY JAY',
      small: 'TACTICAL OSD',
      rules: true,
    })
    expect(big).toEqual({ width: 110, overflow: 0, unsupported: [], drawn: true })
    expect(small).toEqual({ width: 94, overflow: 0, unsupported: [], drawn: true })

    const tiles = rasterToGlyphs(raster)
    expect(tiles).toHaveLength(TILE_COUNT)
    for (let i = 0; i < TILE_COUNT; i += 1) {
      const index = LOGO_START + i
      if (index === RESERVED_INDEX) {
        expect(isTileEmpty(tiles[i])).toBe(true)
        continue
      }
      expect(tiles[i].pixels, `tile 0x${index.toString(16)}`).toEqual(FULL[index].pixels)
    }
  })

  it('reports a line that is too wide and leaves it undrawn', () => {
    const { raster, big } = renderTemplate(STENCILS, { big: 'W'.repeat(25), small: '', rules: false })
    expect(big.overflow).toBe(25 * 12 + 24 * 2 - 288)
    expect(big.drawn).toBe(false)
    expect(raster.every((p) => p === 'transparent')).toBe(true)
  })

  it('names unsupported characters and still draws the rest', () => {
    const { big, raster } = renderTemplate(STENCILS, { big: 'a@b#a', small: '', rules: false })
    expect(big.unsupported).toEqual(['@', '#'])
    expect(big.drawn).toBe(true)
    expect(raster.some((p) => p === 'white')).toBe(true)
  })

  it('draws nothing for an empty template', () => {
    const { raster, big, small } = renderTemplate(STENCILS, { big: '', small: '', rules: false })
    expect(raster.every((p) => p === 'transparent')).toBe(true)
    expect(big.drawn).toBe(false)
    expect(small.width).toBe(0)
  })
})
```

- [ ] **Step 3: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/splash`
Expected: 3 files FAIL on `Failed to resolve import`.

- [ ] **Step 4: Write the three modules**

Create `web/src/lib/splash/raster.ts`:

```ts
import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../mcm/decode'
import { LOGO_HEIGHT, LOGO_WIDTH, UPLOAD_PALETTE, rasterToTiles } from '../mcm/logo'
import type { Glyph, Pixel } from '../mcm/types'

/** The 288 x 72 start screen, row-major, one Pixel per cell. */
export type Raster = Pixel[]

export const RASTER_WIDTH = LOGO_WIDTH
export const RASTER_HEIGHT = LOGO_HEIGHT
export const RASTER_SIZE = RASTER_WIDTH * RASTER_HEIGHT

/** Sparse pixel overrides: raster offset (y * 288 + x) -> value. */
export type PaintLayer = Record<number, Pixel>

export function emptyRaster(): Raster {
  return new Array<Pixel>(RASTER_SIZE).fill('transparent')
}

/** A white-only mask (true = white) to a raster, with or without the black halo. */
export function maskToRaster(mask: boolean[], outline: boolean): Raster {
  const raster = emptyRaster()
  const halo = outline ? outlineMask(mask) : null
  for (let i = 0; i < RASTER_SIZE; i += 1) {
    if (mask[i]) raster[i] = 'white'
    else if (halo && halo[i]) raster[i] = 'black'
  }
  return raster
}

/**
 * 1 px black halo around the white mask, over the whole raster rather than
 * per tile, so outlines stay continuous across tile seams. A port of
 * tools/make_logo.py's outline_mask.
 */
export function outlineMask(mask: boolean[]): boolean[] {
  const halo = new Array<boolean>(RASTER_SIZE).fill(false)
  for (let y = 0; y < RASTER_HEIGHT; y += 1) {
    for (let x = 0; x < RASTER_WIDTH; x += 1) {
      const i = y * RASTER_WIDTH + x
      if (mask[i]) continue
      halo[i] = neighbours(mask, x, y)
    }
  }
  return halo
}

function neighbours(mask: boolean[], x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= RASTER_WIDTH || ny >= RASTER_HEIGHT) continue
      if (mask[ny * RASTER_WIDTH + nx]) return true
    }
  }
  return false
}

/** The base raster with the paint layer laid over it. Neither input is mutated. */
export function applyPaint(base: Raster, paint: PaintLayer): Raster {
  const out = base.slice()
  for (const key of Object.keys(paint)) {
    const offset = Number(key)
    if (offset >= 0 && offset < RASTER_SIZE) out[offset] = paint[offset]
  }
  return out
}

/** RGBA in Configurator's upload palette: black, white, pure green for transparent. */
export function rasterToRgba(raster: Raster): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(RASTER_SIZE * 4)
  for (let i = 0; i < RASTER_SIZE; i += 1) {
    const [r, g, b] = UPLOAD_PALETTE[raster[i]]
    rgba[i * 4] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

/** The raster as the 96 splash tiles, row-major from 0xA0. */
export function rasterToGlyphs(raster: Raster): Glyph[] {
  return rasterToTiles(rasterToRgba(raster), RASTER_WIDTH, RASTER_HEIGHT, { strict: true })
}

export function isRasterEmpty(raster: Raster): boolean {
  return raster.every((pixel) => pixel === 'transparent')
}

/** Offsets a brush of `size` px covers when centred as near as possible on (x, y). */
export function brushOffsets(x: number, y: number, size: 1 | 2 | 3): number[] {
  const start = size === 3 ? -1 : 0
  const end = size === 1 ? 0 : 1
  const offsets: number[] = []
  for (let dy = start; dy <= end; dy += 1) {
    for (let dx = start; dx <= end; dx += 1) {
      const px = x + dx
      const py = y + dy
      if (px < 0 || py < 0 || px >= RASTER_WIDTH || py >= RASTER_HEIGHT) continue
      offsets.push(py * RASTER_WIDTH + px)
    }
  }
  return offsets
}

export { GLYPH_HEIGHT, GLYPH_WIDTH }
```

Create `web/src/lib/splash/stencils.ts`:

```ts
/**
 * The stencil alphabets the Army Jay splash is set in, from
 * assets/splash_stencils.json (staged to /osd/stencils.json). The Python
 * splash builder reads the same file, so there is one set of letterforms.
 */
export interface StencilFont {
  height: number
  /** Character -> rows of '.' (clear) and '#' (white); rows share a width. */
  glyphs: Record<string, string[]>
}

export interface Stencils {
  big: StencilFont
  small: StencilFont
}

/** Pixels between letters, both fonts. */
export const LETTER_GAP = 2

export interface Composed {
  /** `font.height` rows; empty strings when the text has no renderable characters. */
  rows: string[]
  width: number
  /** Characters with no glyph, in first-seen order, after uppercasing. */
  unsupported: string[]
}

export function normalizeText(text: string): string {
  return text.toUpperCase()
}

/** Lay a string out in a stencil font: a port of make_logo.py's _compose. */
export function composeText(font: StencilFont, text: string): Composed {
  const unsupported: string[] = []
  const glyphs: string[][] = []
  for (const char of normalizeText(text)) {
    const glyph = font.glyphs[char]
    if (glyph) glyphs.push(glyph)
    else if (!unsupported.includes(char)) unsupported.push(char)
  }
  if (glyphs.length === 0) {
    return { rows: new Array<string>(font.height).fill(''), width: 0, unsupported }
  }
  const filler = '.'.repeat(LETTER_GAP)
  const rows: string[] = []
  for (let y = 0; y < font.height; y += 1) {
    rows.push(glyphs.map((glyph) => glyph[y]).join(filler))
  }
  return { rows, width: rows[0].length, unsupported }
}

/** Throws unless the file has the shape the compositor relies on. */
export function validateStencils(data: unknown): Stencils {
  if (!data || typeof data !== 'object') throw new Error('stencils.json is not an object')
  const stencils = data as Record<string, unknown>
  for (const name of ['big', 'small'] as const) {
    const font = stencils[name] as StencilFont | undefined
    if (!font || typeof font.height !== 'number' || !font.glyphs) {
      throw new Error(`stencils.json has no "${name}" font`)
    }
    for (const [char, rows] of Object.entries(font.glyphs)) {
      if (!Array.isArray(rows) || rows.length !== font.height) {
        throw new Error(`stencils.json: ${name} "${char}" is not ${font.height} rows tall`)
      }
      const width = rows[0]?.length ?? 0
      for (const row of rows) {
        if (typeof row !== 'string' || row.length !== width || !/^[.#]*$/.test(row)) {
          throw new Error(`stencils.json: ${name} "${char}" has a malformed row`)
        }
      }
    }
  }
  return data as Stencils
}
```

Create `web/src/lib/splash/template.ts`:

```ts
import { GLYPH_HEIGHT, RASTER_HEIGHT, RASTER_SIZE, RASTER_WIDTH, maskToRaster } from './raster'
import type { Raster } from './raster'
import { composeText } from './stencils'
import type { Stencils } from './stencils'

/** The rules' geometry, from tools/make_logo.py. */
export const RULE_LEFT = 24
export const RULE_RIGHT = RASTER_WIDTH - 24
export const RULE_THICKNESS = 3
const CHEVRON_STEPS = 5

/** Which tile row each line sits in. */
export const BIG_ROW = 1
export const SMALL_ROW = 2

export interface TemplateInput {
  big: string
  small: string
  rules: boolean
}

export interface LineReport {
  /** Rendered width in px, 0 for an empty line. */
  width: number
  /** Pixels by which the line exceeds the raster; 0 when it fits. */
  overflow: number
  unsupported: string[]
  /** True when the line was drawn (non-empty and fits). */
  drawn: boolean
}

export interface TemplateResult {
  raster: Raster
  big: LineReport
  small: LineReport
}

/**
 * Today's splash layout: a big line on tile row 1, a small line on row 2,
 * both centred, rules on rows 0 and 3, and the automatic black outline.
 * A port of make_logo.py's build_mask + render.
 */
export function renderTemplate(stencils: Stencils, input: TemplateInput): TemplateResult {
  const mask = new Array<boolean>(RASTER_SIZE).fill(false)

  if (input.rules) {
    drawRule(mask, 0, true)
    drawRule(mask, 3, false)
  }
  const big = drawLine(mask, stencils, 'big', input.big, BIG_ROW)
  const small = drawLine(mask, stencils, 'small', input.small, SMALL_ROW)

  return { raster: maskToRaster(mask, true), big, small }
}

function drawLine(
  mask: boolean[],
  stencils: Stencils,
  font: keyof Stencils,
  text: string,
  tileRow: number,
): LineReport {
  const composed = composeText(stencils[font], text)
  const overflow = Math.max(0, composed.width - RASTER_WIDTH)
  const drawn = composed.width > 0 && overflow === 0
  if (drawn) {
    const x0 = centre(composed.width, 0, RASTER_WIDTH)
    const y0 = tileRow * GLYPH_HEIGHT + Math.floor((GLYPH_HEIGHT - composed.rows.length) / 2)
    blit(mask, composed.rows, x0, y0)
  }
  return { width: composed.width, overflow, unsupported: composed.unsupported, drawn }
}

/**
 * A 3 px rule vertically centred in a tile row. The top rule carries
 * five-step chevron caps; the bottom one does not -- that is how the shipped
 * splash is drawn, whatever make_logo.py's comment says about "matching".
 */
function drawRule(mask: boolean[], tileRow: number, chevrons: boolean): void {
  const y = tileRow * GLYPH_HEIGHT + Math.floor(GLYPH_HEIGHT / 2) - Math.floor(RULE_THICKNESS / 2)
  fill(mask, RULE_LEFT, y, RULE_RIGHT, y + RULE_THICKNESS)
  if (!chevrons) return
  for (let step = 0; step < CHEVRON_STEPS; step += 1) {
    fill(mask, RULE_LEFT - 4 - step * 3, y - step, RULE_LEFT - 1 - step * 3, y + RULE_THICKNESS + step)
    fill(mask, RULE_RIGHT + 1 + step * 3, y - step, RULE_RIGHT + 4 + step * 3, y + RULE_THICKNESS + step)
  }
}

function blit(mask: boolean[], rows: string[], x0: number, y0: number): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === '#') mask[(y0 + y) * RASTER_WIDTH + x0 + x] = true
    }
  })
}

function fill(mask: boolean[], x0: number, y0: number, x1: number, y1: number): void {
  for (let y = Math.max(0, y0); y < Math.min(RASTER_HEIGHT, y1); y += 1) {
    for (let x = Math.max(0, x0); x < Math.min(RASTER_WIDTH, x1); x += 1) {
      mask[y * RASTER_WIDTH + x] = true
    }
  }
}

function centre(width: number, spanStart: number, spanEnd: number): number {
  return spanStart + Math.floor((spanEnd - spanStart - width) / 2)
}
```

- [ ] **Step 5: Run the tests again**

Run: `cd web && npx vitest run src/lib/splash`
Expected: PASS, 17 tests. If `reproduces the Army Jay splash` fails on a tile, the first thing to check is the chevrons: only the top rule has them.

- [ ] **Step 6: Lint and type-check**

Run: `cd web && npm run lint && npx tsc -b`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
cd web
git add scripts/stage-osd-assets.mjs src/lib/splash/raster.ts src/lib/splash/stencils.ts src/lib/splash/template.ts src/lib/splash/__tests__/raster.test.ts src/lib/splash/__tests__/stencils.test.ts src/lib/splash/__tests__/template.test.ts
git commit -m "$(cat <<'EOF'
Port the splash compositor to the web

composeText, the outline and the template layout are ports of
make_logo.py, reading the same stencil file. The decisive test renders
ARMY JAY / TACTICAL OSD and compares the sliced tiles with glyphs
0xA0-0xFE of the shipped armyjay_full.mcm, pixel for pixel. The build
now stages stencils.json and the stock Betaflight font.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Image, export composition and paint

**Files:**
- Create: `web/src/lib/splash/image.ts`, `web/src/lib/splash/compose.ts`, `web/src/lib/splash/paint.ts`, `web/src/lib/splash/bases.ts`
- Test: `web/src/lib/splash/__tests__/image.test.ts`, `.../compose.test.ts`, `.../paint.test.ts`

**Interfaces:**
- Consumes: Task 2's raster module; `encodeFont`/`decodeFont`.
- Produces: `fitInside(w, h) -> Placement`, `rasterizeImage(rgba, placement, options) -> Raster`, `ImageOptions`, `DEFAULT_IMAGE_OPTIONS`; `fontWithSplash(base, raster) -> {font, droppedReservedInk}`, `splashPng(raster) -> Uint8Array<ArrayBuffer>`; `paintReducer`, `PaintHistory`, `PaintAction`, `EMPTY_HISTORY`; `ExportBase`, `STOCK_BASE`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/splash/__tests__/image.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_IMAGE_OPTIONS, fitInside, rasterizeImage } from '../image'
import { RASTER_WIDTH } from '../raster'

const at = (x: number, y: number) => y * RASTER_WIDTH + x

/** A 2 x 2 RGBA image: white, black / grey 200, transparent. */
const PIXELS = new Uint8ClampedArray([
  255, 255, 255, 255, 0, 0, 0, 255,
  200, 200, 200, 255, 90, 90, 90, 0,
])
const PLACE = { x: 10, y: 20, width: 2, height: 2 }

describe('fitInside', () => {
  it('fits a wide image to the width and centres it vertically', () => {
    expect(fitInside(576, 72)).toEqual({ x: 0, y: 18, width: 288, height: 36 })
  })
  it('fits a tall image to the height and centres it horizontally', () => {
    expect(fitInside(100, 100)).toEqual({ x: 108, y: 0, width: 72, height: 72 })
  })
  it('rejects an empty image', () => {
    expect(() => fitInside(0, 10)).toThrow('no size')
  })
})

describe('rasterizeImage', () => {
  it('thresholds grey to white, leaves the rest transparent, honours alpha', () => {
    const raster = rasterizeImage(PIXELS, PLACE, DEFAULT_IMAGE_OPTIONS)
    expect(raster[at(10, 20)]).toBe('white')
    expect(raster[at(11, 20)]).toBe('transparent')
    expect(raster[at(10, 21)]).toBe('white')
    expect(raster[at(11, 21)]).toBe('transparent')
    expect(raster.filter((p) => p !== 'transparent')).toHaveLength(2)
  })

  it('moves the threshold', () => {
    const raster = rasterizeImage(PIXELS, PLACE, { ...DEFAULT_IMAGE_OPTIONS, threshold: 220 })
    expect(raster[at(10, 20)]).toBe('white')
    expect(raster[at(10, 21)]).toBe('transparent')
  })

  it('inverts', () => {
    const raster = rasterizeImage(PIXELS, PLACE, { ...DEFAULT_IMAGE_OPTIONS, invert: true })
    expect(raster[at(10, 20)]).toBe('transparent')
    expect(raster[at(11, 20)]).toBe('white')
    expect(raster[at(11, 21)]).toBe('transparent') // alpha still wins
  })

  it('puts a black plate behind non-ink pixels when asked', () => {
    const raster = rasterizeImage(PIXELS, PLACE, { ...DEFAULT_IMAGE_OPTIONS, background: 'black' })
    expect(raster[at(11, 20)]).toBe('black')
    expect(raster[at(11, 21)]).toBe('transparent') // transparent source stays transparent
    expect(raster[at(9, 20)]).toBe('transparent') // outside the placement
  })

  it('adds the outline when asked', () => {
    const raster = rasterizeImage(PIXELS, PLACE, { ...DEFAULT_IMAGE_OPTIONS, outline: true })
    expect(raster[at(9, 19)]).toBe('black')
    expect(raster[at(11, 20)]).toBe('black') // halo fills in beside the ink
  })

  it('rejects mismatched data', () => {
    expect(() => rasterizeImage(PIXELS, { ...PLACE, width: 3 }, DEFAULT_IMAGE_OPTIONS)).toThrow('expected 24 bytes')
  })
})
```

Create `web/src/lib/splash/__tests__/compose.test.ts` (it inflates the PNG's IDAT with Node's zlib, so the hand-rolled stored blocks are checked by a real decoder):

```ts
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeFont } from '../../mcm/decode'
import { encodeFont } from '../../mcm/encode'
import { fontWithSplash, splashPng } from '../compose'
import { RASTER_WIDTH, emptyRaster, rasterToRgba } from '../raster'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const STOCK = decodeFont(readFileSync(resolve(REPO, 'assets/references/stock/default_v2.mcm'), 'latin1'))

const at = (x: number, y: number) => y * RASTER_WIDTH + x

describe('fontWithSplash', () => {
  const raster = emptyRaster()
  raster[at(0, 0)] = 'white' // tile 0xA0
  raster[at(RASTER_WIDTH - 1, 71)] = 'white' // tile 0xFF, the reserved one

  it('replaces only the splash block and keeps every other glyph by identity', () => {
    const { font, droppedReservedInk } = fontWithSplash(STOCK, raster)
    expect(font).toHaveLength(256)
    for (let i = 0; i < 0xa0; i += 1) expect(font[i]).toBe(STOCK[i])
    expect(font[0xff]).toBe(STOCK[0xff])
    expect(font[0xa0].pixels[0]).toBe('white')
    expect(font[0xa1].pixels.every((p) => p === 'transparent')).toBe(true)
    expect(droppedReservedInk).toBe(true)
    expect(STOCK[0xa0].pixels[0]).not.toBe('white') // base untouched
  })

  it('encodes to a valid 147463-byte font', () => {
    const { font } = fontWithSplash(STOCK, emptyRaster())
    const text = encodeFont(font)
    expect(text.length).toBe(147463)
    expect(decodeFont(text)).toHaveLength(256)
  })

  it('rejects a base of the wrong size', () => {
    expect(() => fontWithSplash(STOCK.slice(1), raster)).toThrow('255 glyphs')
  })
})

describe('splashPng', () => {
  it('writes a 288 x 72 RGB PNG whose pixels are the upload palette', () => {
    const raster = emptyRaster()
    raster[at(3, 1)] = 'white'
    raster[at(4, 1)] = 'black'
    const png = splashPng(raster)
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const view = new DataView(png.buffer, png.byteOffset)
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe('IHDR')
    expect(view.getUint32(16)).toBe(288)
    expect(view.getUint32(20)).toBe(72)
    expect(png[24]).toBe(8)
    expect(png[25]).toBe(2)

    // Pull the IDAT out and inflate it with Node's zlib: the stored blocks
    // must be a valid stream, and the scanlines must match the raster.
    const idatLength = view.getUint32(33)
    expect(String.fromCharCode(...png.subarray(37, 41))).toBe('IDAT')
    const inflated = inflateSync(png.subarray(41, 41 + idatLength))
    expect(inflated.length).toBe((288 * 3 + 1) * 72)
    const rgba = rasterToRgba(raster)
    const row1 = 1 * (288 * 3 + 1)
    expect(inflated[row1]).toBe(0)
    expect([...inflated.subarray(row1 + 1 + 3 * 3, row1 + 1 + 5 * 3)]).toEqual([255, 255, 255, 0, 0, 0])
    expect([...inflated.subarray(1, 4)]).toEqual([...rgba.subarray(0, 3)])
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe('IEND')
  })
})
```

Create `web/src/lib/splash/__tests__/paint.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EMPTY_HISTORY, paintReducer } from '../paint'
import { RASTER_WIDTH } from '../raster'

const at = (x: number, y: number) => y * RASTER_WIDTH + x
const stroke = (x: number, y: number, color: 'white' | 'black' | 'transparent' = 'white', size: 1 | 2 | 3 = 1) =>
  ({ type: 'stroke', x, y, size, color }) as const

describe('paintReducer', () => {
  it('paints with the brush and records history', () => {
    const h = paintReducer(EMPTY_HISTORY, stroke(5, 5, 'white', 2))
    expect(Object.keys(h.present)).toHaveLength(4)
    expect(h.present[at(6, 6)]).toBe('white')
    expect(h.past).toHaveLength(1)
  })

  it('ignores a stroke that changes nothing', () => {
    const h1 = paintReducer(EMPTY_HISTORY, stroke(5, 5))
    const h2 = paintReducer(h1, stroke(5, 5))
    expect(h2).toBe(h1)
  })

  it('undoes, redoes, and drops the redo stack on a new stroke', () => {
    let h = paintReducer(EMPTY_HISTORY, stroke(1, 1))
    h = paintReducer(h, stroke(2, 2, 'black'))
    h = paintReducer(h, { type: 'undo' })
    expect(h.present[at(2, 2)]).toBeUndefined()
    expect(h.future).toHaveLength(1)
    h = paintReducer(h, { type: 'redo' })
    expect(h.present[at(2, 2)]).toBe('black')
    h = paintReducer(h, { type: 'undo' })
    h = paintReducer(h, stroke(3, 3))
    expect(h.future).toHaveLength(0)
    expect(paintReducer(EMPTY_HISTORY, { type: 'undo' })).toBe(EMPTY_HISTORY)
    expect(paintReducer(EMPTY_HISTORY, { type: 'redo' })).toBe(EMPTY_HISTORY)
  })

  it('clears as one undoable step and loads without history', () => {
    let h = paintReducer(EMPTY_HISTORY, stroke(1, 1))
    h = paintReducer(h, { type: 'clear' })
    expect(h.present).toEqual({})
    expect(paintReducer(h, { type: 'undo' }).present[at(1, 1)]).toBe('white')
    expect(paintReducer(EMPTY_HISTORY, { type: 'clear' })).toBe(EMPTY_HISTORY)
    const loaded = paintReducer(h, { type: 'load', paint: { 7: 'black' } })
    expect(loaded).toEqual({ present: { 7: 'black' }, past: [], future: [] })
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npx vitest run src/lib/splash`
Expected: the three new files FAIL on `Failed to resolve import`; Task 2's 17 still pass.

- [ ] **Step 3: Write the modules**

Create `web/src/lib/splash/image.ts`:

```ts
import { RASTER_HEIGHT, RASTER_WIDTH, emptyRaster, maskToRaster, outlineMask } from './raster'
import type { Raster } from './raster'

export interface ImageOptions {
  /** 0..255; grey at or above it is ink. */
  threshold: number
  invert: boolean
  background: 'transparent' | 'black'
  outline: boolean
}

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  threshold: 128,
  invert: false,
  background: 'transparent',
  outline: false,
}

export interface Placement {
  x: number
  y: number
  width: number
  height: number
}

/** Scale a w x h image to fit inside the raster, aspect kept, centred. */
export function fitInside(width: number, height: number): Placement {
  if (width <= 0 || height <= 0) throw new Error('image has no size')
  const scale = Math.min(RASTER_WIDTH / width, RASTER_HEIGHT / height)
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  return {
    x: Math.floor((RASTER_WIDTH - w) / 2),
    y: Math.floor((RASTER_HEIGHT - h) / 2),
    width: w,
    height: h,
  }
}

/**
 * Threshold an RGBA image already scaled to `placement` and drop it into a
 * raster. Alpha below 128 is transparent whatever the threshold; otherwise
 * grey at or above the threshold is white (inverted: below), and the rest is
 * the chosen background. The outline is computed over the whole raster.
 */
export function rasterizeImage(
  rgba: Uint8ClampedArray | Uint8Array,
  placement: Placement,
  options: ImageOptions,
): Raster {
  const { x: x0, y: y0, width, height } = placement
  if (rgba.length !== width * height * 4) {
    throw new Error(`expected ${width * height * 4} bytes of RGBA, got ${rgba.length}`)
  }
  const mask = new Array<boolean>(RASTER_WIDTH * RASTER_HEIGHT).fill(false)
  const plate = new Array<boolean>(RASTER_WIDTH * RASTER_HEIGHT).fill(false)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x0 + x
      const py = y0 + y
      if (px < 0 || py < 0 || px >= RASTER_WIDTH || py >= RASTER_HEIGHT) continue
      const i = (y * width + x) * 4
      if (rgba[i + 3] < 128) continue
      const grey = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2])
      const ink = options.invert ? grey < options.threshold : grey >= options.threshold
      const offset = py * RASTER_WIDTH + px
      if (ink) mask[offset] = true
      else plate[offset] = true
    }
  }
  const raster = options.background === 'black' ? withPlate(mask, plate) : emptyRaster()
  const inked = maskToRaster(mask, options.outline)
  for (let i = 0; i < raster.length; i += 1) {
    if (inked[i] !== 'transparent') raster[i] = inked[i]
  }
  return raster
}

function withPlate(mask: boolean[], plate: boolean[]): Raster {
  const raster = emptyRaster()
  for (let i = 0; i < raster.length; i += 1) if (plate[i] && !mask[i]) raster[i] = 'black'
  return raster
}

export { outlineMask }
```

Create `web/src/lib/splash/compose.ts`:

```ts
import { GLYPH_COUNT } from '../mcm/decode'
import { LOGO_START, RESERVED_INDEX, TILE_COUNT, isTileEmpty } from '../mcm/logo'
import type { Font } from '../mcm/types'
import { RASTER_HEIGHT, RASTER_WIDTH, rasterToGlyphs, rasterToRgba } from './raster'
import type { Raster } from './raster'

/**
 * The base font with the raster in its splash block. Glyphs 0xA0-0xFE are
 * replaced by the sliced tiles; 0xFF (the end-of-font marker) and every
 * other glyph are the base's own objects, untouched.
 */
export function fontWithSplash(base: Font, raster: Raster): { font: Font; droppedReservedInk: boolean } {
  if (base.length !== GLYPH_COUNT) throw new Error(`base font has ${base.length} glyphs, expected ${GLYPH_COUNT}`)
  const tiles = rasterToGlyphs(raster)
  const font = base.slice()
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const index = LOGO_START + i
    if (index === RESERVED_INDEX) continue
    font[index] = tiles[i]
  }
  return { font, droppedReservedInk: !isTileEmpty(tiles[TILE_COUNT - 1]) }
}

/**
 * The raster as a 288 x 72 PNG in Configurator's three upload colours.
 * Hand-rolled with stored (uncompressed) deflate blocks: no dependency, no
 * canvas, deterministic bytes, and 62 KB is nothing for a one-off download.
 */
export function splashPng(raster: Raster): Uint8Array<ArrayBuffer> {
  const rgba = rasterToRgba(raster)
  const stride = RASTER_WIDTH * 3
  const scanlines = new Uint8Array((stride + 1) * RASTER_HEIGHT)
  for (let y = 0; y < RASTER_HEIGHT; y += 1) {
    const row = y * (stride + 1)
    scanlines[row] = 0 // filter: none
    for (let x = 0; x < RASTER_WIDTH; x += 1) {
      const src = (y * RASTER_WIDTH + x) * 4
      const dst = row + 1 + x * 3
      scanlines[dst] = rgba[src]
      scanlines[dst + 1] = rgba[src + 1]
      scanlines[dst + 2] = rgba[src + 2]
    }
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, RASTER_WIDTH)
  view.setUint32(4, RASTER_HEIGHT)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', storedDeflate(scanlines)),
    chunk('IEND', new Uint8Array(0)),
  ])
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** zlib stream of stored blocks: header, <=65535-byte blocks, adler32. */
function storedDeflate(data: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])]
  for (let offset = 0; offset < data.length || offset === 0; offset += 65535) {
    const slice = data.subarray(offset, offset + 65535)
    const final = offset + 65535 >= data.length ? 1 : 0
    const header = new Uint8Array(5)
    header[0] = final
    header[1] = slice.length & 0xff
    header[2] = slice.length >> 8
    header[3] = ~slice.length & 0xff
    header[4] = (~slice.length >> 8) & 0xff
    blocks.push(header, slice)
    if (final) break
  }
  const adler = new Uint8Array(4)
  new DataView(adler.buffer).setUint32(0, adler32(data))
  blocks.push(adler)
  return concat(blocks)
}

function adler32(data: Uint8Array): number {
  let a = 1
  let b = 0
  for (let i = 0; i < data.length; i += 1) {
    a = (a + data[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
```

Create `web/src/lib/splash/paint.ts`:

```ts
import type { Pixel } from '../mcm/types'
import { brushOffsets } from './raster'
import type { PaintLayer } from './raster'

export interface PaintHistory {
  present: PaintLayer
  past: PaintLayer[]
  future: PaintLayer[]
}

export const EMPTY_HISTORY: PaintHistory = { present: {}, past: [], future: [] }
const MAX_HISTORY = 100

export type PaintAction =
  | { type: 'stroke'; x: number; y: number; size: 1 | 2 | 3; color: Pixel }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear' }
  | { type: 'load'; paint: PaintLayer }

function push(history: PaintHistory, next: PaintLayer): PaintHistory {
  return { present: next, past: [...history.past, history.present].slice(-MAX_HISTORY), future: [] }
}

/**
 * The paint layer with undo/redo. One stroke action per pointer event; a
 * stroke that changes nothing leaves the history alone so a stationary drag
 * does not fill the undo stack.
 */
export function paintReducer(history: PaintHistory, action: PaintAction): PaintHistory {
  switch (action.type) {
    case 'stroke': {
      const offsets = brushOffsets(action.x, action.y, action.size)
      if (offsets.every((o) => history.present[o] === action.color)) return history
      const next = { ...history.present }
      for (const offset of offsets) next[offset] = action.color
      return push(history, next)
    }
    case 'undo': {
      if (history.past.length === 0) return history
      const previous = history.past[history.past.length - 1]
      return { present: previous, past: history.past.slice(0, -1), future: [history.present, ...history.future] }
    }
    case 'redo': {
      if (history.future.length === 0) return history
      const [next, ...rest] = history.future
      return { present: next, past: [...history.past, history.present], future: rest }
    }
    case 'clear':
      return Object.keys(history.present).length === 0 ? history : push(history, {})
    case 'load':
      return { present: action.paint, past: [], future: [] }
  }
}
```

Create `web/src/lib/splash/bases.ts`:

```ts
/** A font the start screen can be exported into. */
export interface ExportBase {
  id: string
  /** Filename under /osd/fonts/. */
  output: string
  label: string
  note?: string
}

/** Betaflight's own default font, vendored as a reference and staged for the export page. */
export const STOCK_BASE: ExportBase = {
  id: 'betaflight_default',
  output: 'betaflight_default.mcm',
  label: "Betaflight's default font",
  note: 'GPL-3.0 — a font exported from it carries the same licence.',
}
```

- [ ] **Step 4: Run the tests again**

Run: `cd web && npx vitest run src/lib/splash`
Expected: PASS, 34 tests.

- [ ] **Step 5: Lint and type-check**

Run: `cd web && npm run lint && npx tsc -b`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd web
git add src/lib/splash/image.ts src/lib/splash/compose.ts src/lib/splash/paint.ts src/lib/splash/bases.ts src/lib/splash/__tests__/image.test.ts src/lib/splash/__tests__/compose.test.ts src/lib/splash/__tests__/paint.test.ts
git commit -m "$(cat <<'EOF'
Add the image, export and paint logic for the start screen

rasterizeImage thresholds a fitted picture to the three OSD colours;
fontWithSplash drops the raster into a base font's splash block and
leaves 0xFF alone; splashPng writes the Configurator PNG with stored
deflate blocks so there is no dependency; paintReducer is the undo
history for pixel overrides.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: One IndexedDB, version 2

**Files:**
- Create: `web/src/utils/osdDb.ts`, `web/src/utils/splashStorage.ts`
- Test: `web/src/utils/__tests__/osdDb.test.ts`
- Modify: `web/src/utils/fontStorage.ts` (replace wholesale; its exported API is unchanged)

**Interfaces:**
- Produces: `openDB`, `upgrade`, `withStore(storeName, mode, fn)`, `reqAsPromise`, `FONT_EDITS_STORE`, `SPLASH_STORE`, `DB_VERSION = 2`; `SplashDesign`, `DEFAULT_DESIGN`, `loadDesign`, `saveDesign`, `clearDesign`. `fontStorage`'s `loadEdit/saveEdit/clearEdit/listEdits` keep their signatures (used by `useFontEditor`).

- [ ] **Step 1: Write the failing test**

Create `web/src/utils/__tests__/osdDb.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { DB_VERSION, FONT_EDITS_STORE, SPLASH_STORE, upgrade } from '../osdDb'

/** A stub IDBDatabase that records createObjectStore calls. */
function stubDb(existing: string[]) {
  const created: [string, unknown][] = []
  return {
    created,
    db: {
      objectStoreNames: { contains: (name: string) => existing.includes(name) } as DOMStringList,
      createObjectStore: vi.fn((name: string, options?: IDBObjectStoreParameters) => {
        created.push([name, options])
        return {} as IDBObjectStore
      }),
    },
  }
}

describe('armyjay_osd upgrade', () => {
  it('is at version 2', () => {
    expect(DB_VERSION).toBe(2)
  })

  it('creates both stores on a fresh database', () => {
    const { db, created } = stubDb([])
    upgrade(db)
    expect(created).toEqual([
      [FONT_EDITS_STORE, { keyPath: 'id' }],
      [SPLASH_STORE, { keyPath: 'id' }],
    ])
  })

  it('leaves a version-1 database its font_edits and adds only splash', () => {
    const { db, created } = stubDb([FONT_EDITS_STORE])
    upgrade(db)
    expect(created).toEqual([[SPLASH_STORE, { keyPath: 'id' }]])
  })

  it('does nothing when both stores exist', () => {
    const { db, created } = stubDb([FONT_EDITS_STORE, SPLASH_STORE])
    upgrade(db)
    expect(created).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npx vitest run src/utils`
Expected: FAIL — `Failed to resolve import "../osdDb"`.

- [ ] **Step 3: Write the shared database module**

Create `web/src/utils/osdDb.ts`:

```ts
// The one IndexedDB database the OSD half owns: 'armyjay_osd'.
//
// Every store lives here so there is a single version number and a single
// upgrade path. A module that opened the database with its own version would
// race the others: whichever opened first would set the version, and the
// next open with a lower number would throw VersionError.
//
// Separate from 'edgesounds' on purpose: the sounds store has its own users
// and its own upgrade history, and the two features share nothing.

export const DB_NAME = 'armyjay_osd'
export const DB_VERSION = 2

export const FONT_EDITS_STORE = 'font_edits'
export const SPLASH_STORE = 'splash'

/** Every store, in the version it arrived: 1 = font_edits, 2 = splash. */
const STORES = [FONT_EDITS_STORE, SPLASH_STORE] as const

/** Create whichever stores are missing. Exported so the upgrade is testable. */
export function upgrade(db: Pick<IDBDatabase, 'objectStoreNames' | 'createObjectStore'>): void {
  for (const name of STORES) {
    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
  }
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => upgrade(req.result)
  })
}

export function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDB()
  try {
    const tx = db.transaction(storeName, mode)
    const result = await fn(tx.objectStore(storeName))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return result
  } finally {
    db.close()
  }
}
```

- [ ] **Step 4: Point `fontStorage.ts` at it**

Replace the whole of `web/src/utils/fontStorage.ts` with:

```ts
// IndexedDB-backed storage for edited OSD fonts, in the shared 'armyjay_osd'
// database (see osdDb.ts).
//
// Only the DIFF is stored, not the whole font. A font is 256 x 216 pixels;
// almost every edit touches a handful of glyphs, and keeping the base font by
// reference means an edit survives the pipeline rebuilding that variant.

import type { Pixel } from '../lib/mcm/types'
import { FONT_EDITS_STORE, reqAsPromise, withStore } from './osdDb'

export interface FontEdit {
  /** `${variantId}` — one saved edit per variant. */
  id: string
  variantId: string
  /** Glyph index (0-255) -> its full 216-pixel override. */
  edits: Record<number, Pixel[]>
  savedAt: number
}

export async function loadEdit(variantId: string): Promise<FontEdit | null> {
  return withStore(FONT_EDITS_STORE, 'readonly', async (store) => {
    const found = await reqAsPromise<FontEdit | undefined>(store.get(variantId))
    return found ?? null
  })
}

export async function saveEdit(variantId: string, edits: Record<number, Pixel[]>): Promise<void> {
  const record: FontEdit = { id: variantId, variantId, edits, savedAt: Date.now() }
  await withStore(FONT_EDITS_STORE, 'readwrite', async (store) => {
    await reqAsPromise(store.put(record))
  })
}

export async function clearEdit(variantId: string): Promise<void> {
  await withStore(FONT_EDITS_STORE, 'readwrite', async (store) => {
    await reqAsPromise(store.delete(variantId))
  })
}

export async function listEdits(): Promise<FontEdit[]> {
  return withStore(FONT_EDITS_STORE, 'readonly', async (store) => {
    const all = await reqAsPromise<FontEdit[]>(store.getAll())
    return all.sort((a, b) => b.savedAt - a.savedAt)
  })
}
```

- [ ] **Step 5: Write the splash store**

Create `web/src/utils/splashStorage.ts`:

```ts
// The start-screen design, one record, in the shared 'armyjay_osd' database.
//
// The image's source file is kept as a Blob so the threshold and the other
// settings can be re-applied after a reload; the decoded pixels are not
// stored, they are cheap to recompute. Paint is the sparse override map.
// Undo history is deliberately not persisted (see useFontEditor for why).

import type { Pixel } from '../lib/mcm/types'
import type { ImageOptions } from '../lib/splash/image'
import type { PaintLayer } from '../lib/splash/raster'
import type { TemplateInput } from '../lib/splash/template'
import { SPLASH_STORE, reqAsPromise, withStore } from './osdDb'

export interface SplashRecord {
  id: 'current'
  generator: 'text' | 'image'
  text: TemplateInput
  image: ImageOptions & { source: Blob | null; sourceName: string | null }
  paint: PaintLayer
  savedAt: number
}

export type SplashDesign = Omit<SplashRecord, 'id' | 'savedAt'>

export const DEFAULT_DESIGN: SplashDesign = {
  generator: 'text',
  text: { big: '', small: '', rules: true },
  image: { source: null, sourceName: null, threshold: 128, invert: false, background: 'transparent', outline: false },
  paint: {},
}

export async function loadDesign(): Promise<SplashDesign | null> {
  return withStore(SPLASH_STORE, 'readonly', async (store) => {
    const found = await reqAsPromise<SplashRecord | undefined>(store.get('current'))
    if (!found) return null
    const { id: _id, savedAt: _savedAt, ...design } = found
    return design
  })
}

export async function saveDesign(design: SplashDesign): Promise<void> {
  const record: SplashRecord = { id: 'current', ...design, savedAt: Date.now() }
  await withStore(SPLASH_STORE, 'readwrite', async (store) => {
    await reqAsPromise(store.put(record))
  })
}

export async function clearDesign(): Promise<void> {
  await withStore(SPLASH_STORE, 'readwrite', async (store) => {
    await reqAsPromise(store.delete('current'))
  })
}

export type { Pixel }
```

- [ ] **Step 6: Run the tests, lint, type-check**

Run: `cd web && npx vitest run && npm run lint && npx tsc -b`
Expected: 130 tests pass (92 + 34 + 4); clean.

- [ ] **Step 7: Commit**

```bash
cd web
git add src/utils/osdDb.ts src/utils/fontStorage.ts src/utils/splashStorage.ts src/utils/__tests__/osdDb.test.ts
git commit -m "$(cat <<'EOF'
Share one armyjay_osd database between font edits and the splash

Version 2 adds the splash store. One openDB owns the version and the
upgrade, because two modules opening the same database with their own
numbers would race to VersionError. fontStorage keeps its API.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The page

**Files:**
- Create: `web/src/hooks/useStencils.ts`, `web/src/hooks/useSplashDesign.ts`, `web/src/components/splash/TextTemplatePanel.tsx`, `.../ImagePanel.tsx`, `.../PaintCanvas.tsx`, `.../SplashPreview.tsx`, `.../ExportPanel.tsx`, `web/src/pages/osd/SplashMaker.tsx`
- Test: `web/src/pages/osd/__tests__/SplashMaker.test.tsx`
- Modify: `web/src/App.tsx`, `web/src/components/Nav.tsx`, `web/src/pages/osd/FontEditor.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2–4; `useFont`, `useVariants`, `useToast`, `SaveLink`.
- Produces: the route `/osd/splash`.

- [ ] **Step 1: Write the failing test**

Create `web/src/pages/osd/__tests__/SplashMaker.test.tsx` (server-rendered, so it checks the page's shape before any fetch lands):

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../hooks/useToast'
import { SplashMaker } from '../SplashMaker'

vi.mock('../../../platform/platform', () => ({ isNativeApp: () => false }))

describe('SplashMaker', () => {
  // Server-rendered, so no effects run: this is the page before any fetch
  // lands -- the shape of it, not its behaviour.
  const html = renderToStaticMarkup(
    <ToastProvider>
      <MemoryRouter initialEntries={['/osd/splash']}>
        <SplashMaker />
      </MemoryRouter>
    </ToastProvider>,
  )

  it('offers the three tools and starts on text', () => {
    expect(html).toContain('Start screen')
    for (const tab of ['Text', 'Image', 'Paint']) expect(html).toMatch(new RegExp(`role="tab"[^>]*>${tab}<`))
    expect(html).toMatch(/aria-selected="true"[^>]*>Text</)
  })

  it('renders both inputs of the text template with the width readout', () => {
    expect(html).toContain('id="splash-big"')
    expect(html).toContain('id="splash-small"')
    expect(html).toContain('0 of 288 px')
  })

  it('shows the export panel with nothing to export yet', () => {
    expect(html).toContain('The start screen is empty')
    expect(html).toContain("Betaflight&#x27;s default font")
    expect(html).not.toContain('download=')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npx vitest run src/pages`
Expected: FAIL — `Failed to resolve import "../SplashMaker"`.

- [ ] **Step 3: The hooks**

Create `web/src/hooks/useStencils.ts`:

```ts
import { useEffect, useState } from 'react'
import { validateStencils } from '../lib/splash/stencils'
import type { Stencils } from '../lib/splash/stencils'

type State =
  | { state: 'loading' }
  | { state: 'loaded'; stencils: Stencils }
  | { state: 'error'; message: string }

/** Load /osd/stencils.json, staged from assets/splash_stencils.json at build time. */
export function useStencils(): State {
  const [state, setState] = useState<State>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/osd/stencils.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch stencils: ${response.status}`)
        return response.json()
      })
      .then((data: unknown) => {
        if (!cancelled) setState({ state: 'loaded', stencils: validateStencils(data) })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            state: 'error',
            message: error instanceof Error ? error.message : 'Failed to load stencils',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
```

Create `web/src/hooks/useSplashDesign.ts`. Note the image decode: the result is tagged with its source Blob and read during render, so the effect sets state only from async callbacks (the `react-hooks/set-state-in-effect` rule is on):

```ts
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { Pixel } from '../lib/mcm/types'
import { fitInside, rasterizeImage } from '../lib/splash/image'
import type { ImageOptions, Placement } from '../lib/splash/image'
import { EMPTY_HISTORY, paintReducer } from '../lib/splash/paint'
import { applyPaint, emptyRaster } from '../lib/splash/raster'
import type { Raster } from '../lib/splash/raster'
import type { Stencils } from '../lib/splash/stencils'
import { renderTemplate } from '../lib/splash/template'
import type { LineReport, TemplateInput } from '../lib/splash/template'
import { DEFAULT_DESIGN, clearDesign, loadDesign, saveDesign } from '../utils/splashStorage'
import type { SplashDesign } from '../utils/splashStorage'

const SAVE_DEBOUNCE_MS = 400
const EMPTY_REPORT: LineReport = { width: 0, overflow: 0, unsupported: [], drawn: false }

interface DecodedImage {
  rgba: Uint8ClampedArray
  placement: Placement
}

/** The decode result, tagged with the Blob it came from so a stale one is ignored. */
type ImageState = { source: Blob; result: DecodedImage | { error: string } } | null

/**
 * The start-screen design: a generator (text template or image) that makes
 * the base raster, and a paint layer of pixel overrides on top -- the glyph
 * editor's base-plus-edits pattern, so changing the text later keeps the
 * touch-ups.
 *
 * The design is saved to IndexedDB on every change (debounced) and restored
 * on load; paint's undo history is not persisted. The decoded image pixels
 * are derived from the stored source file, not stored themselves.
 */
export function useSplashDesign(stencils: Stencils | null) {
  const [design, setDesign] = useState<Omit<SplashDesign, 'paint'>>(stripPaint(DEFAULT_DESIGN))
  const [paint, dispatch] = useReducer(paintReducer, EMPTY_HISTORY)
  const [loaded, setLoaded] = useState(false)
  const [storage, setStorage] = useState<'ok' | 'unavailable'>('ok')
  const [image, setImage] = useState<ImageState>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const saved = await loadDesign()
        if (cancelled) return
        if (saved) {
          setDesign(stripPaint(saved))
          dispatch({ type: 'load', paint: saved.paint })
        }
      } catch (error) {
        console.warn('[useSplashDesign] could not load the saved design', error)
        if (!cancelled) setStorage('unavailable')
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Persist, debounced, once restored (so the default never overwrites a save).
  useEffect(() => {
    if (!loaded || storage === 'unavailable') return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveDesign({ ...design, paint: paint.present }).catch((error: unknown) => {
        console.warn('[useSplashDesign] could not save the design', error)
        setStorage('unavailable')
      })
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [design, paint.present, loaded, storage])

  // Decode the image source into pixels at its fitted placement. The result
  // is tagged with its source and read during render, so this effect only
  // sets state from the async callbacks (see useFont for the same shape).
  const source = design.image.source
  useEffect(() => {
    if (!source) return
    let cancelled = false
    void (async () => {
      try {
        const bitmap = await createImageBitmap(source)
        const placement = fitInside(bitmap.width, bitmap.height)
        const canvas = document.createElement('canvas')
        canvas.width = placement.width
        canvas.height = placement.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('Could not get a 2D context')
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(bitmap, 0, 0, placement.width, placement.height)
        bitmap.close()
        const { data } = ctx.getImageData(0, 0, placement.width, placement.height)
        if (!cancelled) setImage({ source, result: { rgba: data, placement } })
      } catch (error) {
        if (!cancelled) {
          setImage({
            source,
            result: { error: error instanceof Error ? error.message : 'Could not read that image' },
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [source])

  const current = image && image.source === source ? image.result : null
  const decoded = current && 'rgba' in current ? current : null
  const imageError = current && 'error' in current ? current.error : null

  const template = useMemo(() => {
    if (design.generator !== 'text' || !stencils) return null
    return renderTemplate(stencils, design.text)
  }, [design.generator, design.text, stencils])

  const base = useMemo<Raster>(() => {
    if (design.generator === 'text') return template?.raster ?? emptyRaster()
    if (!decoded) return emptyRaster()
    const { source: _source, sourceName: _name, ...options } = design.image
    return rasterizeImage(decoded.rgba, decoded.placement, options)
  }, [design.generator, design.image, template, decoded])

  const raster = useMemo(() => applyPaint(base, paint.present), [base, paint.present])

  const setGenerator = useCallback((generator: SplashDesign['generator']) => {
    setDesign((d) => ({ ...d, generator }))
  }, [])
  const setText = useCallback((patch: Partial<TemplateInput>) => {
    setDesign((d) => ({ ...d, generator: 'text', text: { ...d.text, ...patch } }))
  }, [])
  const setImageOptions = useCallback((patch: Partial<ImageOptions>) => {
    setDesign((d) => ({ ...d, generator: 'image', image: { ...d.image, ...patch } }))
  }, [])
  const setImageSource = useCallback((file: File | null) => {
    setDesign((d) => ({
      ...d,
      generator: 'image',
      image: { ...d.image, source: file, sourceName: file?.name ?? null },
    }))
  }, [])
  const stroke = useCallback((x: number, y: number, size: 1 | 2 | 3, color: Pixel) => {
    dispatch({ type: 'stroke', x, y, size, color })
  }, [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const clearPaint = useCallback(() => dispatch({ type: 'clear' }), [])
  const reset = useCallback(async () => {
    setDesign(stripPaint(DEFAULT_DESIGN))
    dispatch({ type: 'load', paint: {} })
    try {
      await clearDesign()
    } catch (error) {
      console.warn('[useSplashDesign] could not clear the saved design', error)
    }
  }, [])

  return {
    design,
    loaded,
    storage,
    raster,
    report: { big: template?.big ?? EMPTY_REPORT, small: template?.small ?? EMPTY_REPORT },
    imageError,
    imageReady: decoded !== null,
    paint: paint.present,
    canUndo: paint.past.length > 0,
    canRedo: paint.future.length > 0,
    setGenerator,
    setText,
    setImageOptions,
    setImageSource,
    stroke,
    undo,
    redo,
    clearPaint,
    reset,
  }
}

function stripPaint(design: SplashDesign): Omit<SplashDesign, 'paint'> {
  const { paint: _paint, ...rest } = design
  return rest
}

export type SplashEditor = ReturnType<typeof useSplashDesign>
```

- [ ] **Step 4: The components**

Create `web/src/components/splash/TextTemplatePanel.tsx`:

```tsx
import type { LineReport } from '../../lib/splash/template'
import { RASTER_WIDTH } from '../../lib/splash/raster'
import type { SplashEditor } from '../../hooks/useSplashDesign'

const INPUT =
  'w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm uppercase text-zinc-100 outline-none focus:border-accent'

/** Two centred lines in the stencil letters, rules on or off -- today's splash layout. */
export function TextTemplatePanel({ editor }: { editor: SplashEditor }) {
  const { text } = editor.design
  return (
    <div className="space-y-4">
      <Line
        id="splash-big"
        label="Big line"
        hint="14 px stencil, tile row 1"
        value={text.big}
        report={editor.report.big}
        onChange={(big) => editor.setText({ big })}
      />
      <Line
        id="splash-small"
        label="Small line"
        hint="9 px stencil, tile row 2"
        value={text.small}
        report={editor.report.small}
        onChange={(small) => editor.setText({ small })}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={text.rules}
          onChange={(event) => editor.setText({ rules: event.target.checked })}
          className="h-4 w-4 accent-accent"
        />
        Rules above and below
      </label>
    </div>
  )
}

function Line({
  id,
  label,
  hint,
  value,
  report,
  onChange,
}: {
  id: string
  label: string
  hint: string
  value: string
  report: LineReport
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-zinc-300">
        {label} <span className="text-xs text-zinc-500">· {hint}</span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      <p className="mt-1 font-mono text-xs" aria-live="polite">
        {report.overflow > 0 ? (
          <span className="text-red-400">
            {report.overflow} px too wide — not drawn
          </span>
        ) : (
          <span className="text-zinc-500">
            {report.width} of {RASTER_WIDTH} px
          </span>
        )}
        {report.unsupported.length > 0 && (
          <span className="ml-2 text-amber-400">
            no stencil for {report.unsupported.map((c) => `"${c}"`).join(' ')}
          </span>
        )}
      </p>
    </div>
  )
}
```

Create `web/src/components/splash/ImagePanel.tsx`:

```tsx
import { ImageUp } from 'lucide-react'
import { useRef } from 'react'
import type { SplashEditor } from '../../hooks/useSplashDesign'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/** Any picture, fitted into 288 x 72 and thresholded to the three OSD colours. */
export function ImagePanel({ editor }: { editor: SplashEditor }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { image } = editor.design

  const pick = (file: File | null) => {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      editor.setImageSource(null)
      return
    }
    editor.setImageSource(file)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          pick(event.dataTransfer.files[0] ?? null)
        }}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-8 text-center text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
      >
        <ImageUp className="h-6 w-6" />
        <span className="text-sm font-medium">
          {image.sourceName ? image.sourceName : 'Choose an image'}
        </span>
        <span className="text-xs text-zinc-500">PNG · JPEG · WebP · GIF — fitted into 288×72</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />
      {editor.imageError && <p className="text-sm text-red-400">{editor.imageError}</p>}

      <div>
        <label htmlFor="splash-threshold" className="mb-1 block text-sm text-zinc-300">
          Threshold <span className="font-mono text-xs text-zinc-500">· {image.threshold}</span>
        </label>
        <input
          id="splash-threshold"
          type="range"
          min={0}
          max={255}
          value={image.threshold}
          onChange={(event) => editor.setImageOptions({ threshold: Number(event.target.value) })}
          className="w-full accent-accent"
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={image.invert}
            onChange={(event) => editor.setImageOptions({ invert: event.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Invert
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={image.outline}
            onChange={(event) => editor.setImageOptions({ outline: event.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Outline
        </label>
        <label className="flex items-center gap-2">
          Background
          <select
            value={image.background}
            onChange={(event) =>
              editor.setImageOptions({ background: event.target.value as 'transparent' | 'black' })
            }
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-accent"
          >
            <option value="transparent">Transparent</option>
            <option value="black">Black</option>
          </select>
        </label>
      </div>
    </div>
  )
}
```

Create `web/src/components/splash/PaintCanvas.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../../lib/mcm/decode'
import { RESERVED_INDEX, LOGO_START, TILES_HORIZ } from '../../lib/mcm/logo'
import type { Pixel } from '../../lib/mcm/types'
import { RASTER_HEIGHT, RASTER_WIDTH } from '../../lib/splash/raster'
import type { Raster } from '../../lib/splash/raster'

const COLORS: Record<Pixel, string> = { white: '#ffffff', black: '#000000', transparent: '#18181b' }
const CHECKER = '#232327'
const GRID = 'rgba(255,255,255,0.14)'
const RESERVED = 'rgba(255,80,80,0.18)'

export type BrushSize = 1 | 2 | 3

/**
 * The whole 288 x 72 raster as a paint surface at `scale`. Pointer events
 * with capture, as in GlyphEditorCanvas, so a finger or stylus stroke
 * survives leaving the canvas. The tile grid is drawn over the pixels, and
 * the reserved 0xFF tile is tinted: ink there is never written to a font.
 */
export function PaintCanvas({
  raster,
  color,
  size,
  onStroke,
  scale = 3,
}: {
  raster: Raster
  color: Pixel
  size: BrushSize
  onStroke: (x: number, y: number, size: BrushSize, color: Pixel) => void
  scale?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [painting, setPainting] = useState(false)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    for (let y = 0; y < RASTER_HEIGHT; y += 1) {
      for (let x = 0; x < RASTER_WIDTH; x += 1) {
        const pixel = raster[y * RASTER_WIDTH + x]
        ctx.fillStyle = pixel === 'transparent' && (x + y) % 2 === 1 ? CHECKER : COLORS[pixel]
        ctx.fillRect(x * scale, y * scale, scale, scale)
      }
    }
    const reservedCol = (RESERVED_INDEX - LOGO_START) % TILES_HORIZ
    const reservedRow = Math.floor((RESERVED_INDEX - LOGO_START) / TILES_HORIZ)
    ctx.fillStyle = RESERVED
    ctx.fillRect(
      reservedCol * GLYPH_WIDTH * scale,
      reservedRow * GLYPH_HEIGHT * scale,
      GLYPH_WIDTH * scale,
      GLYPH_HEIGHT * scale,
    )
    ctx.strokeStyle = GRID
    ctx.lineWidth = 1
    for (let x = 0; x <= RASTER_WIDTH; x += GLYPH_WIDTH) {
      ctx.beginPath()
      ctx.moveTo(x * scale + 0.5, 0)
      ctx.lineTo(x * scale + 0.5, RASTER_HEIGHT * scale)
      ctx.stroke()
    }
    for (let y = 0; y <= RASTER_HEIGHT; y += GLYPH_HEIGHT) {
      ctx.beginPath()
      ctx.moveTo(0, y * scale + 0.5)
      ctx.lineTo(RASTER_WIDTH * scale, y * scale + 0.5)
      ctx.stroke()
    }
  }, [raster, scale])

  const paintAt = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = ref.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * RASTER_WIDTH)
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * RASTER_HEIGHT)
      if (x < 0 || y < 0 || x >= RASTER_WIDTH || y >= RASTER_HEIGHT) return
      onStroke(x, y, size, color)
    },
    [color, size, onStroke],
  )

  return (
    <div className="overflow-x-auto rounded border border-zinc-700 bg-zinc-950">
      <canvas
        ref={ref}
        width={RASTER_WIDTH * scale}
        height={RASTER_HEIGHT * scale}
        role="img"
        aria-label="Start screen, 288 by 72 pixels. Drag to paint."
        className="block touch-none"
        style={{ cursor: 'crosshair', width: RASTER_WIDTH * scale, height: RASTER_HEIGHT * scale }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setPainting(true)
          paintAt(event)
        }}
        onPointerMove={(event) => {
          if (painting) paintAt(event)
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId)
          setPainting(false)
        }}
        onPointerCancel={() => setPainting(false)}
      />
    </div>
  )
}
```

Create `web/src/components/splash/SplashPreview.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../../lib/mcm/decode'
import { RASTER_HEIGHT, RASTER_WIDTH } from '../../lib/splash/raster'
import type { Raster } from '../../lib/splash/raster'

/** Mid-grey: the honest stand-in for an analog video feed behind the OSD. */
const VIDEO = '#7a7a7a'
const SEAM = '#09090b'

/**
 * Two views of the raster: over grey "video", which is what the black
 * outline is for, and sliced into its 24 x 4 tiles with 1 px seams.
 */
export function SplashPreview({ raster }: { raster: Raster }) {
  return (
    <div className="space-y-3">
      <Canvas raster={raster} scale={2} seams={false} label="Start screen over video" />
      <Canvas raster={raster} scale={1} seams label="Start screen as 96 tiles" />
    </div>
  )
}

function Canvas({
  raster,
  scale,
  seams,
  label,
}: {
  raster: Raster
  scale: number
  seams: boolean
  label: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const seam = seams ? 1 : 0
  const width = RASTER_WIDTH * scale + seam * (RASTER_WIDTH / GLYPH_WIDTH - 1)
  const height = RASTER_HEIGHT * scale + seam * (RASTER_HEIGHT / GLYPH_HEIGHT - 1)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = seams ? SEAM : VIDEO
    ctx.fillRect(0, 0, width, height)
    for (let y = 0; y < RASTER_HEIGHT; y += 1) {
      for (let x = 0; x < RASTER_WIDTH; x += 1) {
        const pixel = raster[y * RASTER_WIDTH + x]
        ctx.fillStyle = pixel === 'white' ? '#ffffff' : pixel === 'black' ? '#000000' : VIDEO
        const px = x * scale + seam * Math.floor(x / GLYPH_WIDTH)
        const py = y * scale + seam * Math.floor(y / GLYPH_HEIGHT)
        ctx.fillRect(px, py, scale, scale)
      }
    }
  }, [raster, scale, seams, seam, width, height])

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="block max-w-full rounded border border-zinc-800"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
```

Create `web/src/components/splash/ExportPanel.tsx`:

```tsx
import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFont } from '../../hooks/useFont'
import { useVariants } from '../../hooks/useVariants'
import { encodeFont } from '../../lib/mcm/encode'
import { fontWithSplash, splashPng } from '../../lib/splash/compose'
import { isRasterEmpty } from '../../lib/splash/raster'
import type { Raster } from '../../lib/splash/raster'
import { SaveLink } from '../SaveLink'
import { STOCK_BASE } from '../../lib/splash/bases'
import type { ExportBase } from '../../lib/splash/bases'

const BUTTON =
  'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40'

/** Pick a base font, get it back with the start screen in its splash block -- or the PNG alone. */
export function ExportPanel({ raster }: { raster: Raster }) {
  const variants = useVariants()
  const bases = useMemo<ExportBase[]>(
    () => [
      ...(variants.state === 'loaded'
        ? variants.variants.map((v) => ({ id: v.id, output: v.output, label: v.id }))
        : []),
      STOCK_BASE,
    ],
    [variants],
  )
  const [baseId, setBaseId] = useState<string>('armyjay_full')
  const base = bases.find((b) => b.id === baseId) ?? bases[0]
  const loaded = useFont(base?.output)
  const empty = isRasterEmpty(raster)

  const composed = useMemo(() => {
    if (loaded.state !== 'loaded' || empty || !base) return null
    const { font, droppedReservedInk } = fontWithSplash(loaded.font, raster)
    const text = encodeFont(font)
    return {
      droppedReservedInk,
      bytes: text.length,
      name: `${base.id}_splash.mcm`,
      url: URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' })),
    }
  }, [loaded, raster, empty, base])

  const png = useMemo(() => {
    if (empty) return null
    return URL.createObjectURL(new Blob([splashPng(raster)], { type: 'image/png' }))
  }, [raster, empty])

  useEffect(() => {
    return () => {
      if (composed) URL.revokeObjectURL(composed.url)
    }
  }, [composed])
  useEffect(() => {
    return () => {
      if (png) URL.revokeObjectURL(png)
    }
  }, [png])

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 className="text-sm font-medium text-zinc-100">Export</h2>
      <label className="block text-sm text-zinc-300">
        Base font
        <select
          value={base?.id ?? ''}
          onChange={(event) => setBaseId(event.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
        >
          {bases.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      {base?.note && <p className="text-xs text-zinc-500">{base.note}</p>}
      {loaded.state === 'error' && <p className="text-sm text-red-400">{loaded.message}</p>}

      {empty && <p className="text-sm text-zinc-500">The start screen is empty — nothing to export yet.</p>}
      {composed?.droppedReservedInk && (
        <p className="text-sm text-amber-400">
          The bottom-right tile has ink. It is 0xFF, the end-of-font marker, so it will not be
          written — move the artwork up or left.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {composed ? (
          <SaveLink
            href={composed.url}
            filename={composed.name}
            className={`${BUTTON} bg-accent text-zinc-950 hover:bg-accent-dim`}
          >
            <Download className="h-4 w-4" /> Download {composed.name}
          </SaveLink>
        ) : (
          <button type="button" disabled className={`${BUTTON} bg-accent text-zinc-950`}>
            <Download className="h-4 w-4" /> Download .mcm
          </button>
        )}
        {png ? (
          <SaveLink
            href={png}
            filename="start_screen.png"
            className={`${BUTTON} border border-zinc-700 text-zinc-300 hover:border-accent/50 hover:text-accent`}
          >
            <Download className="h-4 w-4" /> PNG for Configurator
          </SaveLink>
        ) : (
          <button
            type="button"
            disabled
            className={`${BUTTON} border border-zinc-700 text-zinc-300`}
          >
            <Download className="h-4 w-4" /> PNG for Configurator
          </button>
        )}
      </div>
      {composed && (
        <p className="font-mono text-[10px] text-zinc-500">
          {composed.bytes.toLocaleString()} bytes
          {composed.bytes === 147463 ? ' · valid' : ' · UNEXPECTED SIZE'}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: The page**

Create `web/src/pages/osd/SplashMaker.tsx`. The `min-w-0` on the tools column matters: without it the 864 px paint canvas widens the whole page on a phone instead of scrolling inside its box.

```tsx
import { Eraser, Redo2, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExportPanel } from '../../components/splash/ExportPanel'
import { ImagePanel } from '../../components/splash/ImagePanel'
import { PaintCanvas } from '../../components/splash/PaintCanvas'
import type { BrushSize } from '../../components/splash/PaintCanvas'
import { SplashPreview } from '../../components/splash/SplashPreview'
import { TextTemplatePanel } from '../../components/splash/TextTemplatePanel'
import { useSplashDesign } from '../../hooks/useSplashDesign'
import { useStencils } from '../../hooks/useStencils'
import { useToast } from '../../hooks/useToast'
import type { Pixel } from '../../lib/mcm/types'

type Tool = 'text' | 'image' | 'paint'

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Image' },
  { id: 'paint', label: 'Paint' },
]

const PALETTE: { value: Pixel; label: string; swatch: string }[] = [
  { value: 'white', label: 'White', swatch: 'bg-white' },
  { value: 'black', label: 'Black', swatch: 'bg-black border border-zinc-600' },
  { value: 'transparent', label: 'Clear', swatch: 'bg-zinc-800 border border-zinc-600' },
]

const TOOLBAR =
  'flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40'

export function SplashMaker() {
  const stencils = useStencils()
  const editor = useSplashDesign(stencils.state === 'loaded' ? stencils.stencils : null)
  const { notify } = useToast()
  const [tool, setTool] = useState<Tool>('text')
  const [color, setColor] = useState<Pixel>('white')
  const [size, setSize] = useState<BrushSize>(1)

  const pickTool = (next: Tool) => {
    setTool(next)
    if (next === 'text' || next === 'image') editor.setGenerator(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/osd" className="text-sm text-zinc-400 hover:text-accent">
          ← OSD fonts
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">Start screen</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          The 288×72 splash Betaflight shows at boot. Type it, drop a picture in, or paint it, then
          export a font with it in — one of the Army Jay variants, or Betaflight's default font with
          only the splash swapped. Paint sits on top: change the text later and your touch-ups stay.
        </p>
        {editor.storage === 'unavailable' && (
          <p className="mt-2 text-xs text-amber-400">
            This browser is not letting the design be saved, so it will be gone on reload.
          </p>
        )}
      </div>

      <SplashPreview raster={editor.raster} />

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Start screen tools" className="flex gap-1 rounded-md bg-zinc-900/60 p-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tool === t.id}
              onClick={() => pickTool(t.id)}
              className={[
                'rounded px-3 py-1.5 text-sm transition-colors',
                tool === t.id ? 'bg-accent/10 text-accent' : 'text-zinc-400 hover:text-zinc-100',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">
          Base: {editor.design.generator === 'text' ? 'text template' : 'image'}
        </span>
        <button
          type="button"
          onClick={() => {
            void editor.reset()
            notify('Started over', 'info')
          }}
          className={`${TOOLBAR} ml-auto`}
        >
          <Trash2 className="h-3.5 w-3.5" /> Start over
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* min-w-0: the 864 px paint canvas must scroll inside its column, not widen the page. */}
        <div className="min-w-0 space-y-4">
          {tool === 'text' &&
            (stencils.state === 'error' ? (
              <p className="text-sm text-red-400">{stencils.message}</p>
            ) : (
              <TextTemplatePanel editor={editor} />
            ))}
          {tool === 'image' && <ImagePanel editor={editor} />}
          {tool === 'paint' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {PALETTE.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setColor(p.value)}
                    aria-pressed={color === p.value}
                    className={[
                      'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
                      color === p.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-500',
                    ].join(' ')}
                  >
                    <span className={`h-3.5 w-3.5 rounded-sm ${p.swatch}`} />
                    {p.label}
                  </button>
                ))}
                <span className="ml-2 text-xs text-zinc-500">Brush</span>
                {([1, 2, 3] as BrushSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    aria-pressed={size === s}
                    className={[
                      'rounded-md border px-2.5 py-1.5 font-mono text-xs',
                      size === s
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-500',
                    ].join(' ')}
                  >
                    {s}px
                  </button>
                ))}
              </div>
              <PaintCanvas raster={editor.raster} color={color} size={size} onStroke={editor.stroke} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={editor.undo} disabled={!editor.canUndo} className={TOOLBAR}>
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </button>
                <button type="button" onClick={editor.redo} disabled={!editor.canRedo} className={TOOLBAR}>
                  <Redo2 className="h-3.5 w-3.5" /> Redo
                </button>
                <button
                  type="button"
                  onClick={editor.clearPaint}
                  disabled={Object.keys(editor.paint).length === 0}
                  className={TOOLBAR}
                >
                  <Eraser className="h-3.5 w-3.5" /> Clear paint
                </button>
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <RotateCcw className="h-3 w-3" /> Paint sits over the base; the tinted tile is 0xFF and
                  is never written.
                </span>
              </div>
            </div>
          )}
        </div>
        <ExportPanel raster={editor.raster} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Route, nav item, editor link**

```diff
--- a/web/src/App.tsx
+++ b/web/src/App.tsx
@@ -6,6 +6,7 @@
 import { OsdHome } from './pages/osd/OsdHome'
 import { FontDetail } from './pages/osd/FontDetail'
 import { FontEditor } from './pages/osd/FontEditor'
+import { SplashMaker } from './pages/osd/SplashMaker'
 import { Library } from './pages/Library'
 import { Convert } from './pages/Convert'
 import { MySounds } from './pages/MySounds'
@@ -35,6 +36,7 @@
                       <Route path="/osd" element={<OsdHome />} />
                       <Route path="/osd/fonts/:variant" element={<FontDetail />} />
                       <Route path="/osd/fonts/:variant/edit" element={<FontEditor />} />
+                      <Route path="/osd/splash" element={<SplashMaker />} />
                       <Route path="*" element={<Landing />} />
                     </Routes>
                   </ErrorBoundary>
```

```diff
--- a/web/src/components/Nav.tsx
+++ b/web/src/components/Nav.tsx
@@ -29,6 +29,7 @@
   // unavailable, so navigation never depends on that fetch succeeding.
   const osdItems: SubItem[] = [
     { to: '/osd', label: 'All fonts', end: true },
+    { to: '/osd/splash', label: 'Start screen' },
     ...(variants.state === 'loaded'
       ? variants.variants.map((variant) => ({
           to: `/osd/fonts/${variant.id}`,
```

```diff
--- a/web/src/pages/osd/FontEditor.tsx
+++ b/web/src/pages/osd/FontEditor.tsx
@@ -212,6 +212,12 @@
             )}
           </p>
 
+          <p className="text-xs text-zinc-500">
+            Or design one from text, a picture or pixels —{' '}
+            <Link to="/osd/splash" className="text-accent hover:underline">
+              Start screen →
+            </Link>
+          </p>
           <LogoUpload
             onApply={(edits) => {
               editor.applyEdits(edits)
```

- [ ] **Step 7: Run everything**

Run: `cd web && npx vitest run && npm run lint && npx tsc -b && npm run build && git checkout -- public/sitemap.xml`
Expected: 133 tests pass; lint, type-check and build clean.

- [ ] **Step 8: Drive it in a browser**

Run `cd web && npm run dev` and open `/osd/splash`. Check, in order:

1. The preview shows the rules; typing `chalky fpv` in the big line and `send it! 2026 @` in the small line draws both centred, outlined, uppercased; the small line's readout says `no stencil for "@"`; the big one says `138 of 288 px`.
2. Export shows `147,463 bytes · valid`; the `.mcm` downloads as `armyjay_full_splash.mcm`; switching the base to Betaflight's default font shows the GPL note and downloads `betaflight_default_splash.mcm`; "PNG for Configurator" downloads a 288 × 72 PNG that opens.
3. Paint: drag on the canvas paints; Undo enables; the bottom-right tile is tinted.
4. Image: drop any photo; the threshold slider changes the preview live; Invert, Outline and Background behave.
5. Reload: the text and paint are still there. "Start over" clears them.
6. Narrow the window to 390 px: the preview shrinks, the paint canvas scrolls inside its box, the page does not scroll sideways.
7. The glyph editor's Boot splash section links to the page; the OSD sub-nav has "Start screen".

- [ ] **Step 9: Commit**

```bash
cd web
git add src/hooks/useStencils.ts src/hooks/useSplashDesign.ts src/components/splash src/pages/osd/SplashMaker.tsx src/pages/osd/__tests__/SplashMaker.test.tsx src/App.tsx src/components/Nav.tsx src/pages/osd/FontEditor.tsx
git commit -m "$(cat <<'EOF'
Add the start screen page

/osd/splash: a text template in the stencil letters, any picture
thresholded to the three OSD colours, or painted pixels -- paint sits
over the generator so the text can change without losing touch-ups.
Previewed over grey video and as tiles; exported into any Army Jay
variant or the stock Betaflight font, or as the Configurator PNG. The
design persists in the splash store.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Documentation

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1: Web README**

In `web/README.md`, after the `## Editing` section's last paragraph and before `## iPhone app`, add:

````markdown
## Start screen

`/osd/splash` designs the 288×72 boot splash. One *generator* makes the base
raster — the **Text** template (two centred lines in the stencil letters,
rules on or off, automatic black outline) or the **Image** tool (any picture
fitted into 288×72 and thresholded to white/black/transparent) — and
**Paint** is a sparse layer of pixel overrides on top, the same
base-plus-edits pattern as the glyph editor, so changing the text later
keeps the touch-ups.

The stencil letterforms live in `../assets/splash_stencils.json`, which
`tools/make_logo.py` reads too; the build stages it to `/osd/stencils.json`.
`src/lib/splash/__tests__/template.test.ts` renders `ARMY JAY / TACTICAL OSD`
and compares the sliced tiles with glyphs `0xA0–0xFE` of the real
`fonts/armyjay_full.mcm`, so the port cannot drift from the Python original.

Export composes the raster into a base font — the three variants, or the
stock Betaflight font (`assets/references/stock/default_v2.mcm`, GPL-3.0,
staged as `betaflight_default.mcm`) — through the codec, and offers the
`.mcm` or a three-colour PNG for Configurator's own uploader. The design is
saved in the `splash` store of `armyjay_osd` (now version 2, opened only
through `utils/osdDb.ts`).
````

- [ ] **Step 2: Commit**

```bash
cd web
git add README.md
git commit -m "$(cat <<'EOF'
Document the start screen page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Letterform review gate

**Files:** none changed unless the review asks for it.

- [ ] **Step 1: STOP — show Jason the sheet**

Open `previews/stencil_sheet.png` for Jason (and the dev server at `/osd/splash` with a callsign typed in). The spec makes this a gate: the ~60 new glyphs ship only after he has looked at them. Ask, in one message, whether any letterform needs changing.

- [ ] **Step 2: If changes are asked for**

Edit the rows in `assets/splash_stencils.json` (never `A J M R Y` or the small `A C D I L O S T`, which are pinned), then:

```bash
python3 -m unittest tests.test_stencils && python3 tools/build_previews.py && git checkout -- previews/*_glyph_sheet.png previews/*_logo_preview.png
cd web && npx vitest run src/lib/splash
```
Expected: both suites pass (the decisive test proves the shipped splash still matches). Commit as `Redraw the <letters> stencils after review`.

- [ ] **Step 3: Done**

When Jason is happy, the branch is complete.
