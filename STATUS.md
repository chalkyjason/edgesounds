# Build status

Tracks progress against the Army Jay OSD font build handoff.

**Current position: step 1 complete. Stopped here, as the handoff instructs.**

---

## Step 1 — encoder, decoder, validator

Done and green.

- `tools/mcm_encode.py` — the glyph model and the encoder. This module owns
  the format spec; nothing else restates it.
- `tools/mcm_decode.py` — a parser that is deliberately stricter than
  Configurator's, plus a reviewable ASCII-dump format.
- `tools/validate.py` — the section 8 acceptance checks, CI-shaped.
- `tests/test_mcm_roundtrip.py` — 33 tests, stdlib `unittest` only.

```
$ python -m unittest discover -s tests
Ran 33 tests in 1.0s
OK

$ python tools/validate.py
PASSED -- 2 font(s) validated
```

### The round trip actually round trips

The strongest proof in the suite is
`TestAgainstStockFonts.test_byte_identical_disk_round_trip`: read each stock
font off disk → parse to 256 `Glyph` objects → re-encode → write → compare
raw bytes. Both stock fonts come back **byte for byte identical**, trailing
newline and all.

The validator also has teeth. `TestValidatorCatchesCorruption` mutates a
good font four ways — a non-`0x55` padding byte, an injected `11` pixel
pair, a truncated file, a changed `0x00` — and asserts the matching check
fails each time.

---

## Verified against the real files

Everything here was measured, not assumed.

**The spec in the handoff is correct.** Across both stock fonts: all 2,560
padding bytes are `0x55`, and the pixel pairs are exclusively `00` / `10` /
`01` — there is not a single `11` pair in either file.

**Line count, precisely.** A stock font is 147,463 bytes: a 7-byte header
plus a newline, then 16,384 lines of 8 characters, of which the last is
unterminated. That is 16,385 lines by the handoff's count, but `wc -l`
reports **16384** because it counts newlines. The encoder matches the stock
convention exactly (no trailing newline) so the round trip is byte-clean;
the parser accepts a trailing newline and CRLF on the way in.

**Which stock font is "stock".** Configurator ships two font sets,
`resources/osd/1/` and `resources/osd/2/`, and the current code loads
version **2** unconditionally (`src/js/utils/osdFont.js` and
`src/components/tabs/OsdTab.vue`, `const fontVer = 2`). Version 2 is
therefore the latest glyph map and the correct diff base. 41 of the 256
glyphs differ between v1 and v2. Both are vendored; v2 is the default
reference.

**Boot splash origin — the item the handoff flagged for checking.**
Confirmed against Configurator commit `505bd6d` (2026-09-12):

| Constant | Value | Source |
|---|---|---|
| `SYM.LOGO` | `0xA0` | `src/js/utils/osdFont.js:36` |
| `TILES_NUM_HORIZ` | 24 | `src/js/LogoManager.js` |
| `TILES_NUM_VERT` | 4 | `src/js/LogoManager.js` |
| Expected image | 288 × 72 px | `CHAR_WIDTH × 24` by `CHAR_HEIGHT × 4` |
| Upload colours | `#000` black, `#fff` white, `#0f0` transparent | `MCM_COLORMAP` |

So the splash occupies 96 tiles at `0xA0`–`0xFF` **inclusive**, matching the
handoff. Note the transparent key for the uploaded PNG is pure green
(`0,255,0`), not magenta — magenta is only our preview convention.

---

## Open issue — needs a decision before step 4

**The boot splash range collides with protected index `0xFF`.**

Section 2 of the handoff declares `0xFF` reserved, never to be written.
Section 5a puts the boot splash at `0xA0` for 96 tiles — which ends at
`0xFF` inclusive. Both cannot hold.

Acceptance check 7 (`0x00` and `0xFF` match stock) will fail against any
splash that inks its bottom-right tile. This is not hypothetical: check 9
is currently the only skipped check precisely because this allocation
isn't settled.

Stock resolves it by convention rather than by rule. In both stock fonts,
every tile in `0xA0`–`0xFF` is available, but `0xFF` is left fully
transparent — the artwork simply does not use its last tile. `0xB8`–`0xFE`
carry the stock Betaflight wordmark; `0xA2`–`0xB7` are blank.

**Recommended resolution:** treat the splash as 95 usable tiles, keep
`0xFF` transparent to match stock, and design the 288 × 72 raster so its
bottom-right 12 × 18 corner is empty. That satisfies both sections with no
loss of usable artwork. `tools/validate.py` already encodes `0xA0` and the
96-tile span as constants (`LOGO_START`, `LOGO_TILE_COUNT`), so check 9
only needs the in-flight wordmark range added once step 4 picks it.

This needs a sign-off, not a guess — it constrains the splash composition.

---

## Remaining steps

| Step | Work | State |
|---|---|---|
| 2 | Decode stock to 256 PNGs in `assets/references/` | not started — needs Pillow, the first third-party dependency |
| 3 | ASCII-art glyph modules: numbers, letters, punctuation, icons | not started |
| 4 | Logo raster, `slice_logo.py`, index allocation | blocked on the `0xFF` decision above |
| 5 | `variants.toml` + `build_font.py` → three `.mcm` files | not started |
| 6 | Previews: glyph sheets and logo mock-ups | not started |
| 7 | `MODIFIED_INDEXES.md` + pilot-facing README sections | not started |

Two hooks are already wired for later steps so they fail loudly rather than
silently: `glyphs_from_ascii_map()` refuses to build a font with any
undefined or duplicated index, and validator check 8 starts enforcing
`MODIFIED_INDEXES.md` the moment that file appears.

---

## About the previous contents of this repo

This repository held **EdgeSounds**, a React/Vite in-browser EdgeTX `.wav`
converter with a curated sound library. It shares an audience with this
project — FPV pilots — but no code, no format, and no tooling. It was
removed wholesale rather than carried along.

Nothing is lost: the full history is in git through commit `7c66ca0`, and
`git revert` or a branch off that commit brings it back intact. What was
kept and adapted: `.gitignore`, `.gitattributes` (now pinning `*.mcm` to LF,
which matters — a CRLF checkout produces a font Configurator will not
parse), and the GitHub Actions CI workflow, rewritten from Node to Python.
