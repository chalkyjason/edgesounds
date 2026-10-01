# Start screen maker: design a boot splash in the app

**Date:** 2026-10-01
**Status:** draft for review
**Scope:** one page, `/osd/splash`, plus the shared stencil alphabet it needs

## Context

Betaflight's analog OSD shows a 288 × 72 boot splash, stored as the 96 font
tiles `0xA0`–`0xFF`. The Army Jay fonts replace Betaflight's splash with the
Army Jay wordmark; a pilot who wants their *own* start screen today has to
draw a 288 × 72 PNG in exactly three colours and feed it to the glyph
editor's uploader (`LogoUpload`), or to Configurator's.

The request: let a pilot make the start screen in the app, from typed text,
from any image, or by painting pixels, and get a font with it in — either an
Army Jay variant or the stock Betaflight font with only the splash swapped.

What exists and is reused unchanged:

| Piece | Where | Role here |
|---|---|---|
| `.mcm` codec | `web/src/lib/mcm/{decode,encode}.ts` | compose and write the exported font |
| Splash slicer | `web/src/lib/mcm/logo.ts`: `rasterToTiles`, `tilesToEdits`, `LOGO_*`, `RESERVED_INDEX` | raster → 95 tiles, reserved-tile report |
| Font loading | `useFont`, `useVariants`, `public/osd/variants.json` | base fonts |
| Export | `SaveLink` / `saveFile` | works on the web and in the iPhone app |
| Edit store | `web/src/utils/fontStorage.ts` (`armyjay_osd`, v1) | gains a second store |
| Splash letterforms and layout | `tools/make_logo.py`: `BIG_STENCIL`, `SMALL_STENCIL`, `build_mask`, `outline_mask` | become shared data and a TypeScript port |

The letterforms only cover the wordmark: big `A J M R Y`, small
`A C D I L O S T`. Typed text needs the whole alphabet; drawing it is the
largest single piece of this work.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Model | One **generator** (Text template *or* Image) produces the base raster; **Paint** is a sparse layer of pixel overrides on top | The glyph editor's base-plus-edits pattern. Change the text later and the touch-ups survive. One mental model covers all three inputs. |
| Where | New page `/osd/splash` ("Start screen"), in the OSD nav | Design once, export into any base. The glyph editor's splash section stays and links here. |
| Base fonts | The three Army Jay variants **and** stock Betaflight `default_v2.mcm` | Many pilots want the default glyphs with their own splash. The stock file is already vendored. |
| Stencil letterforms | Move to a **shared data file**, `assets/splash_stencils.json`, read by Python and staged for the web | One set of letterforms. CI already rebuilds `fonts/` and fails on a diff, so the move is proven not to change the shipped splash. |
| Text layout | Template only: big line on tile row 1, small line on row 2, centred; rules on rows 0 and 3 switchable; outline automatic | Today's layout. Type and it looks right; nothing to drag on a phone. |
| Image conversion | Fit inside 288 × 72, grey, threshold slider, invert, background transparent/black, outline toggle; no dithering | Dither noise reads as garbage on an analog feed. A live preview makes the threshold obvious. |
| Export | `.mcm` through `SaveLink`, or a three-colour PNG for Configurator's uploader | The `.mcm` is the product; the PNG serves people who flash with Configurator's own tool. |

### Decisions that are yours to confirm

1. **Stencil character set:** A–Z, 0–9, space, and `- . ! ' /`. Lowercase is
   uppercased. Anything else is left out of the rendering and named in a
   warning under the input — never dropped silently.
2. **Stock font licence note:** the option is labelled "Betaflight's default
   font (GPL-3.0)". The exported file is a derivative of that font and carries
   the same licence; the page says so in one line.
3. **Letterform review gate:** the ~60 new glyphs ship only after you have
   looked at `previews/stencil_sheet.png`. Taste is not testable.

## Layout

```
assets/
  splash_stencils.json       NEW  the two stencil fonts, one source for Python and web
  logo_288x72.png                 unchanged bytes; now rendered from the JSON
previews/
  stencil_sheet.png          NEW  both alphabets rendered for review
tools/
  make_logo.py               MOD  reads the JSON; stencil dicts removed
  build_previews.py          MOD  also renders stencil_sheet.png
tests/
  test_stencils.py           NEW  JSON shape, coverage, rectangular glyphs
web/
  scripts/stage-osd-assets.mjs   MOD  also stages stencils.json and the stock font
  src/
    lib/splash/
      stencils.ts            NEW  types + `composeText` (string → white mask rows)
      template.ts            NEW  `renderTemplate` (text lines + rules → raster)
      image.ts               NEW  `rasterizeImage` (RGBA → raster, threshold etc.)
      outline.ts             NEW  `outlineMask` port
      raster.ts              NEW  Raster type, `applyPaint`, `rasterToRgba`, `emptyRaster`
      compose.ts             NEW  `fontWithSplash` (base Font + raster → Font), `splashPng`
      __tests__/             NEW
    hooks/useSplashDesign.ts NEW  state, undo/redo for paint, persistence
    utils/splashStorage.ts   NEW  the `splash` store in armyjay_osd (DB version 2)
    components/splash/
      TextTemplatePanel.tsx  NEW
      ImagePanel.tsx         NEW
      PaintCanvas.tsx        NEW
      SplashPreview.tsx      NEW  over grey "video", plus the tile view
      ExportPanel.tsx        NEW  base picker, .mcm and PNG
    pages/osd/SplashMaker.tsx NEW  the page
```

`public/osd/stencils.json` and `public/osd/fonts/betaflight_default.mcm` are
staged at build time like the other OSD assets, and gitignored.

## The stencil alphabet

### File

```json
{
  "big":   { "height": 14, "glyphs": { "A": ["...######...", "..########..", "..."], "B": ["..."] } },
  "small": { "height": 9,  "glyphs": { "A": ["..####", "..."] } }
}
```

Rows are strings of `.` (clear) and `#` (white). Every row of a glyph has the
same length; glyphs may differ in width (`I` and `1` are narrower than `M`).
`" "` (space) is a glyph of clear rows, 12 wide in `big` and 6 in `small`, as
today — changing either would move every word on the shipped splash.

### Composition rules (today's, made explicit)

- Letters are joined with a 2 px gap in both fonts.
- A line is centred horizontally across the full 288 px, and vertically
  within its 18 px tile row.
- The big line sits on row 1, the small line on row 2.
- Rules: 3 px thick, from x = 24 to x = 264, vertically centred in rows 0 and
  3. The top rule carries the five-step chevron caps; the bottom one does
  not — that is how the shipped splash is drawn, whatever `make_logo.py`'s
  comment says about "matching". Both rules are one switch.
- The outline is a 1 px black halo around every white pixel, computed over
  the whole raster so it is continuous across tile seams.

### Authoring and review

The 5 + 8 existing glyphs are moved as they are. About 60 new glyphs are
drawn in the same idiom: squared terminals, closed counters, 3 px strokes in
`big`, 1–2 px in `small`. `tools/build_previews.py` renders both alphabets at
4× to `previews/stencil_sheet.png`. The review gate above applies.

### Proof the move changed nothing

`tests/test_stencils.py` asserts that `make_logo.render()` is **pixel-identical**
to the committed `assets/logo_288x72.png`, and pins the moved letterforms
verbatim. Pixels, not bytes: PNG encoders differ across Pillow and zlib
versions, so a `git diff` on the file would fail spuriously. The committed
PNG is not rewritten.

## The page

### State

```ts
interface SplashDesign {
  generator: 'text' | 'image'
  text: { big: string; small: string; rules: boolean }
  image: {
    source: Blob | null        // the file as dropped, so settings can be re-applied
    threshold: number          // 0..255, default 128
    invert: boolean
    background: 'transparent' | 'black'
    outline: boolean
  }
  paint: Record<number, Pixel> // raster offset (y * 288 + x) -> override
}
```

`raster = applyPaint(generate(design), design.paint)` where `generate` is
`renderTemplate` or `rasterizeImage` by `design.generator`. Everything below
reads `raster`; nothing reads the generator output directly.

Paint has undo/redo in memory, as the glyph editor does (not persisted). The
design itself is saved to IndexedDB on every change, debounced, and restored
on load. "Start over" clears both.

### Text template panel

Two inputs, big and small, and the rules switch. Input is uppercased as
typed. Below each input, live: the rendered width ("214 of 288 px"), or
"6 px too wide" in red when it overflows — the line is then not drawn at
all, never clipped — and any unsupported characters by name ("no stencil
for `@`").

### Image panel

A drop zone accepting `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
The image is scaled to fit inside 288 × 72 (aspect kept, centred), converted
to grey, and thresholded. Controls: threshold slider, Invert, Background
(transparent | black), Outline. Every change re-rasterises from the stored
source blob; the preview updates live.

Pixels with alpha < 128 are transparent regardless of the threshold. With
`background: 'black'`, pixels below the threshold are black instead of
transparent — for logos that need a solid plate behind them.

A ready-made three-colour 288 × 72 image simply thresholds cleanly; the
glyph editor's strict uploader is untouched.

### Paint canvas

The raster at 3× (864 × 216 CSS px) in a horizontally scrollable container,
`touch-none`, pointer events, the same drag-paint loop as `GlyphEditorCanvas`.
Overlay: the 24 × 4 tile grid, with `0xFF` (bottom-right) hatched. Tools:
White, Black, Clear; brush 1, 2, 3 px; Undo, Redo; Clear paint. Painting
writes only to `design.paint`.

### Preview

Two canvases: the raster at 2× over a mid-grey (`#7a7a7a`) "video"
background with transparent pixels showing the grey, and the same raster
sliced into tiles with 1 px seams. The first is the honest view — contrast
on a feed is the whole point of the black outline.

### Export panel

Base: `armyjay_full`, `armyjay_clean`, `armyjay_highreadability` (from
`variants.json`) and `betaflight_default` (stock v2, labelled GPL-3.0). Then:

- **Download `.mcm`** — `fontWithSplash(base, raster)` replaces glyphs
  `0xA0`–`0xFE` with the sliced tiles, leaves `0xFF` and every other glyph
  exactly as in the base, and goes through `encodeFont` → `SaveLink` as
  `<base>_splash.mcm`. The byte count is shown with the `147,463 · valid`
  check the glyph editor uses.
- **Download PNG for Configurator** — the raster as a 288 × 72 PNG in the
  three upload colours (black, white, pure green), via `SaveLink`, as
  `start_screen.png` — the PNG does not depend on the base.

If the bottom-right tile has ink, the panel says it will not be written and
why (`0xFF` is the end-of-font marker), as the uploader does today. If the
whole raster is transparent, both buttons are disabled with "the start
screen is empty".

### Staging

`stage-osd-assets.mjs` additionally copies
`assets/splash_stencils.json` → `public/osd/stencils.json` and
`assets/references/stock/default_v2.mcm` → `public/osd/fonts/betaflight_default.mcm`,
and fails the build if either is missing.

### Nav

"Start screen" is added to the OSD sub-nav after "All fonts". The glyph
editor's Boot splash section gets one line: "Or design one — Start screen →".

## Errors

| Case | Behaviour |
|---|---|
| Unreadable or non-image file | Error naming the file and the accepted types |
| Unsupported character in a text line | The line renders its supported characters and the warning names the missing ones under the input, so nothing is dropped silently and the pilot still sees their text |
| Line wider than 288 px | "N px too wide"; the line is not drawn |
| Ink in `0xFF` | Warned in the export panel; tile not written |
| Empty raster | Export disabled with a message |
| Stencils or stock font fail to load | The affected tool shows the fetch error; the rest of the page works |
| IndexedDB unavailable | Design works for the session; a note says it will not be remembered |

## Testing

**Python (`tests/test_stencils.py`):** the JSON parses; both fonts have every
character in the set; every glyph is rectangular with the font's height and
uses only `.`/`#`; the moved glyphs equal the strings they replaced (pinned
once, then the file is the source); the space widths are the originals;
`make_logo.render()` is pixel-identical to `assets/logo_288x72.png`; the
stencil sheet renders.

**TypeScript, the decisive test:** `renderTemplate({ big: 'ARMY JAY', small:
'TACTICAL OSD', rules: true })` → `rasterToTiles` must equal glyphs
`0xA0`–`0xFE` decoded from the real `fonts/armyjay_full.mcm`, pixel for
pixel, with `0xFF` empty. One test pins the stencil port, the outline port,
the gaps, the rules and the centring, against an artifact CI keeps honest.

Then, as pure-function tests:

- `composeText`: width arithmetic, variable-width glyphs, the 2 px gap,
  uppercasing, unsupported characters reported with their names, overflow
  reported with the pixel count.
- `outlineMask`: a single white pixel gains eight black neighbours; halos do
  not overwrite white; edges of the raster are respected.
- `rasterizeImage`: a 2 × 2 synthetic image through threshold, invert,
  background and alpha; fit-and-centre for a wide and a tall input.
- `applyPaint` and the paint reducer: override, undo, redo, redo cleared by
  a new stroke, brush sizes cover the right offsets, out-of-bounds ignored.
- `fontWithSplash`: every glyph outside `0xA0`–`0xFE` is `toBe` the base's;
  `0xFF` is the base's; the tiles match the raster.
- `splashPng`: the signature, an IHDR of 288 × 72, and the IDAT inflated with
  Node's own zlib — so the hand-rolled stored-deflate stream is checked by a
  real decoder — with the scanlines compared to `rasterToRgba`.
- Storage: the v1 → v2 upgrade keeps `font_edits` intact (fake-indexeddb
  is **not** added; the upgrade function is tested by calling it with a stub
  `IDBDatabase` that records `createObjectStore` calls).

**By hand, desktop and iPhone:** type a callsign and see it; drop a photo
and find a threshold that reads; paint a pixel with a finger; export to the
stock font and open it in Configurator's font manager; reload and find the
design still there.

## Out of scope

- Free text placement, multiple text blocks, layers.
- Dithering.
- Fonts other than the three variants and stock v2 (e.g. a user-uploaded
  `.mcm` as a base).
- Editing anything outside `0xA0`–`0xFE`.
- Android.

## Acceptance criteria

1. `python tools/make_logo.py` renders a raster pixel-identical to the
   committed `assets/logo_288x72.png` (asserted by test), and
   `python tools/build_font.py --craft-name` leaves `fonts/` unchanged; the
   Python suite passes with the new tests.
2. The decisive TypeScript test passes: the web compositor reproduces the
   shipped splash tile for tile.
3. `/osd/splash` renders text, image and paint into one raster, previews it
   over grey, and exports a valid 147,463-byte `.mcm` for each of the four
   bases, plus the PNG.
4. A design survives a reload; "Start over" clears it.
5. Lint, type-check and the full web suite pass; the existing 92 tests are
   untouched.
6. `previews/stencil_sheet.png` exists and has been reviewed.
