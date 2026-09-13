# Build status

Tracks progress against the Army Jay OSD font build handoff.

**All seven steps complete.** Three variants build, plus three optional
craft-name builds, and all six pass every acceptance check.

```
$ python -m unittest discover -s tests
Ran 63 tests ... OK

$ python tools/validate.py fonts/*.mcm
PASSED -- 6 font(s) validated

$ python tools/validate.py
PASSED -- 2 font(s) validated        # the vendored stock references
```

| Step | Work | State |
|---|---|---|
| 1 | `mcm_encode.py` / `mcm_decode.py` / `validate.py`, proven against stock | done |
| 2 | Stock decoded to 256 PNGs in `assets/references/png/` | done |
| 3 | 159 glyphs across `letters`, `numbers`, `punctuation`, `icons` | done |
| 4 | Splash raster, `slice_logo.py`, index allocation | done |
| 5 | `variants.toml` + `build_font.py` → three `.mcm` (+3 craft-name) | done |
| 6 | Glyph sheets and OSD mock-ups per variant | done |
| 7 | `MODIFIED_INDEXES.md` + README | done |

---

## What was verified rather than assumed

**The format spec in the handoff is correct.** Across both stock fonts: all
2,560 padding bytes are `0x55`, and pixel pairs are exclusively `00` / `10`
/ `01` — not a single `11` pair in either file.

**Round-trip fidelity is proven, not claimed.** Both stock fonts read off
disk, parse to 256 glyphs, re-encode and write back **byte for byte
identical**, trailing newline and all. The validator has teeth too: it is
tested against four deliberate corruptions (non-`0x55` padding, an injected
`11` pair, truncation, a changed `0x00`) and catches each.

**Line count, precisely.** A stock font is 147,463 bytes: a 7-byte header
plus a newline, then 16,384 lines of 8 characters, the last unterminated.
That is 16,385 lines by the handoff's count, but `wc -l` reports **16384**.
The encoder matches the stock convention exactly so the round trip is
byte-clean; the parser accepts a trailing newline and CRLF on input.

**Which stock font is "stock".** Configurator ships `resources/osd/1/` and
`resources/osd/2/` and the current code loads version **2** unconditionally
(`const fontVer = 2`). 41 of the 256 glyphs differ between them. Both are
vendored; v2 is the diff base.

**Boot splash origin** — the one item the handoff flagged for checking.
Confirmed against Configurator commit `505bd6d` (2026-09-12):

| Constant | Value | Source |
|---|---|---|
| `SYM.LOGO` | `0xA0` | `src/js/utils/osdFont.js:36` |
| `TILES_NUM_HORIZ` | 24 | `src/js/LogoManager.js` |
| `TILES_NUM_VERT` | 4 | `src/js/LogoManager.js` |
| Expected image | 288 × 72 px | `CHAR_WIDTH × 24` by `CHAR_HEIGHT × 4` |
| Upload colours | `#000` black, `#fff` white, `#0f0` transparent | `MCM_COLORMAP` |

Note the transparent key for the uploaded PNG is **pure green** `(0,255,0)`,
not magenta. Magenta is only the preview convention.

---

## Decisions taken

### The `0xFF` collision — resolved

The handoff declares `0xFF` reserved (section 2) and puts the boot splash at
`0xA0` for 96 tiles (section 5a), which ends at `0xFF` inclusive. Both
cannot hold literally.

**Resolved as recommended and signed off:** the splash uses **95 tiles**,
and `0xFF` is left fully transparent. This is exactly what the stock
Betaflight splash does — every tile in `0xA0`–`0xFF` is available to it, but
the stock artwork leaves the last one empty.

Enforced in three places so it cannot regress: `make_logo.py` refuses to
write a raster whose bottom-right tile carries ink, `slice_logo.py` refuses
to slice one, and validator check 9 fails a font whose `0xFF` is not blank.

### `0x60`–`0x7E` are not lowercase ASCII

Section 2 says `0x20`–`0x7E` must retain ASCII meanings. Betaflight's analog
OSD is uppercase-only: `0x60`–`0x7E` are the 16 home arrows and the unit
icons in every stock font. Applying the rule literally past `0x5F` would
produce a font that renders arrows as letters.

**Resolved:** ASCII is preserved through `0x5F`, where Betaflight preserves
it; the firmware map wins above that. The rule is honoured where it is
real.

### `0x24` draws `MAX`

`src/main/drivers/osd_symbols.h` calls `0x24` `SYM_CHECKERED_FLAG`, but
every stock font draws the word `MAX` there. Whatever the header says, a
pilot on a stock font sees `MAX`, so drawing a flag would change behaviour
rather than preserve it. The art follows stock.

### "Heavier weight" means heavier black

The high-readability variant thickens the **black surround** on the ASCII
block, not the white strokes. At a 12 px cell with 2 px strokes, going
heavier closes the counters — a filled-in `8` or `B` is less legible than a
thin one, not more. Contrast is what degrades on an analog feed, so
contrast is what the variant buys. The extra outlining is deliberately
scoped to `0x20`–`0x5F`: widening the AH ladder or the progress bar would
merge their segments.

---

## Bugs found and fixed during the build

- **The decimal point read as a hyphen.** Sitting at sketch rows 8–9 against
  a baseline at row 11, `16.4V` rendered as `16-4V`. On a voltage readout
  that is a genuinely dangerous misread. All baseline-sitting punctuation
  (`.` `,` `:` `;` `!` `?`) was moved down to the baseline.
- **The home arrows were mirrored.** Betaflight's arrow block runs
  *anticlockwise* — `0x60` south, `0x64` east — so bearings decrease by
  22.5° per index. The first cut incremented them, flipping every
  intermediate arrow about the N–S axis. A test now asserts the bearing
  ordering, and a second asserts each arrow's ink actually points along its
  bearing.
- **Rotated-polygon arrows were unusable.** Rasterising one arrow polygon
  at 16 headings and thresholding down to 10 px produced blobs, not arrows.
  Replaced with three hand-drawn bases (N, NNE, NE) plus exact 90° rotations
  and one mirror, which reach all 16 headings with no interpolation.
- **`glyphs/numbers.py` shadowed the stdlib.** Putting `glyphs/` on
  `sys.path` made `import numbers` resolve to glyph art, breaking `decimal`,
  `fractions` and Pillow. Everything imports it as `glyphs.numbers` now, and
  a test guards it.

---

## Known compromises

- **Three-character labels are 1 px strokes.** `ALT`, `LAT`, `LON`, `MAH`,
  `ROL`, `PIT`, `THR`, `DST` need three characters in 12 px of width, which
  leaves no room for a 2 px stroke. This breaks section 4's "no single-pixel
  detail" rule. The stock font makes the identical compromise in the
  identical places — there is no more width to be had. Two-character labels
  (`FT`, `KM`, `MI`, `LQ`, `BB`) use a bold 5 × 9 face instead.
- **22.5° arrow steps are near the limit of the cell.** Adjacent headings
  are distinguishable side by side but not obviously so in isolation. Stock
  has the same problem.
- **Nothing here has been flown.** The art is verified by pixel inspection
  and the OSD mock-ups in `previews/`, which draw a representative screen
  from the font itself. It has not been uploaded to a real MAX7456 or seen
  in goggles with a degraded feed — that is the one test that cannot be run
  from here, and the high-readability variant in particular deserves it.

---

## About the previous contents of this repo

This repository held **EdgeSounds**, a React/Vite in-browser EdgeTX `.wav`
converter with a curated sound library. It shares an audience with this
project — FPV pilots — but no code, no format, and no tooling. It was
removed wholesale rather than carried along.

Nothing is lost: the full history is in git through commit `7c66ca0`, and a
branch off that commit brings it back intact. What was kept and adapted:
`.gitignore`, `.gitattributes` (now pinning `*.mcm` to LF, which matters — a
CRLF checkout produces a font Configurator will not parse), and the GitHub
Actions CI workflow, rewritten from Node to Python.
