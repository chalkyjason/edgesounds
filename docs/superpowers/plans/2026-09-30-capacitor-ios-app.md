# Army Jay for iPhone (Capacitor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the existing Army Jay site as a signed iPhone app that runs on a real phone, with every file export working through the iOS share sheet and the sound library trimmed to what the App Store allows.

**Architecture:** Capacitor 8 wraps the production web build in a native shell; the web code detects at runtime that it is inside the app and swaps only the export path, three lines of copy and one footer link. A build script derives `dist-ios/` from `dist/` with the library trimmed and web-host files removed, and Capacitor's `webDir` points only at that. The site's own behaviour does not change: every download stays the `<a download>` it is today.

**Tech Stack:** React 19 + TypeScript + Vite 8 (existing), Vitest 5 (existing), Capacitor 8.5 with `@capacitor/filesystem` and `@capacitor/share`, Swift Package Manager (no CocoaPods), Xcode 27, Python 3 + Pillow (existing, for the icon).

**Spec:** `docs/superpowers/specs/2026-09-30-capacitor-ios-app-design.md`

Every piece of code in this plan was run before it was written down: the tests pass, the site lints, type-checks and builds, `dist-ios/` comes out with exactly 27 sounds, the generated Xcode project builds for the simulator in about 30 s, and the result was launched in the simulator and screenshotted. Copy it exactly.

## Global Constraints

- Node 22: `web/.nvmrc` pins it and `@capacitor/cli` requires it. The shell's default `node` on this Mac is 20.18, so in `web/` run `nvm use` first (or prefix commands with `PATH="$HOME/.nvm/versions/node/v22.12.0/bin:$PATH"`). Shell state does not persist between tool calls.
- Web behaviour is unchanged: in a browser every download is still an `<a download>`; `npm run build` output differs only by the safe-area CSS, `viewport-fit=cover`, and the `@capacitor/core` platform check.
- Exact package versions: `@capacitor/core@8.5.2`, `@capacitor/ios@8.5.2`, `@capacitor/filesystem@8.1.3`, `@capacitor/share@8.0.2`, `@capacitor/cli@8.5.2`.
- The iOS build ships only sounds whose `license` is exactly `generated-original` (27 of 98 today), and none of `_headers`, `_redirects`, `sitemap.xml`, `robots.txt`, `og.png`.
- Files are exported under their **real filename** (EdgeTX triggers on exact names such as `armed.wav`), written in 768 KB chunks (a multiple of 3 bytes, so each chunk's base64 has no padding), to `Directory.Cache` under `exports/`.
- App settings: display name `Army Jay`; bundle ID `com.armyjay.app` (provisional until Task 7 — see the gate there); team `82S6ZVW7V2`; iPhone only; portrait only; iOS 15+; version `1.0.0` build `1`; `ITSAppUsesNonExemptEncryption` = `false`; `UIUserInterfaceStyle` = `Dark`.
- The repo lives in iCloud-synced `~/Documents`. Xcode's DerivedData must stay out of it (`ios:sim` builds to `$TMPDIR/armyjay-ios`). If a command hangs at 0 % CPU, files are evicted: `find . -type f -flags +dataless | wc -l`, then read them back (`... -print0 | xargs -0 -P 24 cat >/dev/null`).
- Commit messages follow the repo's style (an imperative sentence, no `feat:` prefixes) and end with the `Co-Authored-By` trailer shown in each commit step.
- Nothing in this plan registers anything with Apple until Task 7, which stops and asks first.

## Review Focus

The spec says what the app must do; these are the inputs it is silent on that would bite a person using it. Each has a test in the task that owns the code.

1. **Two saves started close together** (a double-tap, or tapping a second card while the first is still fetching): both files must be offered, one after the other, and neither may delete the other's file. → Task 3, `runs overlapping saves one after the other`.
2. **A filename that is a path** (`../x.wav`, `a/b.wav`, a leading dot): must be refused, never written outside `exports/`. → Task 3, `refuses the filename`.
3. **A zero-byte export**: a clear error, not an empty file in the share sheet. → Task 3, `refuses an empty file`.
4. **`library.json` naming a sound whose file is missing, or whose path escapes `sounds/`**: the iOS build must fail loudly rather than ship a broken or wrong entry. → Task 2, `fails when a kept sound has no file` and `fails when a sound path points outside sounds/`.
5. **A stale `dist-ios/` from an earlier build** still holding the full library: must be wiped, never merged. → Task 2, `wipes a previous dist-ios/`.

## File Structure

| File | Responsibility |
|---|---|
| `web/scripts/trim-library.mjs` | Pure allowlist filter over the parsed `library.json`. Plain JS so Node runs it without a TS loader. |
| `web/scripts/prepare-ios.mjs` | `dist/` → `dist-ios/`: trim the library, delete unreferenced sounds and web-only files, fail closed. CLI when run directly. |
| `web/scripts/__tests__/` | Vitest tests for both scripts (Vitest's default include pattern picks up `*.test.mjs`). |
| `web/src/platform/platform.ts` | `isNativeApp()` — the one runtime platform check. |
| `web/src/platform/saveFile.ts` | `saveFile(filename, source)` — browser download or share sheet. The only place the app writes a file. |
| `web/src/components/SaveLink.tsx` | The `<a download>` replacement: anchor on the web, button + share sheet in the app. |
| `web/capacitor.config.ts` | App ID, name, `webDir: 'dist-ios'`, background colour, content inset. |
| `web/ios/` | The generated Xcode project, committed; patched for iPhone-only portrait, privacy manifest, launch screen, icon. |
| `tools/make_ios_icon.py` | Draws the 1024 px icon from the favicon's mark, so the PNG is reproducible. |

---

### Task 1: Library trim

**Files:**
- Create: `web/scripts/trim-library.mjs`
- Test: `web/scripts/__tests__/trim-library.test.mjs`

**Interfaces:**
- Produces: `trimLibrary(library) -> library` (same shape, disallowed sounds and emptied categories removed; throws `Error('library.json has no categories array')` on bad input) and `ALLOWED_LICENSES: string[]`. Task 2 imports both.

- [ ] **Step 1: Write the failing test**

Create `web/scripts/__tests__/trim-library.test.mjs`:

```js
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALLOWED_LICENSES, trimLibrary } from '../trim-library.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REAL = JSON.parse(readFileSync(resolve(HERE, '../../public/library.json'), 'utf8'))

const sound = (id, license) => ({ id, path: `/sounds/x/${id}.wav`, ...(license ? { license } : {}) })

describe('trimLibrary on the real library.json', () => {
  const trimmed = trimLibrary(REAL)
  const kept = trimmed.categories.flatMap((c) => c.sounds)

  // The exact set that ships in the App Store build. If this number changes,
  // the library changed: check the new clips really are original, then update.
  it('keeps the 27 original sounds', () => {
    expect(kept).toHaveLength(27)
  })

  it('keeps nothing under any other licence', () => {
    for (const s of kept) expect(ALLOWED_LICENSES).toContain(s.license)
  })

  it('leaves no empty category', () => {
    for (const c of trimmed.categories) expect(c.sounds.length).toBeGreaterThan(0)
  })

  it('actually dropped something, so the filter is not a no-op', () => {
    const total = REAL.categories.flatMap((c) => c.sounds).length
    expect(total).toBeGreaterThan(kept.length)
  })
})

describe('trimLibrary fails closed', () => {
  const library = {
    categories: [
      {
        id: 'mixed',
        sounds: [
          sound('ok', 'generated-original'),
          sound('clip', 'fair-use-personal'),
          sound('unlabelled'),
          sound('shouty', 'Generated-Original'),
          sound('padded', ' generated-original '),
        ],
      },
      { id: 'all-clips', sounds: [sound('film', 'fair-use-personal')] },
      { id: 'no-sounds-key' },
    ],
  }

  it('keeps only an exact licence match', () => {
    const trimmed = trimLibrary(library)
    expect(trimmed.categories.map((c) => c.id)).toEqual(['mixed'])
    expect(trimmed.categories[0].sounds.map((s) => s.id)).toEqual(['ok'])
  })

  it('does not mutate its input', () => {
    const before = JSON.stringify(library)
    trimLibrary(library)
    expect(JSON.stringify(library)).toBe(before)
  })

  it('rejects a file that is not a library', () => {
    expect(() => trimLibrary({})).toThrow('no categories array')
    expect(() => trimLibrary(null)).toThrow('no categories array')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npx vitest run scripts`
Expected: FAIL — `Failed to resolve import "../trim-library.mjs"`.

- [ ] **Step 3: Write the filter**

Create `web/scripts/trim-library.mjs`:

```js
// Filters the sound library down to what the iPhone app may ship.
//
// An allowlist, and it fails closed: a sound is kept only if its licence is
// exactly one of ALLOWED_LICENSES. A missing or unrecognised licence is
// dropped, so a clip added to library.json without a licence can never reach
// the App Store build by accident.
//
// Plain JavaScript rather than TypeScript because its only caller is the
// build script, which Node runs directly.

export const ALLOWED_LICENSES = ['generated-original']

/**
 * @template {{ categories: Array<{ sounds: Array<{ license?: string }> }> }} T
 * @param {T} library the parsed library.json
 * @returns {T} a copy without disallowed sounds or the categories they emptied
 */
export function trimLibrary(library) {
  if (!library || !Array.isArray(library.categories)) {
    throw new Error('library.json has no categories array')
  }
  const categories = library.categories
    .map((category) => ({
      ...category,
      sounds: (category.sounds ?? []).filter((sound) => ALLOWED_LICENSES.includes(sound.license)),
    }))
    .filter((category) => category.sounds.length > 0)
  return { ...library, categories }
}
```

- [ ] **Step 4: Run the test again**

Run: `cd web && npx vitest run scripts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
cd web
git add scripts/trim-library.mjs scripts/__tests__/trim-library.test.mjs
git commit -m "$(cat <<'EOF'
Add the library trim for the iPhone build

An allowlist over library.json that fails closed: only sounds licensed
exactly generated-original survive. The App Store cannot take the 71
fair-use clips, and a clip added without a licence must not slip in.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `prepare-ios` build step

**Files:**
- Create: `web/scripts/prepare-ios.mjs`
- Test: `web/scripts/__tests__/prepare-ios.test.mjs`
- Modify: `.gitignore` (repo root)

**Interfaces:**
- Consumes: `trimLibrary` from Task 1.
- Produces: `prepareIos(distDir, outDir) -> { kept, removed }`; run as `node scripts/prepare-ios.mjs` it builds `web/dist-ios/` from `web/dist/`. Task 6 wires it into `npm run build:ios`.

- [ ] **Step 1: Write the failing tests**

Create `web/scripts/__tests__/prepare-ios.test.mjs`:

```js
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prepareIos } from '../prepare-ios.mjs'

let root
let dist
let out

const write = (rel, content = 'x') => {
  const file = join(dist, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

const entry = (id, path, license) => ({ id, path, ...(license ? { license } : {}) })

const writeLibrary = (categories) => write('library.json', JSON.stringify({ categories }))

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prepare-ios-'))
  dist = join(root, 'dist')
  out = join(root, 'dist-ios')
  write('index.html', '<!doctype html>')
  write('assets/app.js', 'console.log(1)')
  write('osd/fonts/armyjay_full.mcm', 'MAX7456')
  for (const name of ['_headers', '_redirects', 'sitemap.xml', 'robots.txt', 'og.png']) write(name)
  write('sounds/callouts/armed.wav', 'RIFF-armed')
  write('sounds/callouts/nolic.wav', 'RIFF-nolic')
  write('sounds/movies/quote.wav', 'RIFF-quote')
  write('sounds/.DS_Store', 'junk')
  writeLibrary([
    {
      id: 'callouts',
      sounds: [
        entry('armed', '/sounds/callouts/armed.wav', 'generated-original'),
        entry('nolic', '/sounds/callouts/nolic.wav'),
      ],
    },
    { id: 'movies', sounds: [entry('quote', '/sounds/movies/quote.wav', 'fair-use-personal')] },
  ])
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('prepareIos', () => {
  it('ships only the sounds the trimmed library lists', () => {
    expect(prepareIos(dist, out)).toEqual({ kept: 1, removed: 3 })
    expect(readdirSync(join(out, 'sounds'), { recursive: true }).sort()).toEqual([
      'callouts',
      join('callouts', 'armed.wav'),
    ])
    expect(readFileSync(join(out, 'sounds/callouts/armed.wav'), 'utf8')).toBe('RIFF-armed')
  })

  it('rewrites library.json to match', () => {
    prepareIos(dist, out)
    const library = JSON.parse(readFileSync(join(out, 'library.json'), 'utf8'))
    expect(library.categories.map((c) => c.id)).toEqual(['callouts'])
    expect(library.categories[0].sounds.map((s) => s.id)).toEqual(['armed'])
  })

  it('drops the files that only mean something to a web host', () => {
    prepareIos(dist, out)
    for (const name of ['_headers', '_redirects', 'sitemap.xml', 'robots.txt', 'og.png']) {
      expect(existsSync(join(out, name))).toBe(false)
    }
  })

  it('keeps the rest of the site', () => {
    prepareIos(dist, out)
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toBe('<!doctype html>')
    expect(existsSync(join(out, 'assets/app.js'))).toBe(true)
    expect(existsSync(join(out, 'osd/fonts/armyjay_full.mcm'))).toBe(true)
  })

  it('leaves dist/ untouched', () => {
    prepareIos(dist, out)
    expect(existsSync(join(dist, 'sounds/movies/quote.wav'))).toBe(true)
    expect(existsSync(join(dist, '_headers'))).toBe(true)
    expect(JSON.parse(readFileSync(join(dist, 'library.json'), 'utf8')).categories).toHaveLength(2)
  })

  it('wipes a previous dist-ios/ rather than merging into it', () => {
    mkdirSync(join(out, 'sounds/movies'), { recursive: true })
    writeFileSync(join(out, 'sounds/movies/old-clip.wav'), 'stale')
    writeFileSync(join(out, 'stale.txt'), 'stale')
    prepareIos(dist, out)
    expect(existsSync(join(out, 'sounds/movies'))).toBe(false)
    expect(existsSync(join(out, 'stale.txt'))).toBe(false)
  })

  it('fails when a kept sound has no file', () => {
    rmSync(join(dist, 'sounds/callouts/armed.wav'))
    expect(() => prepareIos(dist, out)).toThrow('armed: /sounds/callouts/armed.wav is missing from the build')
  })

  it('fails when a sound path points outside sounds/', () => {
    writeLibrary([
      { id: 'callouts', sounds: [entry('sneaky', '/sounds/../index.html', 'generated-original')] },
    ])
    expect(() => prepareIos(dist, out)).toThrow('sneaky: path /sounds/../index.html is outside sounds/')
  })

  it('fails with a pointer to the fix when the site has not been built', () => {
    rmSync(join(dist, 'index.html'))
    expect(() => prepareIos(dist, out)).toThrow('run "npm run build" first')
  })
})
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd web && npx vitest run scripts/__tests__/prepare-ios`
Expected: FAIL — `Failed to resolve import "../prepare-ios.mjs"`.

- [ ] **Step 3: Write the script**

Create `web/scripts/prepare-ios.mjs`:

```js
// Builds dist-ios/, the web bundle the iPhone app ships, from dist/.
//
// The app is the site minus two things: the sounds it may not distribute
// through the App Store (see trim-library.mjs) and the files that only mean
// something to a web host. Capacitor's webDir points at dist-ios/, never at
// dist/, so the untrimmed library cannot be synced into the app by mistake.

import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { trimLibrary } from './trim-library.mjs'

export const WEB_ONLY_FILES = ['_headers', '_redirects', 'sitemap.xml', 'robots.txt', 'og.png']

function filesUnder(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

function removeEmptyDirs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const child = join(dir, entry.name)
    removeEmptyDirs(child)
    if (readdirSync(child).length === 0) rmSync(child, { recursive: true })
  }
}

/**
 * @param {string} distDir the finished web build
 * @param {string} outDir where to write the app's bundle; wiped first
 * @returns {{ kept: number, removed: number }} sound files kept and deleted
 */
export function prepareIos(distDir, outDir) {
  if (!existsSync(join(distDir, 'index.html'))) {
    throw new Error(`${distDir} has no index.html -- run "npm run build" first`)
  }
  rmSync(outDir, { recursive: true, force: true })
  cpSync(distDir, outDir, { recursive: true })

  const libraryPath = join(outDir, 'library.json')
  const library = trimLibrary(JSON.parse(readFileSync(libraryPath, 'utf8')))
  writeFileSync(libraryPath, `${JSON.stringify(library, null, 2)}\n`)

  const soundsDir = resolve(outDir, 'sounds')
  const keep = new Set()
  for (const category of library.categories) {
    for (const sound of category.sounds) {
      const file = resolve(join(outDir, sound.path))
      if (!file.startsWith(soundsDir + sep)) {
        throw new Error(`${sound.id}: path ${sound.path} is outside sounds/`)
      }
      if (!existsSync(file)) {
        throw new Error(`${sound.id}: ${sound.path} is missing from the build`)
      }
      keep.add(file)
    }
  }

  let removed = 0
  for (const file of filesUnder(soundsDir)) {
    if (keep.has(file)) continue
    rmSync(file)
    removed += 1
  }
  if (existsSync(soundsDir)) removeEmptyDirs(soundsDir)
  for (const name of WEB_ONLY_FILES) rmSync(join(outDir, name), { force: true })

  // Belt and braces: whatever the code above did, nothing unlisted may ship.
  const stray = filesUnder(soundsDir).filter((file) => !keep.has(file))
  if (stray.length > 0) {
    throw new Error(`unreferenced files left under sounds/: ${stray.join(', ')}`)
  }
  return { kept: keep.size, removed }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const WEB = dirname(dirname(fileURLToPath(import.meta.url)))
  try {
    const { kept, removed } = prepareIos(join(WEB, 'dist'), join(WEB, 'dist-ios'))
    console.log(`[prepare-ios] dist-ios/ ready: ${kept} sounds kept, ${removed} files removed`)
  } catch (error) {
    console.error(`[prepare-ios] ${error.message}`)
    process.exit(1)
  }
}
```

- [ ] **Step 4: Run the tests again**

Run: `cd web && npx vitest run scripts`
Expected: PASS, 16 tests across both files.

- [ ] **Step 5: Run it for real against the current site build**

Run:
```bash
cd web && npm run build && node scripts/prepare-ios.mjs && find dist-ios/sounds -name '*.wav' | wc -l && ls dist-ios
```
Expected: `[prepare-ios] dist-ios/ ready: 27 sounds kept, 71 files removed`, then `27`, and a listing with no `_headers`, `_redirects`, `sitemap.xml`, `robots.txt` or `og.png`. (`npm run build` also rewrites the `lastmod` dates in `web/public/sitemap.xml`; revert that with `git checkout -- web/public/sitemap.xml` before committing.)

- [ ] **Step 6: Ignore the output directory**

In the repo-root `.gitignore`, after the line `web/dist/`, add:

```
web/dist-ios/
```

- [ ] **Step 7: Commit**

```bash
cd web
git add scripts/prepare-ios.mjs scripts/__tests__/prepare-ios.test.mjs ../.gitignore
git commit -m "$(cat <<'EOF'
Add prepare-ios: the trimmed web bundle the iPhone app ships

dist-ios/ is dist/ with the library trimmed, the unreferenced sound
files deleted and the web-host files removed. It fails if a kept sound
has no file or its path escapes sounds/, and wipes the previous output
rather than merging into it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: The export helper

**Files:**
- Create: `web/src/platform/platform.ts`
- Create: `web/src/platform/saveFile.ts`
- Test: `web/src/platform/__tests__/saveFile.test.ts`
- Modify: `web/package.json`, `web/package-lock.json` (dependencies)

**Interfaces:**
- Produces: `isNativeApp(): boolean`; `saveFile(filename: string, source: Blob | string): Promise<'saved' | 'cancelled'>`; `CHUNK_BYTES`. Tasks 4 and 5 use the first two.

- [ ] **Step 1: Install the Capacitor packages**

Run:
```bash
cd web && npm i @capacitor/core@8.5.2 @capacitor/ios@8.5.2 @capacitor/filesystem@8.1.3 @capacitor/share@8.0.2 && npm i -D @capacitor/cli@8.5.2
```
Expected: `package.json` gains the four dependencies and the dev dependency; `npm audit` noise is unrelated and pre-existing.

- [ ] **Step 2: Write the platform check**

Create `web/src/platform/platform.ts`:

```ts
import { Capacitor } from '@capacitor/core'

/** True inside the iPhone app's web view; false in every browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
```

- [ ] **Step 3: Write the failing tests**

Create `web/src/platform/__tests__/saveFile.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNativeApp } from '../platform'
import { CHUNK_BYTES, saveFile } from '../saveFile'

vi.mock('../platform', () => ({ isNativeApp: vi.fn() }))
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { rmdir: vi.fn(), writeFile: vi.fn(), appendFile: vi.fn() },
}))
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }))

const URI = 'file:///cache/exports/the-file'

/** Deterministic, non-repeating-at-chunk-size bytes, so a misplaced chunk shows. */
function pattern(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length))
  for (let i = 0; i < length; i += 1) bytes[i] = (i * 31 + (i >> 8)) & 0xff
  return bytes
}

/** What the native side would have on disk: each call's base64 decoded, in order. */
function bytesOnDisk(): Uint8Array {
  const calls = [
    ...vi.mocked(Filesystem.writeFile).mock.calls,
    ...vi.mocked(Filesystem.appendFile).mock.calls,
  ]
  const parts = calls.map(([options]) => Buffer.from(options.data as string, 'base64'))
  return new Uint8Array(Buffer.concat(parts))
}

/** Buffer.equals, because toEqual on megabytes of typed array takes seconds. */
function expectSameBytes(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.length).toBe(expected.length)
  expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true)
}

beforeEach(() => {
  vi.mocked(Filesystem.rmdir).mockResolvedValue(undefined)
  vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: URI })
  vi.mocked(Filesystem.appendFile).mockResolvedValue(undefined)
  vi.mocked(Share.share).mockResolvedValue({})
})

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

describe('saveFile in the app', () => {
  beforeEach(() => vi.mocked(isNativeApp).mockReturnValue(true))

  it('writes the exact bytes under the exact filename and shares that file', async () => {
    const bytes = pattern(1000)
    await expect(saveFile('armed.wav', new Blob([bytes]))).resolves.toBe('saved')

    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1)
    expect(Filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'exports/armed.wav', directory: 'CACHE', recursive: true }),
    )
    expect(Filesystem.appendFile).not.toHaveBeenCalled()
    expectSameBytes(bytesOnDisk(), bytes)
    expect(Share.share).toHaveBeenCalledWith({ url: URI })
  })

  it('splits a large file into chunks that reassemble exactly', async () => {
    const bytes = pattern(CHUNK_BYTES * 2 + 1)
    await saveFile('my-edgesounds.zip', new Blob([bytes]))

    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1)
    expect(Filesystem.appendFile).toHaveBeenCalledTimes(2)
    for (const [options] of vi.mocked(Filesystem.appendFile).mock.calls) {
      expect(options).toEqual(
        expect.objectContaining({ path: 'exports/my-edgesounds.zip', directory: 'CACHE' }),
      )
    }
    expectSameBytes(bytesOnDisk(), bytes)
  })

  it('does not append when the file is exactly one chunk', async () => {
    const bytes = pattern(CHUNK_BYTES)
    await saveFile('exact.zip', new Blob([bytes]))
    expect(Filesystem.appendFile).not.toHaveBeenCalled()
    expectSameBytes(bytesOnDisk(), bytes)
  })

  it('clears the previous export before writing', async () => {
    await saveFile('armed.wav', new Blob([pattern(10)]))
    expect(Filesystem.rmdir).toHaveBeenCalledWith({
      path: 'exports',
      directory: 'CACHE',
      recursive: true,
    })
    const cleared = vi.mocked(Filesystem.rmdir).mock.invocationCallOrder[0]
    const written = vi.mocked(Filesystem.writeFile).mock.invocationCallOrder[0]
    expect(cleared).toBeLessThan(written)
  })

  it('carries on when there is no previous export to clear', async () => {
    vi.mocked(Filesystem.rmdir).mockRejectedValue(new Error('Folder does not exist'))
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).resolves.toBe('saved')
  })

  it('fetches a URL source and saves what came back', async () => {
    const bytes = pattern(300)
    const fetchMock = vi.fn(async () => new Response(bytes))
    vi.stubGlobal('fetch', fetchMock)

    await saveFile('armyjay_full.mcm', '/osd/fonts/armyjay_full.mcm')

    expect(fetchMock).toHaveBeenCalledWith('/osd/fonts/armyjay_full.mcm')
    expectSameBytes(bytesOnDisk(), bytes)
  })

  it('names the file when a URL source cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    await expect(saveFile('armed.wav', '/sounds/callouts/armed.wav')).rejects.toThrow(
      'Could not load armed.wav',
    )

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Load failed'))))
    await expect(saveFile('armed.wav', '/sounds/callouts/armed.wav')).rejects.toThrow(
      'Could not load armed.wav',
    )
    expect(Filesystem.writeFile).not.toHaveBeenCalled()
  })

  it('reports a dismissed share sheet as cancelled, not as an error', async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'))
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).resolves.toBe('cancelled')
  })

  it('rejects when sharing fails for any other reason', async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error('Error sharing item'))
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).rejects.toThrow(
      'Error sharing item',
    )
  })

  it('rejects when the write fails', async () => {
    vi.mocked(Filesystem.writeFile).mockRejectedValue(new Error('No space left on device'))
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).rejects.toThrow(
      'No space left on device',
    )
    expect(Share.share).not.toHaveBeenCalled()
  })

  it('refuses an empty file rather than sharing zero bytes', async () => {
    await expect(saveFile('armed.wav', new Blob([]))).rejects.toThrow('armed.wav is empty')
    expect(Filesystem.writeFile).not.toHaveBeenCalled()
  })

  it.each(['../escape.wav', 'a/b.wav', 'a\\b.wav', '.hidden', ''])(
    'refuses the filename %j',
    async (name) => {
      await expect(saveFile(name, new Blob([pattern(10)]))).rejects.toThrow('Cannot save a file named')
      expect(Filesystem.rmdir).not.toHaveBeenCalled()
      expect(Filesystem.writeFile).not.toHaveBeenCalled()
    },
  )

  it('runs overlapping saves one after the other', async () => {
    let dismissFirstSheet!: () => void
    vi.mocked(Share.share).mockImplementationOnce(
      () => new Promise((resolve) => (dismissFirstSheet = () => resolve({}))),
    )

    const first = saveFile('first.wav', new Blob([pattern(10)]))
    const second = saveFile('second.wav', new Blob([pattern(10)]))

    await vi.waitFor(() => expect(Share.share).toHaveBeenCalledTimes(1))
    // The second save must not have cleared or written anything yet.
    expect(Filesystem.rmdir).toHaveBeenCalledTimes(1)
    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1)

    dismissFirstSheet()
    await expect(first).resolves.toBe('saved')
    await expect(second).resolves.toBe('saved')
    expect(vi.mocked(Filesystem.writeFile).mock.calls.map(([o]) => o.path)).toEqual([
      'exports/first.wav',
      'exports/second.wav',
    ])
  })

  it('still runs the next save after one has failed', async () => {
    vi.mocked(Share.share).mockRejectedValueOnce(new Error('Error sharing item'))
    await expect(saveFile('first.wav', new Blob([pattern(10)]))).rejects.toThrow()
    await expect(saveFile('second.wav', new Blob([pattern(10)]))).resolves.toBe('saved')
  })
})

describe('saveFile in a browser', () => {
  let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.mocked(isNativeApp).mockReturnValue(false)
    anchor = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) })
  })

  it('clicks a download link to a URL source, untouched', async () => {
    await expect(saveFile('armed.wav', '/sounds/callouts/armed.wav')).resolves.toBe('saved')
    expect(anchor.href).toBe('/sounds/callouts/armed.wav')
    expect(anchor.download).toBe('armed.wav')
    expect(anchor.click).toHaveBeenCalledTimes(1)
  })

  it('clicks a download link to an object URL for a Blob, then revokes it', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    await saveFile('my-edgesounds.zip', new Blob([pattern(10)]))
    expect(anchor.href).toMatch(/^blob:/)
    expect(anchor.download).toBe('my-edgesounds.zip')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith(anchor.href)
    revoke.mockRestore()
  })

  it('never touches the native plugins', async () => {
    await saveFile('armed.wav', new Blob([pattern(10)]))
    expect(Filesystem.writeFile).not.toHaveBeenCalled()
    expect(Share.share).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run them and watch them fail**

Run: `cd web && npx vitest run src/platform`
Expected: FAIL — `Failed to resolve import "../saveFile"`.

- [ ] **Step 5: Write `saveFile`**

Create `web/src/platform/saveFile.ts`:

```ts
import { isNativeApp } from './platform'

export type SaveOutcome = 'saved' | 'cancelled'

/**
 * Raw bytes per call across the native bridge. A multiple of 3, so every
 * chunk but the last encodes to base64 with no padding.
 */
export const CHUNK_BYTES = 768 * 1024

const EXPORT_DIR = 'exports'

// Saves run one at a time in the app. Each one clears EXPORT_DIR before it
// writes, so two overlapping saves would delete each other's file.
let queue: Promise<unknown> = Promise.resolve()

/**
 * Hand the user a file: a browser download on the web, the share sheet in the
 * iPhone app.
 *
 * `source` is the file's bytes, or a URL to fetch them from -- a static path
 * or a `blob:` URL. Resolves 'cancelled' only in the app, when the share
 * sheet is dismissed.
 */
export async function saveFile(filename: string, source: Blob | string): Promise<SaveOutcome> {
  if (!isNativeApp()) {
    downloadInBrowser(filename, source)
    return 'saved'
  }
  const run = queue.then(() => shareOnDevice(filename, source))
  queue = run.catch(() => undefined)
  return run
}

function downloadInBrowser(filename: string, source: Blob | string): void {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  if (typeof source !== 'string') URL.revokeObjectURL(url)
}

async function shareOnDevice(filename: string, source: Blob | string): Promise<SaveOutcome> {
  // The name is used as a path segment, and the share sheet shows it as-is.
  if (!/^[^./\\][^/\\]*$/.test(filename)) throw new Error(`Cannot save a file named "${filename}"`)

  const bytes = await readBytes(filename, source)
  if (bytes.length === 0) throw new Error(`${filename} is empty`)

  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const directory = Directory.Cache
  const path = `${EXPORT_DIR}/${filename}`

  // Clear the previous export now rather than this one after sharing: the
  // app receiving the file may still be reading it when the sheet closes.
  await Filesystem.rmdir({ path: EXPORT_DIR, directory, recursive: true }).catch(() => undefined)

  // Written under its real name, because "Save to Files" keeps the on-disk
  // name and EdgeTX triggers on exact filenames.
  const { uri } = await Filesystem.writeFile({
    path,
    directory,
    recursive: true,
    data: toBase64(bytes.subarray(0, CHUNK_BYTES)),
  })
  for (let offset = CHUNK_BYTES; offset < bytes.length; offset += CHUNK_BYTES) {
    await Filesystem.appendFile({
      path,
      directory,
      data: toBase64(bytes.subarray(offset, offset + CHUNK_BYTES)),
    })
  }

  try {
    await Share.share({ url: uri })
    return 'saved'
  } catch (error) {
    if (isShareCancel(error)) return 'cancelled'
    throw error
  }
}

async function readBytes(filename: string, source: Blob | string): Promise<Uint8Array> {
  if (typeof source !== 'string') return new Uint8Array(await source.arrayBuffer())
  let response: Response
  try {
    response = await fetch(source)
  } catch {
    throw new Error(`Could not load ${filename}`)
  }
  if (!response.ok) throw new Error(`Could not load ${filename}`)
  return new Uint8Array(await response.arrayBuffer())
}

/** The Share plugin rejects with exactly this message when the sheet is dismissed. */
function isShareCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /share cancell?ed/i.test(message)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  // Spread in slices: one call with every byte overflows the argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
```

- [ ] **Step 6: Run the tests again**

Run: `cd web && npx vitest run src/platform`
Expected: PASS, 21 tests, in well under a second (the byte comparisons use `Buffer.equals`; `toEqual` on a megabyte of typed array takes seconds).

- [ ] **Step 7: Prove the overlap test has teeth**

Temporarily change `const run = queue.then(() => shareOnDevice(filename, source))` to `const run = shareOnDevice(filename, source)`, run the tests, and confirm exactly one fails: `runs overlapping saves one after the other`. Put the line back.

- [ ] **Step 8: Lint and type-check**

Run: `cd web && npm run lint && npx tsc -b`
Expected: both clean.

- [ ] **Step 9: Commit**

```bash
cd web
git add package.json package-lock.json src/platform
git commit -m "$(cat <<'EOF'
Add saveFile: one export path for the browser and the iPhone app

A web view ignores <a download>, so inside the app the file is written
to the cache under its real name and offered through the share sheet.
Saves are serialised, the previous export is cleared before each
write, and the bytes cross the bridge in 768 KB chunks.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `SaveLink` and the eight export sites

**Files:**
- Create: `web/src/components/SaveLink.tsx`
- Test: `web/src/components/__tests__/SaveLink.test.tsx`
- Modify: `web/src/components/SoundCard.tsx`, `web/src/components/Converter.tsx`, `web/src/pages/MySounds.tsx`, `web/src/pages/Library.tsx`, `web/src/pages/osd/FontDetail.tsx`, `web/src/pages/osd/FontEditor.tsx`

**Interfaces:**
- Consumes: `isNativeApp`, `saveFile` from Task 3; `useToast` / `ToastProvider` from `web/src/hooks/useToast.tsx`.
- Produces: `<SaveLink href filename className? onClick? children>`.

- [ ] **Step 1: Write the failing test**

Create `web/src/components/__tests__/SaveLink.test.tsx`. It renders with `react-dom/server`, so no DOM library is needed — the existing test setup (Node environment, Vite's React plugin for JSX) is enough:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../hooks/useToast'
import { isNativeApp } from '../../platform/platform'
import { SaveLink } from '../SaveLink'

vi.mock('../../platform/platform', () => ({ isNativeApp: vi.fn() }))

const render = () =>
  renderToStaticMarkup(
    <ToastProvider>
      <SaveLink href="/sounds/callouts/armed.wav" filename="armed.wav" className="btn">
        WAV
      </SaveLink>
    </ToastProvider>,
  )

describe('SaveLink', () => {
  beforeEach(() => vi.mocked(isNativeApp).mockReset())

  it('is the plain download anchor in a browser', () => {
    vi.mocked(isNativeApp).mockReturnValue(false)
    expect(render()).toBe(
      '<a href="/sounds/callouts/armed.wav" download="armed.wav" class="btn">WAV</a>',
    )
  })

  it('is a button with no href in the app', () => {
    vi.mocked(isNativeApp).mockReturnValue(true)
    expect(render()).toBe('<button type="button" class="btn">WAV</button>')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd web && npx vitest run src/components`
Expected: FAIL — `Failed to resolve import "../SaveLink"`.

- [ ] **Step 3: Write the component**

Create `web/src/components/SaveLink.tsx`:

```tsx
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useToast } from '../hooks/useToast'
import { isNativeApp } from '../platform/platform'
import { saveFile } from '../platform/saveFile'

interface SaveLinkProps {
  /** Where the file's bytes are: a static path or a `blob:` URL. */
  href: string
  filename: string
  className?: string
  children: ReactNode
  /** Browser only -- runs as the download starts, as on a plain anchor. */
  onClick?: () => void
}

/**
 * A download link. In a browser it is exactly the `<a download>` it replaces.
 * A web view ignores that attribute, so in the iPhone app it is a button that
 * opens the share sheet instead, and reports the outcome itself.
 */
export function SaveLink({ href, filename, className, children, onClick }: SaveLinkProps) {
  const { notify } = useToast()
  const [saving, setSaving] = useState(false)

  if (!isNativeApp()) {
    return (
      <a href={href} download={filename} onClick={onClick} className={className}>
        {children}
      </a>
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      const outcome = await saveFile(filename, href)
      if (outcome === 'saved') notify(`Saved ${filename}`, 'success')
    } catch (error) {
      notify(error instanceof Error ? error.message : `Could not save ${filename}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={saving}
      className={[className, saving && 'opacity-60'].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 4: Run the test again**

Run: `cd web && npx vitest run src/components`
Expected: PASS, 2 tests. The first asserts the browser markup byte for byte — that is the "web unchanged" guarantee.

- [ ] **Step 5: Swap the six anchors and the two ZIP downloads**

Apply these diffs exactly (the `onClick` on `SoundCard` and `FontEditor` is browser-only by design — in the app `SaveLink` reports the outcome itself):

```diff
--- a/web/src/components/SoundCard.tsx
+++ b/web/src/components/SoundCard.tsx
@@ -1,6 +1,7 @@
 import { Download } from 'lucide-react'
 import type { SoundEntry } from '../types'
 import { AudioPreview } from './AudioPreview'
+import { SaveLink } from './SaveLink'
 import { useToast } from '../hooks/useToast'
 import { track } from '../utils/analytics'
 
@@ -65,15 +66,15 @@
 
       <div className="flex items-center justify-between text-xs text-zinc-400">
         {sound.credit && <span className="truncate">{sound.credit}</span>}
-        <a
+        <SaveLink
           href={sound.path}
-          download={sound.filename}
+          filename={sound.filename}
           onClick={handleDownload}
           className="ml-auto flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-zinc-300 hover:border-accent/50 hover:text-accent"
         >
           <Download className="h-3.5 w-3.5" />
           <span>WAV</span>
-        </a>
+        </SaveLink>
       </div>
     </div>
   )
```

```diff
--- a/web/src/components/Converter.tsx
+++ b/web/src/components/Converter.tsx
@@ -11,6 +11,7 @@
 } from '../utils/validateAudio'
 import { sanitizeFilename } from '../utils/sanitizeFilename'
 import { DropZone } from './DropZone'
+import { SaveLink } from './SaveLink'
 import { FilenameInput } from './FilenameInput'
 import { ConversionProgress } from './ConversionProgress'
 import { TrimSlider } from './TrimSlider'
@@ -259,13 +260,13 @@
             <RefreshCw className="h-4 w-4" /> Another
           </button>
           {downloadUrl && (
-            <a
+            <SaveLink
               href={downloadUrl}
-              download={status.result.filename}
+              filename={status.result.filename}
               className="flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim"
             >
               <Download className="h-4 w-4" /> Download .wav
-            </a>
+            </SaveLink>
           )}
         </div>
       </div>
```

```diff
--- a/web/src/pages/MySounds.tsx
+++ b/web/src/pages/MySounds.tsx
@@ -6,6 +6,8 @@
 import { useToast } from '../hooks/useToast'
 import { formatBytes, formatDuration } from '../utils/validateAudio'
 import { MAX_ENTRIES } from '../utils/mySoundsStorage'
+import { SaveLink } from '../components/SaveLink'
+import { saveFile } from '../platform/saveFile'
 
 export function MySounds() {
   const { sounds, loading, remove, clearAll } = useMySounds()
@@ -79,13 +81,10 @@
       // Build SD-card layout: bare files in /SOUNDS/<lang>/ — flat zip is fine
       for (const s of sounds) zip.file(s.filename, s.blob)
       const blob = await zip.generateAsync({ type: 'blob' })
-      const url = URL.createObjectURL(blob)
-      const a = document.createElement('a')
-      a.href = url
-      a.download = 'my-edgesounds.zip'
-      a.click()
-      URL.revokeObjectURL(url)
-      notify(`Bundled ${sounds.length} sounds into my-edgesounds.zip`, 'success')
+      const outcome = await saveFile('my-edgesounds.zip', blob)
+      if (outcome === 'saved') {
+        notify(`Bundled ${sounds.length} sounds into my-edgesounds.zip`, 'success')
+      }
     } catch (e) {
       notify(e instanceof Error ? e.message : 'Zip failed', 'error')
     } finally {
@@ -170,14 +169,14 @@
                 </div>
               </div>
               {url && (
-                <a
+                <SaveLink
                   href={url}
-                  download={s.filename}
+                  filename={s.filename}
                   className="flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-accent/50 hover:text-accent"
                 >
                   <Download className="h-3.5 w-3.5" />
                   WAV
-                </a>
+                </SaveLink>
               )}
               <button
                 onClick={() => handleRemove(s.id, s.displayName)}
```

```diff
--- a/web/src/pages/Library.tsx
+++ b/web/src/pages/Library.tsx
@@ -6,6 +6,7 @@
 import { useToast } from '../hooks/useToast'
 import { track } from '../utils/analytics'
 import type { SoundEntry } from '../types'
+import { saveFile } from '../platform/saveFile'
 
 export function Library() {
   const lib = useLibrary()
@@ -55,13 +56,8 @@
         })
       )
       const blob = await zip.generateAsync({ type: 'blob' })
-      const url = URL.createObjectURL(blob)
-      const a = document.createElement('a')
-      a.href = url
-      a.download = zipName
-      a.click()
-      URL.revokeObjectURL(url)
-      notify(`${sounds.length} sounds bundled into ${zipName}`, 'success')
+      const outcome = await saveFile(zipName, blob)
+      if (outcome === 'saved') notify(`${sounds.length} sounds bundled into ${zipName}`, 'success')
     } catch (e) {
       notify(e instanceof Error ? e.message : 'Zip failed', 'error')
     } finally {
```

```diff
--- a/web/src/pages/osd/FontDetail.tsx
+++ b/web/src/pages/osd/FontDetail.tsx
@@ -1,6 +1,7 @@
 import { Link, useParams } from 'react-router-dom'
 import { ArrowLeft, Download, Pencil } from 'lucide-react'
 import { GlyphSheet } from '../../components/osd/GlyphSheet'
+import { SaveLink } from '../../components/SaveLink'
 import { useFont } from '../../hooks/useFont'
 import { useVariants } from '../../hooks/useVariants'
 
@@ -41,14 +42,14 @@
       </div>
 
       <div className="flex flex-wrap gap-2">
-        <a
+        <SaveLink
           href={`/osd/fonts/${variant.output}`}
-          download={variant.output}
+          filename={variant.output}
           className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim"
         >
           <Download className="h-4 w-4" />
           {variant.output}
-        </a>
+        </SaveLink>
         <Link
           to={`/osd/fonts/${variant.id}/edit`}
           className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-accent/50 hover:text-accent"
@@ -57,14 +58,14 @@
           Edit glyphs
         </Link>
         {variant.craftName && (
-          <a
+          <SaveLink
             href={`/osd/fonts/${variant.craftName}`}
-            download={variant.craftName}
+            filename={variant.craftName}
             className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-accent/50 hover:text-accent"
           >
             <Download className="h-4 w-4" />
             craft-name build
-          </a>
+          </SaveLink>
         )}
       </div>
```

The `FontEditor` diff also hides the keyboard hint in the app (that belongs to Task 5's "app-only copy", but it lives in the same file, so it goes in here):

```diff
--- a/web/src/pages/osd/FontEditor.tsx
+++ b/web/src/pages/osd/FontEditor.tsx
@@ -4,6 +4,8 @@
 import { GlyphCanvas } from '../../components/osd/GlyphCanvas'
 import { GlyphEditorCanvas } from '../../components/osd/GlyphEditorCanvas'
 import { LogoUpload } from '../../components/osd/LogoUpload'
+import { SaveLink } from '../../components/SaveLink'
+import { isNativeApp } from '../../platform/platform'
 import { GLYPH_COUNT } from '../../lib/mcm/decode'
 import { encodeFont } from '../../lib/mcm/encode'
 import type { Pixel } from '../../lib/mcm/types'
@@ -199,9 +201,15 @@
           </div>
 
           <p className="text-[11px] leading-relaxed text-zinc-600">
-            Drag to paint. <kbd className="font-mono">1</kbd>/<kbd className="font-mono">2</kbd>/
-            <kbd className="font-mono">3</kbd> pick a colour,{' '}
-            <kbd className="font-mono">⌘Z</kbd> undoes.
+            Drag to paint.
+            {!isNativeApp() && (
+              <>
+                {' '}
+                <kbd className="font-mono">1</kbd>/<kbd className="font-mono">2</kbd>/
+                <kbd className="font-mono">3</kbd> pick a colour,{' '}
+                <kbd className="font-mono">⌘Z</kbd> undoes.
+              </>
+            )}
           </p>
 
           <LogoUpload
@@ -215,15 +223,15 @@
 
           {download && (
             <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
-              <a
+              <SaveLink
                 href={download.url}
-                download={download.name}
+                filename={download.name}
                 onClick={() => notify(`Downloading ${download.name}`, 'info')}
                 className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim"
               >
                 <Download className="h-4 w-4" />
                 Download edited font
-              </a>
+              </SaveLink>
               <p className="text-center font-mono text-[10px] text-zinc-500">
                 {download.bytes.toLocaleString()} bytes
                 {download.bytes === 147463 ? ' · valid' : ' · UNEXPECTED SIZE'}
```

- [ ] **Step 6: Confirm nothing else hands out a file**

Run: `cd web && grep -rnE "download=|createElement\('a'\)" src --include='*.tsx' --include='*.ts' | grep -v __tests__ | grep -v SaveLink.tsx`
Expected: no output. Every download now goes through `SaveLink` or `saveFile`.

- [ ] **Step 7: Lint, type-check, test, build**

Run: `cd web && npm run lint && npx tsc -b && npm test && npm run build && git checkout -- public/sitemap.xml`
Expected: all clean; the full suite passes (existing 46 + Task 1's 7 + Task 2's 9 + Task 3's 21 + these 2 = 85).

- [ ] **Step 8: Commit**

```bash
cd web
git add src/components/SaveLink.tsx src/components/__tests__/SaveLink.test.tsx src/components/SoundCard.tsx src/components/Converter.tsx src/pages/MySounds.tsx src/pages/Library.tsx src/pages/osd/FontDetail.tsx src/pages/osd/FontEditor.tsx
git commit -m "$(cat <<'EOF'
Route every download through SaveLink

In a browser SaveLink renders the same <a download> as before, byte for
byte. In the iPhone app it is a button that opens the share sheet. The
two ZIP downloads call saveFile directly, which also removes their two
copies of the object-URL dance.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Safe areas and app-only copy

**Files:**
- Modify: `web/index.html`, `web/src/index.css`, `web/src/components/Nav.tsx`, `web/src/components/Layout.tsx`, `web/src/components/Toaster.tsx`, `web/src/components/Footer.tsx`, `web/src/components/DropZone.tsx`
- Test: `web/src/components/__tests__/appOnly.test.tsx`

**Interfaces:**
- Consumes: `isNativeApp` from Task 3.

- [ ] **Step 1: Write the failing tests**

Create `web/src/components/__tests__/appOnly.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isNativeApp } from '../../platform/platform'
import { DropZone } from '../DropZone'
import { Footer } from '../Footer'

vi.mock('../../platform/platform', () => ({ isNativeApp: vi.fn() }))

beforeEach(() => vi.mocked(isNativeApp).mockReset())

describe('Footer', () => {
  it('links to Buy Me a Coffee and the source in a browser', () => {
    vi.mocked(isNativeApp).mockReturnValue(false)
    const html = renderToStaticMarkup(<Footer />)
    expect(html).toContain('buymeacoffee.com')
    expect(html).toContain('github.com/chalkyjason/edgesounds')
  })

  it('drops the donation link in the app but keeps the source link', () => {
    vi.mocked(isNativeApp).mockReturnValue(true)
    const html = renderToStaticMarkup(<Footer />)
    expect(html).not.toContain('buymeacoffee.com')
    expect(html).not.toContain('Buy me a coffee')
    expect(html).toContain('github.com/chalkyjason/edgesounds')
  })
})

describe('DropZone', () => {
  const render = () => renderToStaticMarkup(<DropZone onFile={() => {}} />)

  it('talks about dropping and clicking in a browser', () => {
    vi.mocked(isNativeApp).mockReturnValue(false)
    expect(render()).toContain('Drop an audio file or click to browse')
  })

  it('talks about choosing a file in the app', () => {
    vi.mocked(isNativeApp).mockReturnValue(true)
    const html = render()
    expect(html).toContain('Choose an audio file')
    expect(html).not.toContain('Drop an audio file')
  })
})
```

- [ ] **Step 2: Run them and watch two fail**

Run: `cd web && npx vitest run src/components/__tests__/appOnly`
Expected: 2 of 4 FAIL — `drops the donation link in the app` and `talks about choosing a file in the app`.

- [ ] **Step 3: Apply the copy changes**

```diff
--- a/web/src/components/Footer.tsx
+++ b/web/src/components/Footer.tsx
@@ -1,4 +1,5 @@
 import { Coffee, Code2 } from 'lucide-react'
+import { isNativeApp } from '../platform/platform'
 
 // Update this once your Buy Me A Coffee handle is set up.
 // Path is `https://buymeacoffee.com/<handle>`.
@@ -7,20 +8,23 @@
 
 export function Footer() {
   return (
-    <footer className="border-t border-zinc-800/80 bg-zinc-950">
+    <footer className="safe-bottom border-t border-zinc-800/80 bg-zinc-950">
       <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
         <p>Made by a pilot who's crashed too many times.</p>
         <div className="flex flex-wrap items-center gap-3">
+          {/* App Store review treats an external donation link as a payment route. */}
+          {!isNativeApp() && (
+            <a
+              href={BMAC_URL}
+              target="_blank"
+              rel="noopener noreferrer"
+              className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs hover:border-accent/60 hover:text-accent"
+            >
+              <Coffee className="h-3.5 w-3.5" />
+              <span>Buy me a coffee</span>
+            </a>
+          )}
           <a
-            href={BMAC_URL}
-            target="_blank"
-            rel="noopener noreferrer"
-            className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs hover:border-accent/60 hover:text-accent"
-          >
-            <Coffee className="h-3.5 w-3.5" />
-            <span>Buy me a coffee</span>
-          </a>
-          <a
             href={REPO_URL}
             target="_blank"
             rel="noopener noreferrer"
```

```diff
--- a/web/src/components/DropZone.tsx
+++ b/web/src/components/DropZone.tsx
@@ -1,6 +1,7 @@
 import { Upload } from 'lucide-react'
 import { useCallback, useRef, useState } from 'react'
 import { ACCEPTED_EXTENSIONS, isAcceptedAudioFile } from '../utils/validateAudio'
+import { isNativeApp } from '../platform/platform'
 
 export function DropZone({
   onFile,
@@ -53,7 +54,9 @@
       >
         <Upload className="h-8 w-8" />
         <div>
-          <div className="text-sm font-medium">Drop an audio file or click to browse</div>
+          <div className="text-sm font-medium">
+            {isNativeApp() ? 'Choose an audio file' : 'Drop an audio file or click to browse'}
+          </div>
           <div className="mt-1 text-xs text-zinc-500">
             {ACCEPTED_EXTENSIONS.join(' · ')}
           </div>
```

- [ ] **Step 4: Run the tests again**

Run: `cd web && npx vitest run src/components/__tests__/appOnly`
Expected: PASS, 4 tests.

- [ ] **Step 5: Apply the safe-area changes**

The insets are plain CSS rather than Tailwind arbitrary values, so `env()` inside `calc()` is never rewritten by Tailwind. `env(safe-area-inset-*)` is `0` in a desktop browser, so the site is visually unchanged.

```diff
--- a/web/index.html
+++ b/web/index.html
@@ -3,7 +3,7 @@
   <head>
     <meta charset="UTF-8" />
     <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
-    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
+    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
     <meta name="theme-color" content="#09090b" />
 
     <title>Army Jay — FPV sounds and OSD fonts, built in your browser</title>
```

```diff
--- a/web/src/index.css
+++ b/web/src/index.css
@@ -17,6 +17,26 @@
   margin: 0;
 }
 
+/*
+ * Safe areas. The insets are zero in a desktop browser and real inside the
+ * iPhone app, where the page runs edge to edge (viewport-fit=cover) under the
+ * status bar and the home indicator.
+ */
+.safe-top {
+  padding-top: env(safe-area-inset-top);
+}
+.safe-bottom {
+  padding-bottom: env(safe-area-inset-bottom);
+}
+.safe-x {
+  padding-left: env(safe-area-inset-left);
+  padding-right: env(safe-area-inset-right);
+}
+.toaster-offset {
+  right: calc(1rem + env(safe-area-inset-right));
+  bottom: calc(1rem + env(safe-area-inset-bottom));
+}
+
 ::selection {
   background-color: rgba(0, 255, 157, 0.35);
   color: #fff;
```

```diff
--- a/web/src/components/Nav.tsx
+++ b/web/src/components/Nav.tsx
@@ -40,7 +40,7 @@
   const subItems = inSounds ? SOUNDS_ITEMS : inOsd ? osdItems : []
 
   return (
-    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
+    <header className="safe-top sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
       <div className="mx-auto flex max-w-6xl items-stretch gap-1 px-4 sm:gap-2">
         <NavLink
           to="/"
```

```diff
--- a/web/src/components/Layout.tsx
+++ b/web/src/components/Layout.tsx
@@ -5,7 +5,7 @@
 
 export function Layout({ children }: { children: ReactNode }) {
   return (
-    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-200">
+    <div className="safe-x flex min-h-screen flex-col bg-zinc-950 text-zinc-200">
       <Nav />
       <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
       <Footer />
```

```diff
--- a/web/src/components/Toaster.tsx
+++ b/web/src/components/Toaster.tsx
@@ -16,7 +16,7 @@
 export function Toaster() {
   const { toasts, dismiss } = useToast()
   return (
-    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
+    <div className="toaster-offset pointer-events-none fixed z-50 flex flex-col gap-2">
       {toasts.map((t) => {
         const Icon = ICONS[t.kind]
         return (
```

- [ ] **Step 6: Confirm the CSS survived the build**

Run: `cd web && npm run build && grep -c "safe-area-inset-top" dist/assets/*.css && grep -o "viewport-fit=cover" dist/index.html && git checkout -- public/sitemap.xml`
Expected: `1` and `viewport-fit=cover`.

- [ ] **Step 7: Lint, type-check, test**

Run: `cd web && npm run lint && npx tsc -b && npm test`
Expected: clean; 89 tests.

- [ ] **Step 8: Commit**

```bash
cd web
git add index.html src/index.css src/components/Nav.tsx src/components/Layout.tsx src/components/Toaster.tsx src/components/Footer.tsx src/components/DropZone.tsx src/components/__tests__/appOnly.test.tsx
git commit -m "$(cat <<'EOF'
Respect the iPhone's safe areas; trim app-only copy

The page now runs edge to edge in the app (viewport-fit=cover), so the
nav, footer and toasts pad by the safe-area insets -- zero in a
desktop browser. The app hides the donation link, which App Store
review treats as a payment route, and stops telling people to drop a
file on a phone.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: The native project

**Files:**
- Create: `web/capacitor.config.ts`, `web/ios/**` (generated, then patched), `web/ios/App/App/PrivacyInfo.xcprivacy`, `tools/make_ios_icon.py`
- Modify: `web/package.json` (scripts), `web/tsconfig.node.json`, `web/README.md`
- Delete: `web/ios/App/App/Assets.xcassets/Splash.imageset/` (generated, unused)

**Interfaces:**
- Consumes: `dist-ios/` from Task 2.
- Produces: `npm run build:ios`, `npm run ios:sim`, `npm run ios:open`; the Xcode project Task 7 signs.

- [ ] **Step 1: Capacitor config and scripts**

Create `web/capacitor.config.ts`:

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.armyjay.app',
  appName: 'Army Jay',
  // Never dist/: dist-ios/ is the build with the library trimmed for the App Store.
  webDir: 'dist-ios',
  backgroundColor: '#09090b',
  ios: {
    // The page handles its own safe areas (see index.css).
    contentInset: 'never',
  },
}

export default config
```

Add it to the Node-side type-check:

```diff
--- a/web/tsconfig.node.json
+++ b/web/tsconfig.node.json
@@ -20,5 +20,5 @@
     "erasableSyntaxOnly": true,
     "noFallthroughCasesInSwitch": true
   },
-  "include": ["vite.config.ts"]
+  "include": ["vite.config.ts", "capacitor.config.ts"]
 }
```

In `web/package.json`, after the `"stage-osd"` script, add three scripts (keep the existing `prebuild`/`predev` lines):

```json
    "build:ios": "npm run build && node scripts/prepare-ios.mjs && cap sync ios",
    "ios:sim": "xcodebuild -quiet -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath \"${TMPDIR:-/tmp}/armyjay-ios\" CODE_SIGNING_ALLOWED=NO build",
    "ios:open": "cap open ios",
```

Run: `cd web && npm run lint && npx tsc -b`
Expected: clean (`capacitor.config.ts` is now linted and type-checked).

- [ ] **Step 2: Build the bundle, then generate the Xcode project**

`cap add ios` copies `webDir` into the project, so the bundle must exist first:

```bash
cd web && npm run build && node scripts/prepare-ios.mjs && git checkout -- public/sitemap.xml && npx cap add ios
```
Expected: `[success] ios platform added!`. Confirm the template is the one this plan was validated against:

```bash
cd web && grep -c 'PRODUCT_BUNDLE_IDENTIFIER = com.armyjay.app;' ios/App/App.xcodeproj/project.pbxproj && grep -c 'TARGETED_DEVICE_FAMILY = "1,2";' ios/App/App.xcodeproj/project.pbxproj && grep -A1 CFBundleDisplayName ios/App/App/Info.plist | tail -1
```
Expected: `2`, `2`, `<string>Army Jay</string>`. Capacitor's own `ios/.gitignore` already excludes `App/App/public`, `App/build`, `DerivedData` and the generated `capacitor.config.json`.

- [ ] **Step 3: The privacy manifest**

The Filesystem plugin's README requires the app to declare the file-timestamp API (`NSPrivacyAccessedAPICategoryFileTimestamp`, reason `C617.1`). Create `web/ios/App/App/PrivacyInfo.xcprivacy`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSPrivacyTracking</key>
	<false/>
	<key>NSPrivacyCollectedDataTypes</key>
	<array/>
	<key>NSPrivacyAccessedAPITypes</key>
	<array>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>C617.1</string>
			</array>
		</dict>
	</array>
</dict>
</plist>
```

- [ ] **Step 4: The launch screen**

Replace the whole of `web/ios/App/App/Base.lproj/LaunchScreen.storyboard` with a solid `#09090b` view (the template shows a placeholder splash image):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="17132" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <device id="retina4_7" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="17105"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <!--View Controller-->
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="snD-IY-ifK">
                        <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <color key="backgroundColor" red="0.035294117647" green="0.035294117647" blue="0.043137254902" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
            <point key="canvasLocation" x="53" y="375"/>
        </scene>
    </scenes>
</document>
```

Then delete the now-unreferenced splash images:

```bash
cd web && rm -r ios/App/App/Assets.xcassets/Splash.imageset
```

- [ ] **Step 5: Patch the project file and Info.plist**

This is a one-off against the freshly generated project; it is not committed. It adds the privacy manifest to the target's resources, restricts the app to iPhone, sets the version to `1.0.0`, and edits `Info.plist` with PlistBuddy: portrait only, no iPad orientations, `ITSAppUsesNonExemptEncryption` false, and `UIUserInterfaceStyle` Dark (which gives light status-bar text; Capacitor's `SystemBars.style` config is Android-only). Save it as `/tmp/patch_ios_project.py`:

```python
"""One-off: apply Army Jay's settings to a freshly generated Capacitor iOS project."""
import re
import subprocess
import sys
from pathlib import Path

app = Path(sys.argv[1])  # .../ios/App
pbx = app / "App.xcodeproj" / "project.pbxproj"
plist = app / "App" / "Info.plist"

BUILD_FILE = "A17A0001F0F0F0F0F0F0F001"
FILE_REF = "A17A0002F0F0F0F0F0F0F002"


def insert_after(text: str, anchor: str, line: str) -> str:
    if anchor not in text:
        raise SystemExit(f"anchor not found in project.pbxproj: {anchor!r}")
    return text.replace(anchor, anchor + "\n" + line, 1)


text = pbx.read_text()
if "PrivacyInfo.xcprivacy" in text:
    raise SystemExit("project.pbxproj is already patched")

text = insert_after(
    text,
    "/* Begin PBXBuildFile section */",
    f"\t\t{BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */ = {{isa = PBXBuildFile; "
    f"fileRef = {FILE_REF} /* PrivacyInfo.xcprivacy */; }};",
)
text = insert_after(
    text,
    "/* Begin PBXFileReference section */",
    f"\t\t{FILE_REF} /* PrivacyInfo.xcprivacy */ = {{isa = PBXFileReference; "
    'lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };',
)
text = insert_after(
    text,
    "\t\t\t\t504EC3131FED79650016851F /* Info.plist */,",
    f"\t\t\t\t{FILE_REF} /* PrivacyInfo.xcprivacy */,",
)
text = insert_after(
    text,
    "\t\t\t\t50B271D11FEDC1A000F3C39B /* public in Resources */,",
    f"\t\t\t\t{BUILD_FILE} /* PrivacyInfo.xcprivacy in Resources */,",
)

text, families = re.subn(r'TARGETED_DEVICE_FAMILY = "1,2";', "TARGETED_DEVICE_FAMILY = 1;", text)
text, versions = re.subn(r"MARKETING_VERSION = 1\.0;", "MARKETING_VERSION = 1.0.0;", text)
if (families, versions) != (2, 2):
    raise SystemExit(f"expected 2 device-family and 2 version settings, found {families} and {versions}")
pbx.write_text(text)


def buddy(*commands: str, check: bool = True) -> None:
    for command in commands:
        subprocess.run(["/usr/libexec/PlistBuddy", "-c", command, str(plist)], check=check)


buddy("Delete :UISupportedInterfaceOrientations~ipad", check=False)
buddy(
    "Delete :UISupportedInterfaceOrientations",
    "Add :UISupportedInterfaceOrientations array",
    "Add :UISupportedInterfaceOrientations:0 string UIInterfaceOrientationPortrait",
    "Add :ITSAppUsesNonExemptEncryption bool false",
    "Add :UIUserInterfaceStyle string Dark",
)
print("patched project.pbxproj and Info.plist")
```

Run:
```bash
cd web && python3 /tmp/patch_ios_project.py ios/App && plutil -lint ios/App/App/Info.plist ios/App/App/PrivacyInfo.xcprivacy && /usr/libexec/PlistBuddy -c "Print :UISupportedInterfaceOrientations" -c "Print :UIUserInterfaceStyle" -c "Print :ITSAppUsesNonExemptEncryption" ios/App/App/Info.plist && grep -c PrivacyInfo ios/App/App.xcodeproj/project.pbxproj && grep -c 'TARGETED_DEVICE_FAMILY = 1;' ios/App/App.xcodeproj/project.pbxproj
```
Expected: `patched project.pbxproj and Info.plist`, both plists `OK`, an array holding only `UIInterfaceOrientationPortrait`, `Dark`, `false`, `4`, `2`.

- [ ] **Step 6: The app icon**

Create `tools/make_ios_icon.py` (Pillow is already in `requirements.txt`; the script is linted by CI's `ruff check .`):

```python
"""Draw the 1024 px iOS app icon from the favicon's four-bar mark."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
SUPERSAMPLE = 4
VIEWBOX = 32
BACKGROUND = (0x09, 0x09, 0x0B)
BARS = [
    (5, 11, 4, 10, (0x00, 0xCC, 0x7E)),
    (23, 12, 4, 8, (0x00, 0xCC, 0x7E)),
    (11, 6, 4, 20, (0x00, 0xFF, 0x9D)),
    (17, 9, 4, 14, (0x00, 0xFF, 0x9D)),
]


def draw_icon() -> Image.Image:
    side = SIZE * SUPERSAMPLE
    unit = side / VIEWBOX
    image = Image.new("RGB", (side, side), BACKGROUND)
    draw = ImageDraw.Draw(image)
    for x, y, width, height, colour in BARS:
        box = (x * unit, y * unit, (x + width) * unit - 1, (y + height) * unit - 1)
        draw.rounded_rectangle(box, radius=2 * unit, fill=colour)
    return image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main(argv: list[str]) -> int:
    out = Path(argv[1])
    out.parent.mkdir(parents=True, exist_ok=True)
    draw_icon().save(out, format="PNG")
    print(f"[make_ios_icon] {out} ({SIZE}x{SIZE}, no alpha)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

Run:
```bash
python3 tools/make_ios_icon.py web/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png && sips -g pixelWidth -g pixelHeight -g hasAlpha web/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
```
Expected: `1024`, `1024`, `hasAlpha: no`. The template's `Contents.json` already names that file as the single 1024 px icon, so it needs no change. Open the PNG: four green bars on near-black, the favicon at 32×.

If `ruff` is installed (`pip install -r requirements-dev.txt`), run `ruff check tools/make_ios_icon.py`; expected clean.

- [ ] **Step 7: Build for the simulator**

```bash
cd web && npx cap sync ios && npm run ios:sim
```
Expected: exits 0 in about 30 s (the first run resolves Swift packages from GitHub). Then confirm the manifest shipped and the launch screen compiled:

```bash
ls "${TMPDIR:-/tmp}/armyjay-ios/Build/Products/Debug-iphonesimulator/App.app" | grep -E 'PrivacyInfo|Assets.car'
ls "${TMPDIR:-/tmp}/armyjay-ios/Build/Products/Debug-iphonesimulator/App.app/Base.lproj"
```
Expected: `Assets.car`, `PrivacyInfo.xcprivacy`, and `LaunchScreen.storyboardc` in the second listing.

- [ ] **Step 8: Smoke it in the simulator**

```bash
D=$(xcrun simctl list devices available | grep -m1 'iPhone 17 (' | sed -E 's/.*\(([0-9A-F-]+)\).*/\1/')
xcrun simctl boot "$D"; xcrun simctl bootstatus "$D"
xcrun simctl install "$D" "${TMPDIR:-/tmp}/armyjay-ios/Build/Products/Debug-iphonesimulator/App.app"
xcrun simctl launch "$D" com.armyjay.app
sleep 10 && xcrun simctl io "$D" screenshot /tmp/armyjay-landing.png
```
Open `/tmp/armyjay-landing.png` and check: the launch was a solid dark screen; the `ARMY JAY · Sounds · OSD Fonts` nav sits fully **below** the clock and status icons (not under them); the status bar text is light. Then in the Simulator window tap **Sounds → Library**: only the callouts, flight, memes and warnings categories exist, and the memes category has two sounds. Tap a **WAV** button: the iOS share sheet opens on `<name>.wav`. Finish with `xcrun simctl shutdown "$D"`.

- [ ] **Step 9: Document it**

Append to `web/README.md`, before the `## Deploy` section:

````markdown
## iPhone app

The same site, wrapped in Capacitor. Nothing about the web build changes;
the app detects at runtime that it is native (`src/platform/platform.ts`)
and swaps only the export path (`saveFile` / `SaveLink`: share sheet instead
of `<a download>`), three lines of copy, and the donation link.

```bash
npm run build:ios   # build, derive dist-ios/, cap sync
npm run ios:sim     # unsigned simulator build (DerivedData under $TMPDIR)
npm run ios:open    # the Xcode project, for a signed build on a phone
```

`dist-ios/` is `dist/` with the library trimmed to the 27 sounds licensed
`generated-original` (`scripts/trim-library.mjs`, an allowlist that fails
closed) and the web-host files removed (`scripts/prepare-ios.mjs`).
Capacitor's `webDir` points at `dist-ios/`, never `dist/`, so the 71
fair-use clips cannot reach the App Store build.

The Xcode project under `ios/` is committed. It is iPhone-only, portrait,
iOS 15+, forced dark, and carries the privacy manifest the Filesystem plugin
requires. The icon is drawn by `../tools/make_ios_icon.py`.
````

- [ ] **Step 10: Commit**

```bash
cd web && git status --short ios | head   # only source files: no public/, build/ or capacitor.config.json
```

```bash
cd web
git add capacitor.config.ts package.json tsconfig.node.json README.md ios ../tools/make_ios_icon.py
git commit -m "$(cat <<'EOF'
Add the iPhone app: Capacitor shell and Xcode project

Capacitor 8 over dist-ios/, Swift Package Manager, no CocoaPods.
The project is iPhone-only and portrait, forced dark so the status bar
reads light on the app's near-black, ships the privacy manifest the
Filesystem plugin requires, and launches to a solid #09090b. The icon
is generated from the favicon's mark by tools/make_ios_icon.py.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Signed build on a real iPhone

**Files:**
- Modify: `web/ios/App/App.xcodeproj/project.pbxproj` (`DEVELOPMENT_TEAM`)

**Interfaces:**
- Consumes: everything above.
- Produces: the app on Jason's phone and a completed device checklist.

- [ ] **Step 1: STOP — get the go-ahead**

Signing with automatic provisioning **registers the bundle ID `com.armyjay.app` in Jason's Apple developer account**. That is outward-facing and the ID cannot be changed afterwards for this app. Ask Jason, in one message: *"Ready to sign. This registers `com.armyjay.app` with Apple under team 82S6ZVW7V2 — is that the ID you want, and shall I go ahead?"* Do not continue until the answer is yes. If a different ID is wanted, change it in `web/capacitor.config.ts` and in both `PRODUCT_BUNDLE_IDENTIFIER` lines of `project.pbxproj`, and re-run `npx cap sync ios`.

- [ ] **Step 2: Set the team**

```bash
cd web && python3 -c "
from pathlib import Path
p = Path('ios/App/App.xcodeproj/project.pbxproj'); s = p.read_text()
old = 'CODE_SIGN_STYLE = Automatic;'
assert s.count(old) == 2 and 'DEVELOPMENT_TEAM' not in s
p.write_text(s.replace(old, old + '\n\t\t\t\tDEVELOPMENT_TEAM = 82S6ZVW7V2;'))
" && grep -c 'DEVELOPMENT_TEAM = 82S6ZVW7V2;' ios/App/App.xcodeproj/project.pbxproj
```
Expected: `2`.

- [ ] **Step 3: Build and install on the phone**

Plug the iPhone in, unlock it, and trust the Mac if asked. Developer Mode must be on (Settings → Privacy & Security → Developer Mode). Xcode must be signed in to the Apple ID that owns the team (Xcode → Settings → Accounts) for `-allowProvisioningUpdates` to work.

```bash
cd web && npm run build:ios
xcrun devicectl list devices            # note the phone's identifier
xcodebuild -quiet -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS' -derivedDataPath "${TMPDIR:-/tmp}/armyjay-ios" -allowProvisioningUpdates build
xcrun devicectl device install app --device <identifier> "${TMPDIR:-/tmp}/armyjay-ios/Build/Products/Debug-iphoneos/App.app"
```
If the command line fights the provisioning, `npm run ios:open`, pick the phone as the run destination, and press Run — that is the same build with Xcode handling the profile.

- [ ] **Step 4: Run the device checklist**

On the phone, with Jason, tick each item. Every one is something the simulator spike could not see.

- [ ] Nav clears the status bar and Dynamic Island; footer clears the home indicator.
- [ ] Convert: the picker opens from a tap, an MP3 from Files converts, and the result saves to Files as `<name>.wav`.
- [ ] The saved WAV plays, and `afinfo` on the Mac reports 32 kHz mono 16-bit (AirDrop it over).
- [ ] Library: preview plays; a single WAV saves; a ZIP of several saves.
- [ ] My Sounds: a save, the ZIP of all, and "clear all" with its confirmation dialog.
- [ ] Font browser: a shipped `.mcm` saves and is byte-identical to `fonts/` (`cmp` after AirDrop).
- [ ] Glyph editor: drag-painting with a finger works and does not scroll the page; undo works; the edited font saves and passes `python tools/validate.py <file>` structurally (check 10, outline integrity, may legitimately flag a lone painted pixel).
- [ ] Splash uploader: choosing a PNG from Photos or Files works.
- [ ] Edits and saved sounds survive force-quitting the app.
- [ ] The Source link opens in Safari, not inside the app.

Anything that fails is a bug to fix in the owning task's code with a test, then re-run this step.

- [ ] **Step 5: Commit**

```bash
cd web
git add ios/App/App.xcodeproj/project.pbxproj
git commit -m "$(cat <<'EOF'
Sign the iPhone app with the Army Jay team

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

Record the checklist outcome in the pull request description, item by item.
