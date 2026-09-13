# Army Jay OSD

A Betaflight **analog** OSD font in an Army Jay military/tactical pixel-art
style, built from reviewable ASCII-art sources into valid MAX7456 `.mcm`
files that upload through Betaflight Configurator's Font Manager.

Primary target is a BetaFPV Air75 (analog, MAX7456-class OSD), but the
output is plain `.mcm` and works with any Betaflight build that has an
analog OSD.

> **Build status: step 1 of 7.** The encoder, decoder and validator are
> done and proven byte-identical against Betaflight's own stock fonts. No
> glyph art exists yet, so `fonts/` is empty — there is nothing to flash.
> See [STATUS.md](STATUS.md) for what is done, what was verified, and the
> one design conflict that needs a decision before step 4.

---

## What this is not

HD/digital OSD fonts. DJI, HDZero and msp-osd use 24 × 36 BMP or `.bin`
formats — a different problem entirely, and out of scope here.

---

## The format

Everything below was verified against the stock fonts vendored in
`assets/references/stock/`, not taken on faith.

**File structure (`.mcm`)**

| | |
|---|---|
| Encoding | plain ASCII, LF line endings |
| Line 1 | `MAX7456` |
| Lines 2–16385 | 16,384 lines of exactly 8 `0`/`1` characters, one byte each |
| Total | 256 glyphs × 64 bytes = 16,384 bytes |
| Trailing newline | none — the final byte line is unterminated |

A stock font is 147,463 bytes. Note that `wc -l` reports **16384**, not
16385, because it counts newlines and the last line has none.

**Glyph geometry**

- 12 px wide × 18 px tall = 216 pixels, left-to-right, top-to-bottom.
- 2 bits per pixel, 4 pixels per byte → **54 bytes of real data**.
- Padded from 54 to 64 bytes; the 10 padding bytes are `0x55`
  (`01010101`).

**Pixel encoding**

| Bits | Meaning | ASCII art |
|---|---|---|
| `00` | black | `-` |
| `10` | white | `#` |
| `01` | transparent | `.` |
| `11` | transparent | — accepted on read, never emitted |

---

## Glyph sources

Glyphs are authored as 12 × 18 ASCII art in Python modules under `glyphs/`,
never as hand-placed binary. Every glyph string is validated as exactly 18
rows of 12 legal characters at import time, so the whole font stays
diffable and reviewable in a terminal:

```python
GLYPH_BATTERY_FULL = """
............
.##########.
.#--------#.
.#-######-#.
...
"""
```

---

## Tooling

No third-party dependencies — Python 3.11+ and the standard library.

```bash
# Run the full acceptance suite against the vendored stock fonts
python tools/validate.py --verbose

# Validate specific fonts (this is what CI runs on fonts/*.mcm)
python tools/validate.py fonts/armyjay_full.mcm

# Decode a font to reviewable ASCII art
python tools/mcm_decode.py assets/references/stock/default_v2.mcm -o /tmp/stock.txt

# Decode a single glyph ('A' is 0x41)
python tools/mcm_decode.py assets/references/stock/default_v2.mcm -i 0x41

# Re-encode an ASCII dump back to .mcm
python tools/mcm_encode.py /tmp/stock.txt /tmp/rebuilt.mcm

# Unit tests
python -m unittest discover -s tests -v
```

### Acceptance checks

`tools/validate.py` runs these and exits non-zero if any fail:

| # | Check | Status |
|---|---|---|
| 1 | 16,385 lines, `MAX7456` header, 8 binary chars per line | implemented |
| 2 | All 256 indexes defined; coverage table printed | implemented |
| 3 | Padding bytes are `0x55` for every glyph | implemented |
| 4 | No `11` pixel pairs emitted | implemented |
| 5 | encode → decode → encode is byte-identical | implemented |
| 6 | Decoded ASCII art re-renders to the same pixels | implemented |
| 7 | `0x00` and `0xFF` match stock | implemented |
| 8 | Stock diff matches `MODIFIED_INDEXES.md` | implemented; reports only until that file exists |
| 9 | Boot splash and in-flight tile ranges do not overlap | **skipped** until `glyphs/logo.py` exists (step 4) |

---

## Glyph map policy

- Targets the **latest** Betaflight glyph map. Newer maps are effectively
  supersets — older firmware simply never references the newer indexes — so
  targeting latest maximizes compatibility.
- All 256 indexes must be explicitly defined. The build fails loudly on any
  undefined index rather than silently shipping a blank glyph.
- `assets/references/stock/` is a shape and meaning reference only. It is
  never the build base for `armyjay_full` or `armyjay_highreadability`.

**Protected indexes — never write custom art here**

| Index | Why |
|---|---|
| `0x00` | blanks the screen on video initialization |
| `0xFF` | reserved / special use |
| `0x20`–`0x7E` | must retain their ASCII meanings (the art changes; the mapping does not) |

---

## Variants

One glyph source set, one pipeline, driven by `variants.toml`:

| File | Letters/Numbers | Icons | Notes |
|---|---|---|---|
| `armyjay_full.mcm` | Custom Army Jay | Custom Army Jay | Flagship |
| `armyjay_clean.mcm` | Custom Army Jay | Close to stock silhouettes | For pilots who want familiar icons |
| `armyjay_highreadability.mcm` | Heavier weight, wider spacing | Custom, simplified | Max legibility on degraded analog |

None of these are built yet.

---

## Installing (once fonts ship)

1. Connect the flight controller to Betaflight Configurator.
2. **Props off. Always.** Some boards need a LiPo connected to power the OSD
   chip during upload — the 5 V from USB alone may not bring it up.
3. OSD tab → Font Manager → select the `.mcm` → Upload → reboot.

### Backup and recovery

Before you flash anything:

- Save your current config: CLI tab → `diff all` → copy the output to a file.
- The stock font is always recoverable. Font Manager ships the stock presets,
  and the originals live in the Configurator repo at
  `resources/osd/2/default.mcm`. A copy is vendored here at
  `assets/references/stock/default_v2.mcm`.
- Restoring is the same procedure as installing: pick the stock font, upload,
  reboot. Nothing about a font upload touches your tune or rates.

---

## Repo layout

```
.
├── README.md
├── STATUS.md              build progress and verified findings
├── MODIFIED_INDEXES.md    (step 7) every index, its meaning, what was drawn
├── variants.toml          (step 5) variant definitions
├── fonts/                 (step 5) built .mcm outputs — the deliverable
├── glyphs/                (step 3) ASCII-art glyph sources
├── assets/
│   ├── logo_288x72.png    (step 4) boot splash raster
│   └── references/stock/  decoded stock fonts, reference only
├── previews/              (step 6) glyph sheets and logo previews
├── tests/                 round-trip and format tests
└── tools/
    ├── mcm_encode.py      glyph model + encoder (owns the format spec)
    ├── mcm_decode.py      parser + ASCII dump
    ├── validate.py        acceptance checks
    ├── slice_logo.py      (step 4) 288×72 → 12×18 tiles
    └── build_font.py      (step 5) variants.toml → fonts/*.mcm
```

---

## Order of work

1. ✅ `mcm_encode.py` / `mcm_decode.py` + `validate.py`, proven against the
   stock font.
2. ⬜ Decode stock to `assets/references/` as 256 PNGs.
3. ⬜ ASCII-art glyph modules: numbers, letters, punctuation, then icons.
4. ⬜ Logo raster + `slice_logo.py` + index allocation.
5. ⬜ `variants.toml` + `build_font.py` → three `.mcm` outputs.
6. ⬜ Previews.
7. ⬜ `MODIFIED_INDEXES.md` + pilot-facing README sections.

---

## Attribution

`assets/references/stock/*.mcm` are the stock analog OSD fonts from
[betaflight-configurator](https://github.com/betaflight/betaflight-configurator)
(`resources/osd/1/default.mcm` and `resources/osd/2/default.mcm`, commit
`505bd6d`), vendored unmodified so the round-trip tests are reproducible
offline. Betaflight Configurator is GPL-3.0; those two files are the
project's, not this one's, and are included as a reference and test fixture.

## License

This repository previously held **EdgeSounds**, an in-browser EdgeTX `.wav`
converter, which was MIT licensed. That project's full history is preserved
in git — see commits up to `7c66ca0`. Licensing for the font itself is not
settled yet and is a step-7 deliverable.
