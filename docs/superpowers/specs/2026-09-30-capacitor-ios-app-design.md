# Army Jay for iPhone: the site in a Capacitor shell

**Date:** 2026-09-30
**Status:** draft for review
**Scope:** milestone 1 of 2 — a signed app running on a real iPhone (see Milestones)

## Context

The Army Jay site (`web/`) is a fully client-side React app: an EdgeTX `.wav`
converter, a sound library, My Sounds, and the OSD font browser and glyph
editor. The goal is the same app on an iPhone, exportable from Xcode, without
a second codebase.

A throwaway spike on 2026-09-30 wrapped the unmodified production build in
Capacitor 8.5.2 and ran it in the iOS 26.5 simulator (iPhone 17). It drove
the real UI and wrote its findings to disk, which were then checked from the
Mac.

| Spike check | Result |
|---|---|
| MP3 and M4A through the real Convert page | Both produced 32 kHz mono 16-bit PCM, confirmed with `afinfo` |
| ffmpeg.wasm without cross-origin isolation | Works. `crossOriginIsolated` is `false` and `SharedArrayBuffer` is undefined in the web view; the single-thread `@ffmpeg/core` does not need them |
| Font editor, unedited export | Byte-identical to `fonts/armyjay_full.mcm` |
| One pixel painted on `0x41`, exported | 147,463 bytes, 2 bytes differ from the shipped font |
| IndexedDB after relaunch | Both stores survive: `1 glyph changed.` and two saved sounds were still present |
| The site's `<a download>` link | Does nothing in the web view; no file is written |
| `Filesystem.writeFile` then `Share.share` | Share sheet opens on the file with "Save to Files" |
| Unsigned Release archive, `generic/platform=iOS` | Succeeds, arm64, 46 MB |

The spike also showed the nav rendering underneath the status bar and
Dynamic Island.

Not covered by the spike, and therefore not yet known: painting with a real
finger (the spike used the editor's keyboard path), the file picker from a
real tap, audio playback, the ZIP exports, and speed on phone hardware.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Wrapper | Capacitor 8, Swift Package Manager | Proven by the spike. One codebase; the site is already static and client-side. No CocoaPods. |
| Where it lives | Inside `web/`: `web/capacitor.config.ts` and a committed `web/ios/` | Capacitor's convention. The native project carries signing and Info.plist settings that must be versioned. |
| Platform differences | Decided at **runtime** (`Capacitor.isNativePlatform()`), not by a separate build mode | The differences are small (export, three bits of copy, one footer link). A second Vite mode would double what has to be tested. |
| Web behaviour | **Unchanged.** Every download on the site stays the `<a download>` it is today | The site works. The app must not be able to regress it. |
| Sound library in the app | Always trimmed to `license: "generated-original"` (27 of 98) | The other 71 are tagged `fair-use-personal` — film, TV, game and meme clips — which App Store review would reject on IP grounds. One iOS build, no "personal" variant to keep in sync. |
| Devices | iPhone only, portrait only, iOS 15+ | What was asked for. iPad and landscape are a later flag flip, each with its own screenshots and testing. |
| Donation link | Hidden in the app | An external "Buy me a coffee" link is a known review risk. The Source link stays. |

### Decisions that are yours to confirm

1. **Bundle ID.** Proposed: `com.armyjay.app`. Once registered with Apple it
   cannot be changed for this app.
2. **Always-trimmed library.** The alternative is a second, full-library
   build for your own phone only.
3. **ffmpeg's licence** — see Risks. It does not block this milestone but
   should be settled before a public App Store release.

## Milestones

| | Milestone | In this spec |
|---|---|---|
| 1 | The app builds, signs, and runs correctly on a real iPhone | **yes** |
| 2 | TestFlight and App Store submission: metadata, screenshots, privacy and support URLs, review | no — its own spec |

Milestone 2 needs the site's real domain for the privacy and support URLs,
which is still an open item from the site-merge spec.

## Layout

```
web/
  capacitor.config.ts        NEW  appId, appName, webDir: 'dist-ios'
  ios/                       NEW  Xcode project, committed (SPM)
  scripts/
    trim-library.mjs         NEW  pure library filter (plain JS: Node runs it directly)
    prepare-ios.mjs          NEW  dist/ -> dist-ios/, trimmed and cleaned
    __tests__/               NEW
  src/
    platform/
      platform.ts            NEW  isNativeApp()
      saveFile.ts            NEW  the one export path
      __tests__/             NEW
    components/
      SaveLink.tsx           NEW  <a download> on web, button + share sheet in the app
      __tests__/             NEW
  ios/App/App/
    PrivacyInfo.xcprivacy    NEW  required by the Filesystem plugin
tools/
  make_ios_icon.py           NEW  draws the 1024 px icon from the favicon's mark
```

`web/dist-ios/` is gitignored. Capacitor's own `ios/.gitignore` already
excludes the copied web assets and build output.

New dependencies: `@capacitor/core`, `@capacitor/ios`,
`@capacitor/filesystem`, `@capacitor/share`, and `@capacitor/cli` (dev).
`@capacitor/cli` needs Node 22; `.nvmrc` already pins it.

## Export — the one real code change

Eight places hand the user a file today. All eight break in the app.

| Site | File | Today |
|---|---|---|
| `SoundCard` | library `.wav` | `<a download>` to a static path |
| `Library` | selected sounds `.zip` | programmatic blob anchor |
| `Converter` | converted `.wav` | `<a download>` to a blob URL |
| `MySounds` | one saved `.wav` | `<a download>` to a blob URL |
| `MySounds` | all saved `.zip` | programmatic blob anchor |
| `FontDetail` | shipped `.mcm` | `<a download>` to a static path |
| `FontDetail` | craft-name `.mcm` | `<a download>` to a static path |
| `FontEditor` | edited `.mcm` | `<a download>` to a blob URL |

### `saveFile`

```ts
// web/src/platform/saveFile.ts
export type SaveOutcome = 'saved' | 'cancelled'

/** `source` is a Blob, or a URL (static path or blob:) to fetch. */
export function saveFile(filename: string, source: Blob | string): Promise<SaveOutcome>
```

- **Web:** creates an anchor with `download`, clicks it, and resolves
  `'saved'`. This replaces the two copies of that code in `Library` and
  `MySounds`.
- **App:** resolves the source to bytes (fetching a URL if given — the spike
  confirmed `fetch` works on `blob:` URLs in the web view), writes them to
  `Directory.Cache` at `exports/<filename>`, and opens the share sheet on the
  resulting file URI. It clears `exports/` **before** each write rather than
  deleting the file afterwards: the app receiving a share may still be
  reading the file when the sheet closes. Saves are serialised for the same
  reason — two overlapping saves would otherwise clear each other's file.

The file is written under its **real filename**, because the share sheet and
"Save to Files" use the on-disk name. EdgeTX triggers on exact names
(`armed.wav`), so a temporary name would silently produce a sound that never
plays.

Bytes cross the native bridge as base64. Writes are chunked — `writeFile`
for the first 768 KB, `appendFile` for the rest — so a large My Sounds ZIP
does not travel as one string. 768 KB is a multiple of 3 bytes, so every chunk
encodes without padding mid-stream.

Static files are written from the fetched bytes, never re-encoded. The font
browser's promise — that a shipped font downloads as exactly the bytes CI
verified — holds in the app too.

The two Capacitor plugins are imported dynamically inside the app branch, so
they stay out of the site's bundle.

### `SaveLink`

```tsx
<SaveLink href={url} filename="armed.wav" className="…" onClick={…}>…</SaveLink>
```

Same props as the anchor it replaces. On the web it renders that anchor,
unchanged. In the app it renders a `<button>` that calls
`saveFile(filename, href)` and is disabled while a save is in flight. The six
anchor sites swap to `SaveLink`; the two ZIP sites call `saveFile` directly.

### Errors

| Case | Behaviour |
|---|---|
| User dismisses the share sheet | `'cancelled'`; no toast |
| Write fails (storage full, permissions) | Error toast with the plugin's message |
| Fetch of a static file fails | Error toast naming the file |
| Success | Existing success toasts stay; the "Downloading …" wording becomes "Saved …" in the app |

## Safe areas

- `index.html`: add `viewport-fit=cover` to the viewport meta.
- `Nav`: `padding-top: env(safe-area-inset-top)` on the sticky header.
- `Footer`: `padding-bottom: env(safe-area-inset-bottom)`.
- `Toaster`: bottom offset gains `env(safe-area-inset-bottom)`.
- `Layout`: left and right insets, so a notched phone in landscape Safari is
  not affected by `viewport-fit=cover`.

`env()` insets are zero in a desktop browser, so the site is visually
unchanged. The web view's background is set to `#09090b` in
`capacitor.config.ts`. The status bar reads light because `Info.plist`
forces `UIUserInterfaceStyle` to `Dark` — Capacitor's `SystemBars.style`
setting is Android-only.

## App-only adjustments

Kept to what would otherwise be wrong or get the app rejected:

- `Footer`: no "Buy me a coffee" link.
- `DropZone`: "Choose an audio file" instead of "Drop an audio file or click
  to browse".
- `FontEditor`: hide the `1/2/3` and `⌘Z` keyboard hint.

## Build

```
npm run build:ios    # npm run build && node scripts/prepare-ios.mjs && cap sync ios
npm run ios:sim      # unsigned simulator build via xcodebuild
npm run ios:open     # cap open ios
```

`prepare-ios.mjs` copies `dist/` to `dist-ios/` and then:

1. Rewrites `library.json` through `trimLibrary`.
2. Deletes every file under `sounds/` the trimmed library does not reference.
3. Deletes web-only files: `_headers`, `_redirects`, `sitemap.xml`,
   `robots.txt`, `og.png`.
4. **Fails the build** if any unreferenced file remains under `sounds/`.

`trimLibrary` is an allowlist and fails closed: a sound is kept only if its
licence is exactly `generated-original`. A missing or unrecognised licence is
dropped. Categories left empty are removed.

## Xcode project settings

| Setting | Value |
|---|---|
| Display name | Army Jay |
| Bundle ID | `com.armyjay.app` (to confirm) |
| Team | `82S6ZVW7V2` |
| Signing | Automatic |
| Devices | iPhone |
| Orientation | Portrait |
| Version / build | 1.0.0 / 1 |
| `ITSAppUsesNonExemptEncryption` | `false` |
| App icon | One 1024 px PNG: the `favicon.svg` mark on `#09090b` |
| Launch screen | Solid `#09090b` |
| `UIUserInterfaceStyle` | `Dark` — light status-bar text, and dark native sheets to match |

The app makes no network requests beyond its own bundled files and collects
nothing (`analytics.ts` is a stub), so no usage-description strings are
needed.

**Signing registers the bundle ID in your Apple developer account.** That
step is outward-facing and irreversible for the ID, so implementation stops
and asks before the first signed build.

## Testing

**Unit (Vitest, added to the existing `web` CI job):**

- `saveFile`, app branch, with the plugins mocked (and the browser branch
  with a stubbed anchor):
  - bytes written decode back to the input exactly, for a small blob and for
    one spanning several chunks;
  - the file is written under the exact filename given;
  - a URL source is fetched;
  - the share sheet is opened on the URI the write returned;
  - a dismissed share resolves `'cancelled'`; any other failure rejects.
- `trimLibrary`, against the **real** `public/library.json`: 27 sounds kept,
  none with another licence, no empty categories; plus synthetic cases for a
  missing, unknown, differently-cased and padded licence.
- `prepareIos`, against a fake `dist/` in a temp dir: only listed sounds
  survive, web-only files go, `dist/` is untouched, a stale `dist-ios/` is
  wiped, and a missing or path-escaping sound file fails the build.
- `SaveLink`, `Footer` and `DropZone` rendered with `react-dom/server`, the
  platform check mocked each way: the browser markup of `SaveLink` is
  asserted byte for byte, which is the "web unchanged" guarantee.

**Build:** `npm run build:ios` and `npm run ios:sim` both succeed. These run
on the Mac, not in CI — the CI runner is Linux. A macOS CI job is out of
scope. `ios:sim` keeps DerivedData under `$TMPDIR`, outside the
iCloud-synced repo.

**On a real iPhone, by hand** — the things the spike could not see:

- [ ] Nav clears the status bar and Dynamic Island; footer clears the home
      indicator.
- [ ] Convert: the picker opens from a tap, an MP3 from Files converts, and
      the result saves to Files as `<name>.wav`.
- [ ] The saved WAV plays, and `afinfo` on the Mac reports 32 kHz mono
      16-bit.
- [ ] Library: preview plays; a single WAV saves; a ZIP of several saves.
- [ ] My Sounds: a save, the ZIP of all, and "clear all" with its
      confirmation.
- [ ] Font browser: a shipped `.mcm` saves and is byte-identical to
      `fonts/` (`cmp` after AirDrop).
- [ ] Glyph editor: drag-painting with a finger works and does not scroll
      the page; undo works; the edited font saves and passes
      `tools/validate.py`'s structural checks.
- [ ] Splash uploader: choosing a PNG from Photos or Files works.
- [ ] Edits and saved sounds survive force-quitting the app.
- [ ] The Source link opens in Safari, not inside the app.

## Risks

**ffmpeg's licence.** `@ffmpeg/core` is GPL-2.0-or-later. The App Store's
terms and the GPL are widely regarded as incompatible; VLC was pulled from
the store in 2011 on exactly this point. The rest of the repo is MIT and the
site can ship ffmpeg without issue, but an App Store binary that embeds it
carries that exposure. Options:

| Option | Cost |
|---|---|
| Ship it and accept the exposure | None now; a takedown request later is possible |
| In the app only, replace ffmpeg with Web Audio decoding plus an in-house resampler and WAV writer | Its own spike: format coverage (`.ogg` especially) and resample quality are unknown. Would also remove about 31 MB from the app |

Recommendation: build milestone 1 on ffmpeg, which is proven, and spike the
Web Audio path before milestone 2.

**Review under guideline 4.2 (minimum functionality).** Apple rejects apps
that are only a wrapped website. This one converts audio and edits fonts
on-device, which is real functionality, but the risk is not zero.

**The repo is in iCloud-synced `~/Documents`.** Evicted files already hung
the lint run once. Xcode reading an evicted `web/ios/` will stall the same
way. Moving the repo out of `~/Documents` before starting is advisable.

**Two things the spike did not exercise were confirmed from the installed
packages while planning:** the Filesystem plugin's README requires a
`PrivacyInfo.xcprivacy` in the app target declaring
`NSPrivacyAccessedAPICategoryFileTimestamp` (reason `C617.1`), so it is
included; and Capacitor's status-bar style config is Android-only, hence
`UIUserInterfaceStyle`.

## Out of scope

- TestFlight, App Store metadata and submission (milestone 2).
- iPad and landscape layouts.
- Android.
- Flashing fonts or writing to a radio from the phone. The app produces
  files; getting them onto hardware is unchanged.
- A macOS CI job for the iOS build.
- Replacing ffmpeg.

## Acceptance criteria

1. `npm run build` output and behaviour on the web are unchanged; lint, the
   existing 46 tests and the new ones pass in CI.
2. `npm run build:ios` produces a `dist-ios/` containing exactly the 27
   original sounds and none of the web-only files.
3. `npm run ios:sim` succeeds.
4. A signed build installs on a real iPhone and every item on the device
   checklist passes.
5. All eight export sites open the share sheet in the app, under the correct
   filename.
6. The Python suite is untouched: 68 tests, validator, cross-check.
