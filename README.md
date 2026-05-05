# EdgeSounds

A single-page web app for FPV pilots that converts any audio file to EdgeTX-compatible `.wav` format — entirely in the browser — and hosts a curated library of pre-converted, ready-to-download sounds.

> Make your FPV radio talk back.

## What it does

- **Convert** mp3 / m4a / wav / ogg / flac → 32 kHz mono 16-bit PCM `.wav` (the format EdgeTX actually wants), all client-side via [`ffmpeg.wasm`](https://github.com/ffmpegwasm/ffmpeg.wasm). No upload, no server.
- **Library** of pre-converted sounds organised by category (callouts, memes, movies, TV, games, warnings) — preview, single download, or bundle multiple files into a ZIP.
- **Setup guide** with auto-trigger filenames (`armed.wav`, `dsarmd.wav`, …), Special Functions walkthrough, and the gotchas that bite first-timers.

## Why these constraints

EdgeTX silently rejects sounds that don't meet its format. The radio just stays quiet — there's no error to debug. Every output produced here is locked to:

| Property        | Value                              |
|-----------------|------------------------------------|
| Container       | RIFF `.wav`                        |
| Codec           | PCM signed 16-bit little-endian    |
| Sample rate     | 32000 Hz                           |
| Channels        | 1 (mono)                           |
| Filename        | ≤6 chars + `.wav`, ASCII letters/digits/underscores only |

## Local development

```bash
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

1. Drop your `.wav` in `public/sounds/<category>/`. Use the EdgeTX-expected filename (max 6 chars + `.wav`).
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

Designed for static hosts (Vercel, Cloudflare Pages, Netlify). `vercel.json` is included with the COOP/COEP headers and a SPA rewrite rule.

For Cloudflare Pages, set the same headers in `_headers`:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

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
└── sounds/        Library audio files, organised by category
```

## License

MIT.
