# Build status

Tracks progress against the Army Jay OSD font build handoff.

**All seven steps complete.** Three variants build, plus three optional
craft-name builds, and all six pass every acceptance check.

```
$ python -m unittest discover -s tests
Ran 68 tests ... OK

$ python tools/validate.py fonts/*.mcm
PASSED -- 6 font(s) validated

$ python tools/validate.py
PASSED -- 2 font(s) validated        # the vendored stock references

$ python tools/crosscheck_configurator.py
PASSED -- Configurator's own code agrees with every built font
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

## Verified against Configurator's own code

`validate.py` checks the fonts against *our* reading of the format, which
proves consistency rather than correctness. So the build also executes
Betaflight Configurator's real source over every output —
`FONT.parseMCMFontFile`, `FONT.msp.encode`, and `LogoManager`'s
`imageToCharacter` — via `tools/crosscheck_configurator.py`.

Against configurator `505bd6d`, for all six built fonts:

| Check | Result |
|---|---|
| Configurator parses the file | 256 characters |
| Every pixel vs our decoder | 216 px x 256 glyphs, exact |
| `MSP_OSD_CHAR_WRITE` payloads | 256 payloads of 1 + 54 bytes, exact |
| Padding decodes as transparent | 40 trailing values x 256 |
| Splash PNG through Font Manager's uploader | 96 tiles byte-identical to the `.mcm` |

Two things this settled that were previously assumptions:

- **Only 54 of the 64 bytes per glyph are uploaded.** `FONT.msp.encode`
  slices the padding off before sending, so the `0x55` bytes never reach
  the OSD chip. They still have to be right in the file — Configurator's
  parser reads all 64 — but they cannot affect what renders.
- **Configurator yields 256 pixel values per glyph, not 216.** It decodes
  the full NVM field; only the first 216 are real pixels and the rest come
  from padding. The first version of the cross-check compared all 256 and
  reported every glyph as differing, which was the harness being wrong, not
  the font.

---

## A claim in the handoff that is simply false

Section 5b of the build handoff says:

> **Betaflight 4.5+:** OSD Custom Elements — point directly at arbitrary
> glyph indexes. Preferred; no compromises.

**Betaflight has no such feature.** Checked directly:

- `CUSTOM_ELEMENT` appears nowhere in `src/main/osd/osd_elements.c` on
  either `4.5-maintenance` or `master`.
- No `osd_custom_elements.c` exists at any plausible path in 4.5.
- betaflight-configurator has no UI for it anywhere in `src/`.

It is an **INAV** feature —
`iNavFlight/inav:src/main/io/osd/custom_elements.h`, which defines
`CUSTOM_ELEMENT_TYPE_ICON_STATIC` (the "point at a glyph index" type) and
`CUSTOM_ELEMENTS_PARTS 3`. Even on INAV an element carries three parts, not
the ten the README originally instructed people to configure.

This was repeated into the README as the *preferred* path and shipped. It
is the same class of error as the `#` truncation: a pilot-facing
instruction that no test in this repo can see. Corrected in the README with
the correction left visible rather than quietly edited out.

What actually works on Betaflight:

| Route | Versions | Cost |
|---|---|---|
| Craft name + sacrificial slots | 4.4 → current | ten punctuation glyphs |
| `OSD_CUSTOM_MSG0`–`3` over MSPv2 | `master` only (not 4.5) | nothing |
| High bytes straight into the craft name | untested | nothing, if it works |

The third is worth chasing. Both MSP paths Configurator uses encode the
name with `buffer.push8(config.charCodeAt(i))` — plain 8-bit truncation, no
UTF-8 — and `toupper()` is identity for bytes >= 0x80 in the C locale. So
typing U+00BF–U+00C8 should land bytes `0xBF`–`0xC8` in `craftName`, which
are exactly the wordmark tiles. If that holds on hardware, the
`_craftname` variants are unnecessary. It stays flagged as untested because
it cannot be confirmed from here.

### A trap the craft-name route sets

`osd_craftname_msgs` must be **OFF**. With it on, the firmware overwrites
`craftName` with link-quality and RSSI text every frame:

```c
// Injects data into the CraftName variable for systems which limit
// the available MSP data field in their OSD.
if (osdConfig()->osd_craftname_msgs == true) {
    ...
    strncpy(pilotConfigMutable()->craftName, element->buff, MAX_NAME_LENGTH - 1);
}
```

The wordmark would be replaced by `LQ 8 -72` with no indication why. Present
in both 4.5 and master. Documented in the README install steps.

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

### Licensing

**MIT, for everything original to the repository** — tooling, glyph art,
built fonts, splash and previews alike. An earlier pass split it MIT for
code and CC BY 4.0 for the art; the author asked for one licence across the
lot, which is simpler for anyone redistributing a font pack.

The vendored stock fonts stay GPL-3.0 and the Betaflight project's. That is
not a choice — they are not ours to relicense. They are reference and test
fixtures only, and no stock art is a build base.

### What the `clean` variant actually is

Measured after the fact, because the description had drifted ahead of the
build: `clean` differs from the flagship at **6 of 256 glyphs**. All six
overrides are genuinely closer to stock (the test now asserts it
per-glyph), but across the whole icon block the variant is only about 1.7%
nearer stock than the flagship is -- 6,341 differing pixels against 6,449.

Calling it "icons drawn close to stock silhouettes" oversold that. The
honest version, now in the README: six marks redrawn to the stock shape,
and 73 icons that already followed the stock silhouette left as Army Jay
art. No variant here ships pixel-identical stock icons, and none claims to.

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
- **Nothing here has been flown.** The files are verified against
  Configurator's own code (below), so the *format* is not in doubt. What
  remains unverified is the thing only goggles can answer: whether the art
  reads well on a degraded analog feed. The high-readability variant in
  particular is a designed hypothesis about contrast, not a measured
  result. Fly it before trusting it.

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
