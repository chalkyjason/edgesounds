# EdgeSounds

A single-page web app for FPV pilots that converts any audio file to EdgeTX-compatible `.wav` format — entirely in the browser — and hosts a curated library of pre-converted, ready-to-download sounds.

> Make your FPV radio talk back.

## What it does

- **Convert** mp3 / m4a / wav / ogg / flac → 32 kHz mono 16-bit PCM `.wav` (the format EdgeTX actually wants), all client-side via [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm). No upload, no server.
- **Library** of pre-converted sounds organised by category (callouts, memes, movies, TV, games, warnings) — preview, single download, or bundle multiple files into a ZIP.
- **Setup guide** covering the two things EdgeTX treats differently: firmware-fixed auto-trigger sounds (`thralert.wav`, `telemko.wav`, … in `/SOUNDS/<lang>/SYSTEM/`) and Play Track sounds you bind to a switch yourself (`armed.wav`, `dsarmd.wav`, … in `/SOUNDS/<lang>/`), plus the gotchas that bite first-timers.

## Why these constraints

EdgeTX silently rejects sounds that don't meet its format. The radio just stays quiet — there's no error to debug. Every output produced here is locked to:

| Property        | Value                              |
|-----------------|------------------------------------|
| Container       | RIFF `.wav`                        |
| Codec           | PCM signed 16-bit little-endian    |
| Sample rate     | 32000 Hz                           |
| Channels        | 1 (mono)                           |
| Filename        | ≤8 chars + `.wav`, ASCII letters/digits/underscores only |

The 8-character limit is `LEN_FUNCTION_NAME` in EdgeTX's `radio/src/dataconstants.h`, which is 8 for every radio variant (colour LCD, 212px, and b&w alike). Auto-trigger filenames are taken from EdgeTX's own sound pack ([`edgetx-sdcard-sounds`](https://github.com/EdgeTX/edgetx-sdcard-sounds), `SOUNDS/en/SYSTEM`) rather than from convention — those names are matched exactly by the firmware, and several of them (`thralert`, `inactiv`, `telemko`) are longer than six characters.

## Local development

Node 20.19+ or 22.12+ (`.nvmrc` pins 22 — `nvm use`). This isn't cosmetic: Vite 8's
rolldown binary is an optional dependency gated on that same engine range, and npm
*silently skips* optional deps whose engines don't match. On an older Node you get a
successful-looking `npm install` followed by `vite build` dying with
`Cannot find module './rolldown-binding.darwin-*.node'`.

```bash
nvm use
npm install
npm run dev
```

The dev server applies the cross-origin headers required by `ffmpeg.wasm` (`SharedArrayBuffer` needs them):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If you're proxying behind another server, mirror those headers or the audio engine won't load.

## Build

```bash
npm run build
npm run preview
```

The preview server reproduces the COOP/COEP headers so you can test the full conversion flow against the production bundle.

## Adding sounds to the library

The library is data + files in the repo. No backend.

1. Drop your `.wav` in `public/sounds/<category>/`. The file on disk can have a descriptive name — it's the `filename` field below that has to be EdgeTX-legal (max 8 chars + `.wav`), since that's what the download is renamed to.
2. Edit `public/library.json` and append an entry to the right category:
   ```json
   {
     "id": "armed-topgun",
     "filename": "armed.wav",
     "displayName": "Top Gun — I feel the need for speed",
     "trigger": "armed",
     "duration": 2.4,
     "tags": ["movie", "armed", "topgun"],
     "path": "/sounds/callouts/armed-topgun.wav",
     "credit": "Top Gun (1986)",
     "license": "fair-use-personal"
   }
   ```
3. PR. The site picks up the change on next deploy.

## Deploy

Designed for static hosts that read `_headers` / `_redirects` (Cloudflare Pages, Netlify). Both files live in `public/` and are copied verbatim into `dist/` at build time.

`public/_headers` carries the cross-origin isolation `ffmpeg.wasm` needs:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

`public/_redirects` is the SPA fallback. Without it, a direct load or refresh of `/library`, `/convert`, `/my` or `/setup` 404s — react-router only owns those paths once the app has booted:

```
/*  /index.html  200
```

On a host that reads neither file (Vercel, S3, nginx), mirror both by hand: the two COOP/COEP headers on every response, and a rewrite of any non-asset path to `/index.html`. Miss the headers and the audio engine never loads; miss the rewrite and every deep link 404s.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 3 (electric-green accent on a zinc dark base)
- `@ffmpeg/ffmpeg` 0.12 + `@ffmpeg/util` (modular API, lazy-loaded only on `/convert`)
- `react-router-dom` v7 for routing
- `lucide-react` icons
- `JSZip` for "download multiple as ZIP"

## Project layout

```
src/
├── components/    Layout, Nav, Footer, Converter, SoundCard, etc.
├── hooks/         FFmpeg singleton, conversion, library, shared audio, toasts
├── pages/         Home, Library, Convert, Setup
├── types/         SoundEntry, ConversionResult, …
└── utils/         filename sanitization, audio validation, trigger presets
public/
├── library.json   Library metadata (categories + sounds)
├── sounds/        Library audio files, organised by category
├── _headers       COOP/COEP (ffmpeg.wasm needs cross-origin isolation)
├── _redirects     SPA fallback — without it every deep link 404s
├── og.png         Social card (regenerate: scripts/generate-og.py)
└── sitemap.xml    Indexed routes
```

## Social card

`public/og.png` (1200x630) is the Open Graph / Twitter card, referenced by the meta tags in `index.html`. It's drawn by a script rather than screenshotted so it stays reproducible:

```bash
python3 scripts/generate-og.py   # needs Pillow
```

Edit the copy or palette in that script and re-run it; the palette constants mirror `tailwind.config.js`. The five-bar mark matches `public/favicon.svg`.

## License

MIT.
