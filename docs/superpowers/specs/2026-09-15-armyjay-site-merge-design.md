# Army Jay site: EdgeSounds + OSD fonts under one shell

**Date:** 2026-09-15
**Status:** approved design, slice 1 of 6
**Scope:** sub-projects A + B + C (see Decomposition)

## Context

Two finished, unrelated projects need to become one website.

- **EdgeSounds** — React 19 + TypeScript + Vite. An in-browser EdgeTX `.wav`
  converter (ffmpeg.wasm, client-side only), a 98-sound library, an EdgeTX
  setup guide, and My Sounds (IndexedDB). Currently on the branch
  `fix/edgetx-correctness-and-deploy`, which also carries a correctness fix:
  EdgeTX's filename limit is 8 (`LEN_FUNCTION_NAME`), not 6, and six of the
  nine shipped auto-trigger callouts had names that could never fire.
- **Army Jay OSD fonts** — a Python pipeline building Betaflight MAX7456
  `.mcm` fonts. Three variants plus three craft-name builds, 68 tests, a
  validator, and a cross-check against Betaflight Configurator's own parser.
  Currently on `main`.

The goal is a single site where both live: audio tooling and OSD font
tooling for FPV pilots.

## Decisions already taken

| Decision | Choice | Why |
|---|---|---|
| What the OSD half does on the web | Eventually a glyph-level editor | User's call; largest of the four options offered |
| Where font authoring lives | **Python stays the source of truth** | A pixel editor needs a *starting font* and an *editor*, not the glyph *generators*. Porting `letters.py` / `icons.py` / `logo.py` would create two implementations of one spec that must stay byte-identical forever. Keeping Python means CI still rebuilds and verifies every shipped font. |
| Repo layout | Python untouched at root, web app in `web/` | The Python side is verified working now (68 tests, validator, cross-check vs Configurator `c11f761`). A monorepo restructure would relocate every path and force all of that to be rebuilt and re-verified, for no benefit until a second consumer of the codec exists. |
| Branding | "Army Jay" umbrella, two sections | `armyjay` is the user's handle and already the OSD font brand. Scales to further FPV tools. |
| URLs | Namespaced (`/sounds/...`, `/osd/...`) | A new domain is coming anyway, so this is the cheapest moment to pay the cost. |

## Decomposition

This work is too large for one spec. Six sub-projects:

| | Sub-project | Depends on | In this slice |
|---|---|---|---|
| A | Site merge + shell | — | **yes** |
| B | `.mcm` codec in TypeScript | — | **yes** |
| C | Font browser + preview | A, B | **yes** |
| D | Glyph editor (12x18 pixel grid) | B, C | no |
| E | Logo upload -> splash tiles | B, C | no |
| F | Save + export (IndexedDB) | B | no |

B is both the riskiest piece and the foundation: a codec that is wrong by one
byte produces fonts that fail silently on hardware. It is also perfectly
isolated — a pure library, testable against six fonts already proven
byte-exact — so it gets built and proven before any editor sits on top.

## A — Site merge and shell

### Repo layout

```
/                          Python pipeline, paths UNCHANGED
  tools/ glyphs/ fonts/ previews/ assets/ tests/
  variants.toml ruff.toml requirements*.txt
  docs/superpowers/specs/
  web/                     NEW
    public/
      osd/fonts/*.mcm      staged from ../fonts at build
      osd/previews/*.png   staged from ../previews at build
      sounds/**            EdgeSounds library audio
      library.json _headers _redirects og.png sitemap.xml
    src/
      lib/mcm/             the codec (B)
      pages/ components/ hooks/ utils/ types/
    package.json vite.config.ts tsconfig*.json
```

EdgeSounds is restored from `fix/edgetx-correctness-and-deploy` into `web/`,
carrying all four of its commits. The EdgeTX correctness work is not redone.

Staging `fonts/` and `previews/` into `web/public/osd/` is a build step
(`web/scripts/stage-osd-assets.mjs`, run from `prebuild`), not a commit of
duplicated binaries. The Python pipeline remains the only writer of those files.

### Information architecture

Nav: **Army Jay**, two groups.

| Group | Routes |
|---|---|
| Sounds | `/sounds/library`, `/sounds/convert`, `/sounds/my`, `/sounds/setup` |
| OSD Fonts | `/osd`, `/osd/fonts/:variant` |
| — | `/` (shared landing introducing both halves) |

Shared `Layout`, `Nav`, `Footer`, `ErrorBoundary`, `Toaster`. The existing
EdgeSounds components are reused; nav grows a group concept.

## B — The `.mcm` codec

### Format (verified against both stock fonts and Configurator)

| Property | Value |
|---|---|
| Header | `MAX7456` + `\n` (7 bytes + newline) |
| Glyph | 12 x 18 = 216 pixels |
| Encoding | 2 bits per pixel, 4 pixels per byte |
| Data | 54 bytes per glyph |
| Field | 64 bytes per glyph (54 data + 10 padding) |
| Padding byte | `0x55` = `01010101` |
| Lines | 256 x 64 = 16384, each 8 characters of `0`/`1` |
| Total | 147463 bytes; the final line is **unterminated** |
| Pixel bits | `00` black, `10` white, `01` transparent |

`wc -l` reports 16384, not 16385, because of the unterminated final line.

### API

```ts
// web/src/lib/mcm/types.ts
export type Pixel = 'black' | 'white' | 'transparent'
export interface Glyph { pixels: Pixel[] }   // 216, row-major
export type Font = Glyph[]                   // exactly 256

// decode.ts
export function decodeFont(text: string): Font   // throws McmParseError
// encode.ts
export function encodeFont(font: Font): string
```

`McmParseError` carries a 1-based file line number, mirroring the Python
parser's diagnostics.

### Strictness, and one deliberate asymmetry

The decoder is lenient in exactly one way, matching Python: a `11` bit pair
decodes as transparent. The encoder never emits `11`. A font containing `11`
would therefore not round-trip byte-exactly — which is acceptable because the
validator rejects `11`, and neither stock font contains a single instance.
**Round-trip exactness is guaranteed for valid fonts only, and this is
intentional.** Any port that "fixes" this asymmetry breaks parity with Python.

The decoder additionally rejects: a wrong header, a line count other than
16384, any line that is not 8 characters of `0`/`1`, and padding bytes that
are not `0x55`. It accepts a trailing newline and CRLF on input (tolerant on
read, exact on write).

### Testing — the part that matters

Vitest, added to `web/` (EdgeSounds currently has no tests at all).

1. **Golden round trip.** Each of the six shipped fonts and both vendored
   stock references: read from `../fonts/*.mcm` and
   `../assets/references/stock/default_v{1,2}.mcm`, decode, re-encode,
   assert byte-identical to the source. Tests read the *real* files, so a
   change on the Python side fails the TypeScript suite immediately.
2. **Shape.** 256 glyphs, 216 pixels each, after decoding every font.
3. **Rejection.** The same four corruptions the Python validator catches:
   non-`0x55` padding, an injected `11` pair, truncation, and a changed
   protected byte. Each must throw with the right line number.
4. **Cross-implementation spot check.** A sample of glyphs decoded in
   TypeScript must match the Python-rendered PNGs in
   `assets/references/png/`, pixel for pixel.

## C — Font browser

`/osd` — landing page: what the fonts are, the three variants, and the install
steps (props off; some boards need a LiPo to power the OSD chip; Font Manager
-> Open Font File -> Upload). Content comes from the existing README.

`/osd/fonts/:variant` — the glyph sheet is rendered **from the `.mcm` through
the codec** onto canvas, not from the prebuilt PNG. The codec is therefore
exercised on every page load, and a decode bug shows as a visibly broken glyph
rather than a silent wrong byte. The page also shows the prebuilt logo preview
PNG, the variant description from `variants.toml`, and a download button.

Rendering: canvas at integer scale, transparent pixels drawn as a checkerboard
so they are distinguishable from black.

### Data flow

```
fetch /osd/fonts/<variant>.mcm  ->  decodeFont()  ->  Font
                                         |
                            render glyph sheet to canvas
                            download original bytes on click
```

The download serves the **original fetched bytes**, never a re-encode, so what
the user flashes is exactly what CI verified.

## Error handling

- `decodeFont` throws `McmParseError` with a line number; nothing returns a
  partially-parsed font.
- A font that fails to fetch or parse renders an error panel naming the file
  and the line, not an empty grid.
- The existing `ErrorBoundary` wraps the OSD routes as it does the rest.

## CI

The Python jobs (`validate`, `crosscheck`) are unchanged. One job is added:

```yaml
web:
  - node 22
  - npm ci --prefix web
  - npm run lint --prefix web
  - npm run test --prefix web
  - npm run build --prefix web
```

The web build runs the asset staging step, so a missing or renamed font
breaks the build rather than shipping a 404.

## Deploy

Cloudflare Pages root directory becomes `web/`. `_headers` (COOP/COEP, still
required for ffmpeg.wasm's `SharedArrayBuffer`) and `_redirects` (SPA
fallback) move to `web/public/`. The OG/sitemap base URL is parameterised
rather than hardcoded.

**Open item:** the domain. `edgesounds.pages.dev` no longer describes the site.
Needs a decision before the sitemap and OG tags are final.

## Out of scope

Glyph editor (D), logo upload (E), font persistence (F). My Sounds keeps its
existing audio-only IndexedDB store; fonts get their own store in F.

## Acceptance criteria

1. `npm run build --prefix web` produces a site serving both halves.
2. Every EdgeSounds feature still works: convert, library, ZIP, My Sounds,
   setup guide — with the corrected 8-character limit and EdgeTX trigger names.
3. All six fonts and both stock references pass the byte-exact golden test.
4. `/osd/fonts/:variant` renders all 256 glyphs from the decoded `.mcm`.
5. The Python suite still passes untouched: 68 tests, validator, cross-check.
6. CI is green on all three jobs.
