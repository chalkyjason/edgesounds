# Army Jay Site Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One website serving both EdgeSounds (EdgeTX audio tooling) and the Army Jay OSD fonts, with a byte-exact TypeScript `.mcm` codec proven against the fonts the Python pipeline ships.

**Architecture:** The Python pipeline stays at the repo root, untouched and still the sole authority on font authoring. A Vite app lives in `web/`, restored from `fix/edgetx-correctness-and-deploy`. A build step stages `fonts/` and `previews/` into `web/public/osd/` rather than committing duplicates. The codec in `web/src/lib/mcm/` is tested against the real shipped fonts, so Python-side changes break the TypeScript suite immediately.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind 3, react-router 7, Vitest, ffmpeg.wasm, Python 3.11 (unchanged).

**Spec:** `docs/superpowers/specs/2026-09-15-armyjay-site-merge-design.md`

**Status: complete.** Slice 1 (A+B+C) shipped, and D (glyph editor), E (splash
upload) and F (persistence) followed in the same session — all six
sub-projects of the spec's decomposition are done. Verified: 68 Python tests,
46 web tests, ruff, eslint, the validator, and the Configurator cross-check
all green, with `fonts/` byte-for-byte unchanged throughout.

## Global Constraints

- Node 20.19+ or 22.12+ (`.nvmrc` pins 22). Optional deps are engine-gated; an older Node silently skips the rolldown binary and `vite build` dies with MODULE_NOT_FOUND.
- The Python pipeline's paths MUST NOT move: `tools/`, `glyphs/`, `fonts/`, `previews/`, `assets/`, `tests/`, `variants.toml`.
- `.mcm` files are ASCII and MUST stay LF. `.gitattributes` already pins this; do not weaken it.
- Font format, verified: `MAX7456` header + `\n`; 256 glyphs; 12x18 = 216 px; 2 bits/px; 54 data bytes + 10 padding bytes (`0x55`) = 64 bytes/glyph; 16384 lines of 8 chars; 147463 bytes total; **final line unterminated**.
- Pixel bits: `00` black, `10` white, `01` transparent. Decoder maps `11` -> transparent (parity with Python); encoder MUST NEVER emit `11`.
- EdgeTX filename limit is 8 (`LEN_FUNCTION_NAME`), not 6. Do not reintroduce 6.
- Downloads serve the original fetched bytes, never a re-encode.

---

### Task 1: Scaffold `web/` and restore EdgeSounds

**Files:**
- Create: `web/**` (restored from `origin/fix/edgetx-correctness-and-deploy`)
- Modify: `.gitignore` (add `web/node_modules`, `web/dist`)

**Interfaces:**
- Consumes: nothing
- Produces: a buildable Vite app at `web/` with all EdgeSounds features intact.

- [ ] **Step 1: Restore the EdgeSounds tree into `web/`**

```bash
git checkout origin/fix/edgetx-correctness-and-deploy -- \
  index.html package.json package-lock.json eslint.config.js \
  postcss.config.js tailwind.config.js vite.config.ts \
  tsconfig.json tsconfig.app.json tsconfig.node.json \
  src public patches scripts/sync-ffmpeg.mjs
mkdir -p web
for p in index.html package.json package-lock.json eslint.config.js \
         postcss.config.js tailwind.config.js vite.config.ts \
         tsconfig.json tsconfig.app.json tsconfig.node.json src public patches; do
  git mv "$p" "web/$p"
done
mkdir -p web/scripts && git mv scripts/sync-ffmpeg.mjs web/scripts/sync-ffmpeg.mjs
```

- [ ] **Step 2: Point ignores at the new location**

Append to `.gitignore`:
```
web/node_modules
web/dist
web/public/ffmpeg/
web/public/osd/
```

- [ ] **Step 3: Install and build**

Run: `cd web && npm install && npm run build`
Expected: build succeeds; `web/dist/index.html` exists.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Restore EdgeSounds into web/"
```

---

### Task 2: `.mcm` codec — types and decoder

**Files:**
- Create: `web/src/lib/mcm/types.ts`, `web/src/lib/mcm/decode.ts`
- Create: `web/src/lib/mcm/__tests__/decode.test.ts`
- Modify: `web/package.json` (add vitest), `web/vite.config.ts` (test config)

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Pixel = 'black' | 'white' | 'transparent'`
  - `interface Glyph { pixels: Pixel[] }` — 216 entries, row-major
  - `type Font = Glyph[]` — exactly 256
  - `class McmParseError extends Error { line: number }`
  - `function decodeFont(text: string): Font`
  - constants `GLYPH_WIDTH=12`, `GLYPH_HEIGHT=18`, `PIXELS_PER_GLYPH=216`, `GLYPH_COUNT=256`, `FIELD_BYTES_PER_GLYPH=64`, `DATA_BYTES_PER_GLYPH=54`, `PAD_LINE='01010101'`, `HEADER='MAX7456'`

- [ ] **Step 1: Add Vitest**

```bash
cd web && npm i -D vitest
```
Add to `web/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test**

```ts
// web/src/lib/mcm/__tests__/decode.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeFont, GLYPH_COUNT, PIXELS_PER_GLYPH } from '../decode'

const REPO = resolve(__dirname, '../../../../..')
const font = (p: string) => readFileSync(resolve(REPO, p), 'latin1')

describe('decodeFont', () => {
  it('decodes a shipped font to 256 glyphs of 216 pixels', () => {
    const f = decodeFont(font('fonts/armyjay_full.mcm'))
    expect(f).toHaveLength(GLYPH_COUNT)
    for (const g of f) expect(g.pixels).toHaveLength(PIXELS_PER_GLYPH)
  })

  it('reads stock v2 and finds 0xFF fully transparent', () => {
    const f = decodeFont(font('assets/references/stock/default_v2.mcm'))
    expect(new Set(f[0xff].pixels)).toEqual(new Set(['transparent']))
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `cd web && npx vitest run src/lib/mcm`
Expected: FAIL — cannot resolve `../decode`.

- [ ] **Step 4: Implement `types.ts` and `decode.ts`**

Decoder rules: strip a trailing newline and any `\r`; require the first line to equal `MAX7456`; require exactly 16384 remaining lines; each line exactly 8 chars of `0`/`1`; for each glyph take 64 lines, the first 54 are data and the last 10 MUST equal `01010101`; map bit pairs `00`->black, `10`->white, `01`->transparent, `11`->transparent. Throw `McmParseError` with a 1-based file line number.

- [ ] **Step 5: Run the test again**

Run: `cd web && npx vitest run src/lib/mcm`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/mcm web/package.json web/package-lock.json
git commit -m "Add .mcm decoder with tests against the shipped fonts"
```

---

### Task 3: `.mcm` encoder and byte-exact round trip

**Files:**
- Create: `web/src/lib/mcm/encode.ts`
- Create: `web/src/lib/mcm/__tests__/roundtrip.test.ts`

**Interfaces:**
- Consumes: `decodeFont`, `Font`, `Glyph`, `Pixel` from Task 2
- Produces: `function encodeFont(font: Font): string`

- [ ] **Step 1: Write the failing round-trip test**

```ts
// web/src/lib/mcm/__tests__/roundtrip.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeFont } from '../decode'
import { encodeFont } from '../encode'

const REPO = resolve(__dirname, '../../../../..')
const FONTS = [
  'fonts/armyjay_full.mcm',
  'fonts/armyjay_full_craftname.mcm',
  'fonts/armyjay_clean.mcm',
  'fonts/armyjay_clean_craftname.mcm',
  'fonts/armyjay_highreadability.mcm',
  'fonts/armyjay_highreadability_craftname.mcm',
  'assets/references/stock/default_v1.mcm',
  'assets/references/stock/default_v2.mcm',
]

describe.each(FONTS)('%s', (rel) => {
  it('round-trips byte for byte', () => {
    const original = readFileSync(resolve(REPO, rel), 'latin1')
    expect(encodeFont(decodeFont(original))).toBe(original)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npx vitest run src/lib/mcm`
Expected: FAIL — cannot resolve `../encode`.

- [ ] **Step 3: Implement `encode.ts`**

Emit `MAX7456\n`, then for each glyph 54 data lines built from the pixel pairs (`black`->`00`, `white`->`10`, `transparent`->`01`) followed by 10 `01010101` lines. Join with `\n` and **do not** append a trailing newline.

- [ ] **Step 4: Run and confirm all eight pass**

Run: `cd web && npx vitest run src/lib/mcm`
Expected: PASS, 8 round-trip cases.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/mcm && git commit -m "Add .mcm encoder; prove byte-exact round trip on all 8 fonts"
```

---

### Task 4: Codec rejection tests

**Files:**
- Create: `web/src/lib/mcm/__tests__/reject.test.ts`

**Interfaces:**
- Consumes: `decodeFont`, `McmParseError`
- Produces: nothing new

- [ ] **Step 1: Write the tests**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decodeFont, McmParseError } from '../decode'

const REPO = resolve(__dirname, '../../../../..')
const good = () => readFileSync(resolve(REPO, 'fonts/armyjay_full.mcm'), 'latin1')
const lines = () => good().split('\n')

describe('decodeFont rejects', () => {
  it('a bad header', () => {
    const l = lines(); l[0] = 'MAX7455'
    expect(() => decodeFont(l.join('\n'))).toThrow(McmParseError)
  })
  it('a truncated file', () => {
    expect(() => decodeFont(lines().slice(0, 900).join('\n'))).toThrow(McmParseError)
  })
  it('non-0x55 padding', () => {
    const l = lines(); l[64] = '00000000'   // last pad line of glyph 0
    expect(() => decodeFont(l.join('\n'))).toThrow(/padding/i)
  })
  it('a malformed line', () => {
    const l = lines(); l[5] = '0101'
    expect(() => decodeFont(l.join('\n'))).toThrow(McmParseError)
  })
  it('reports a 1-based line number', () => {
    const l = lines(); l[5] = '0101'
    try { decodeFont(l.join('\n')); throw new Error('should have thrown') }
    catch (e) { expect((e as McmParseError).line).toBe(6) }
  })
})
```

- [ ] **Step 2: Run, fix the decoder until green**

Run: `cd web && npx vitest run src/lib/mcm`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/mcm && git commit -m "Test that the .mcm decoder rejects corrupt fonts"
```

---

### Task 5: Stage OSD assets into the web build

**Files:**
- Create: `web/scripts/stage-osd-assets.mjs`
- Modify: `web/package.json` (add `prebuild` / `predev`)

**Interfaces:**
- Consumes: `../fonts/*.mcm`, `../previews/*.png`, `../variants.toml`
- Produces: `web/public/osd/fonts/*.mcm`, `web/public/osd/previews/*.png`, `web/public/osd/variants.json`

- [ ] **Step 1: Write the script**

Copy every `.mcm` from `../fonts` and every `.png` from `../previews`. Parse the `description` and `output` of each `[variants.*]` table out of `../variants.toml` with a small regex (no TOML dependency) and write `variants.json` as an array of `{ id, output, description, craftName }`. **Fail loudly** (exit 1) if `../fonts` is missing or empty — a silent 404 in production is the failure this prevents.

- [ ] **Step 2: Wire it in**

`web/package.json`: `"prebuild": "node scripts/stage-osd-assets.mjs"`, `"predev": "node scripts/stage-osd-assets.mjs"`.

- [ ] **Step 3: Run and verify**

Run: `cd web && npm run prebuild && ls public/osd/fonts | wc -l`
Expected: `6`.

- [ ] **Step 4: Commit**

```bash
git add web/scripts web/package.json && git commit -m "Stage OSD fonts and previews into the web build"
```

---

### Task 6: Army Jay shell — nav groups and namespaced routes

**Files:**
- Modify: `web/src/App.tsx`, `web/src/components/Nav.tsx`, `web/src/components/Footer.tsx`, `web/index.html`
- Create: `web/src/pages/Landing.tsx`

**Interfaces:**
- Consumes: existing EdgeSounds pages
- Produces: routes `/`, `/sounds/library`, `/sounds/convert`, `/sounds/my`, `/sounds/setup`, `/osd`, `/osd/fonts/:variant`

- [ ] **Step 1: Re-route**

`App.tsx`: move the four EdgeSounds routes under `/sounds/*`, add `/` -> `Landing`, add the two OSD routes. Keep `*` -> `Landing`.

- [ ] **Step 2: Nav groups**

`Nav.tsx`: brand becomes "ARMY JAY". Two labelled groups, Sounds and OSD Fonts, each with its links. Keep the My Sounds count badge.

- [ ] **Step 3: Landing page**

`Landing.tsx`: two cards, one per half, each linking into its section.

- [ ] **Step 4: Re-point sitemap and OG tags**

The routes moved, so `web/public/sitemap.xml` still lists `/library`, `/convert`
and `/setup`, which now 404. Rewrite it for `/`, `/sounds/library`,
`/sounds/convert`, `/sounds/setup`, `/osd`. Replace the hardcoded
`edgesounds.pages.dev` in `sitemap.xml`, `robots.txt` and `index.html` with a
single `SITE_URL` constant read from `import.meta.env.VITE_SITE_URL`, defaulting
to a placeholder, so the domain decision is one value rather than a search.

- [ ] **Step 5: Build and click through**

Run: `cd web && npm run build && npm run preview`
Expected: every route resolves; no console errors.

- [ ] **Step 5: Commit**

```bash
git add web/src web/index.html && git commit -m "Add the Army Jay shell with Sounds and OSD sections"
```

---

### Task 7: OSD landing and font browser

**Files:**
- Create: `web/src/pages/osd/OsdHome.tsx`, `web/src/pages/osd/FontDetail.tsx`
- Create: `web/src/components/osd/GlyphSheet.tsx`, `web/src/components/osd/GlyphCanvas.tsx`
- Create: `web/src/hooks/useFont.ts`

**Interfaces:**
- Consumes: `decodeFont`, `Font`, `Glyph`, `variants.json`
- Produces: `useFont(variantId): { state, font, error }`, `<GlyphSheet font>`, `<GlyphCanvas glyph scale>`

- [ ] **Step 1: `useFont` hook**

Fetch `/osd/fonts/<output>`, read as text, `decodeFont`. Surface parse errors as `{ state: 'error', message }` including the line number.

- [ ] **Step 2: `GlyphCanvas`**

Draw one glyph on a `<canvas>` at integer scale. Transparent pixels render as a checkerboard so they are distinguishable from black.

- [ ] **Step 3: `GlyphSheet`**

A 16x16 grid of `GlyphCanvas`, each labelled with its hex index.

- [ ] **Step 4: Pages**

`OsdHome`: what the fonts are, the install steps from the README (props off; some boards need a LiPo to power the OSD chip), and a card per variant from `variants.json`.
`FontDetail`: the variant description, the glyph sheet **rendered through the codec**, the prebuilt logo preview PNG, and a download button serving the original bytes.

- [ ] **Step 5: Verify in a browser**

Run: `cd web && npm run dev`
Expected: `/osd/fonts/armyjay_full` shows 256 glyphs and the logo preview.

- [ ] **Step 6: Commit**

```bash
git add web/src && git commit -m "Add the OSD font browser, rendering glyphs through the codec"
```

---

### Task 8: CI and deploy

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: everything above
- Produces: a green three-job CI

- [ ] **Step 1: Add the `web` job**

```yaml
  web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json
      - run: npm ci
        working-directory: web
      - run: npm run lint
        working-directory: web
      - run: npm run test
        working-directory: web
      - run: npm run build
        working-directory: web
```

- [ ] **Step 2: Confirm the Python jobs are untouched**

Run: `git diff .github/workflows/ci.yml`
Expected: only an addition; `validate` and `crosscheck` unchanged.

- [ ] **Step 3: Run everything locally**

Run: `cd web && npm run lint && npm run test && npm run build` and, at the root, `python -m unittest discover -s tests && python tools/validate.py fonts/*.mcm`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml && git commit -m "Add a web job to CI"
```
