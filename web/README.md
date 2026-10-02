# Army Jay — the website

One site, two halves:

- **Sounds** (`/sounds/*`) — EdgeSounds. Converts any audio file to the
  32 kHz mono 16-bit PCM `.wav` EdgeTX accepts, entirely client-side via
  `ffmpeg.wasm`. Plus a 98-sound library, a My Sounds store (IndexedDB), and
  an EdgeTX setup guide.
- **OSD Fonts** (`/osd/*`) — browses the MAX7456 fonts built by the Python
  pipeline in the parent directory, rendering all 256 glyphs from the `.mcm`
  itself, and edits them:
  - `/osd/fonts/:variant` — every glyph, decoded in the browser, plus downloads
    that serve the **original** bytes.
  - `/osd/fonts/:variant/edit` — a 12×18 pixel editor for any glyph, with
    undo/redo, and a 288×72 boot-splash uploader that fills 0xA0–0xFE.

## Running it

```bash
npm install
npm run dev
```

`predev` and `prebuild` stage `../fonts/*.mcm` and `../previews/*.png` into
`public/osd/` and regenerate the sitemap. Those staged files are gitignored —
the Python pipeline is their only author, and a committed second copy would
drift.

Node 20.19+ or 22.12+ (`.nvmrc` pins 22). Vite 8's rolldown binary is an
optional dependency gated on that engine range, and npm silently skips
optional deps whose engines do not match — on an older Node you get a
successful-looking install and then `MODULE_NOT_FOUND` at build time.

## The `.mcm` codec

`src/lib/mcm/` is a TypeScript port of `tools/mcm_encode.py` /
`tools/mcm_decode.py`.

```
decodeFont(text: string): Font          // throws McmParseError with a line number
encodeFont(font: Font): string
glyphToAscii(glyph) / fontToAscii(font) // the Python decoder's dump format
```

A font that is wrong by one byte fails silently on hardware, so the tests run
against the real artifacts rather than fixtures:

| Test | What it proves |
|---|---|
| `roundtrip.test.ts` | All six shipped fonts and both stock references decode, re-encode and compare **byte-for-byte** with the source file. |
| `crossimpl.test.ts` | All 256 glyphs render character-for-character as `python tools/mcm_decode.py` renders them. The round trip alone cannot catch a consistent black/white swap — that would round-trip perfectly while rendering every glyph inverted. |
| `reject.test.ts` | The four corruptions `tools/validate.py` is tested against are rejected here too, with matching 1-based line numbers. |

Because the tests read `../fonts/` and `../assets/` directly, changing a font
on the Python side breaks this suite.

### One deliberate asymmetry

The decoder maps the bit pair `11` to transparent; the encoder never emits
`11`. This mirrors Python exactly. Round-trip byte-exactness is therefore
guaranteed for **valid** fonts only — which is fine, because `validate.py`
rejects `11` and neither stock font contains one. It reads like a bug. It is
not. Do not "fix" it, or the two implementations stop agreeing.

## Editing

Edits are a sparse map of glyph index to a replacement pixel array, layered
over the shipped font, and kept in their own IndexedDB database
(`armyjay_osd`) so they cannot disturb the saved sounds in `edgesounds`. The
base font is never mutated, so a rebuilt font shows through for every glyph
left untouched.

Undo history is in state, not persisted. The editor's re-encode is the only
place the app writes a `.mcm`; the browse page's download still serves the
bytes it fetched.

The splash uploader runs `slice_logo.py`'s strict three-colour check first
(black, white, and **pure green** for transparent — Configurator's palette,
not magenta). Only if that fails does it offer to snap pixels to the nearest
colour, and it renders the classified result before applying, so a guess is
always seen and accepted rather than made silently. `0xFF` is skipped: it
doubles as `SYM_END_OF_FONT`, so ink in the bottom-right tile is reported
rather than dropped quietly.

## Start screen

`/osd/splash` designs the 288×72 boot splash as a stack of up to 32
**layers** — library shapes, text in the stencil letters, and an image —
each moved, sized, rotated, flipped, filled white or black, outlined, or set
to cut out what is below; **Paint** is a sparse layer of pixel overrides on
top. Tap, drag, pinch and twist work directly on the preview. A design saved
before layers converts on load, pixel for pixel
(`src/lib/emblem/__tests__/design.test.ts`). See
[the design spec](../docs/superpowers/specs/2026-10-02-emblem-layers-design.md).

The shape library is `../assets/shapes/<pack>/*.svg` with authors and
licences in `../assets/shapes/packs.json`: Basics, Insignia and FPV are drawn
by `tools/draw_shapes.py` (MIT); Military and Beasts & Emblems come from
game-icons.net (CC BY 3.0, credited on `/credits`); Symbols from Tabler Icons
(MIT). `scripts/build-shapes.mjs` flattens them to polygons in
`public/osd/shapes.json` before dev and build, and `src/lib/emblem` rasterizes
them itself, so the pixels match on every browser.

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

## iPhone app

The same site, wrapped in Capacitor. Nothing about the web build changes;
the app detects at runtime that it is native (`src/platform/platform.ts`)
and swaps only the export path (`saveFile` / `SaveLink`: share sheet instead
of `<a download>`), three lines of copy, and the donation link.

```bash
npm run build:ios   # build, derive dist-ios/, cap sync
npm run ios:sim     # unsigned simulator build (DerivedData under ~/Library)
npm run ios:open    # the Xcode project, for a signed build on a phone
npm run ios:release # App Store archive + signed IPA in build-ios/export/ (bump CURRENT_PROJECT_VERSION first)
```

`dist-ios/` is `dist/` with the library trimmed to the 6 sounds licensed
`generated-original` (`scripts/trim-library.mjs`, an allowlist that fails
closed), and ffmpeg, Betaflight's stock font and the web-host files removed
(`scripts/prepare-ios.mjs`). Capacitor's `webDir` points at `dist-ios/`,
never `dist/`, so the 71 fair-use clips and the 21 `windows-tts` callouts
(made with Windows' Zira voice, whose terms for redistribution are unclear)
cannot reach the App Store build.

The Xcode project under `ios/` is committed. It is iPhone-only, portrait,
iOS 15+, forced dark, and carries the privacy manifest the Filesystem plugin
requires. The icon is drawn by `../tools/make_ios_icon.py`.

One quirk worth knowing: the `capacitor://` asset handler serves bundled
audio through a range-request path that `fetch()` reports as status 0, not
200. `saveFile` accepts that; a missing file throws instead.

## Deploy

Static host; Cloudflare Pages root directory is `web/`. `public/_headers`
carries the COOP/COEP pair `ffmpeg.wasm` needs for `SharedArrayBuffer`, and
`public/_redirects` is the SPA fallback — without it every deep link 404s.

The public origin lives in `.env` as `VITE_SITE_URL`; `index.html` and the
generated `sitemap.xml`/`robots.txt` all read from it.
