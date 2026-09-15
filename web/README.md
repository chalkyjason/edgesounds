# Army Jay — the website

One site, two halves:

- **Sounds** (`/sounds/*`) — EdgeSounds. Converts any audio file to the
  32 kHz mono 16-bit PCM `.wav` EdgeTX accepts, entirely client-side via
  `ffmpeg.wasm`. Plus a 98-sound library, a My Sounds store (IndexedDB), and
  an EdgeTX setup guide.
- **OSD Fonts** (`/osd/*`) — browses the MAX7456 fonts built by the Python
  pipeline in the parent directory, rendering all 256 glyphs from the `.mcm`
  itself.

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

## Deploy

Static host; Cloudflare Pages root directory is `web/`. `public/_headers`
carries the COOP/COEP pair `ffmpeg.wasm` needs for `SharedArrayBuffer`, and
`public/_redirects` is the SPA fallback — without it every deep link 404s.

The public origin lives in `.env` as `VITE_SITE_URL`; `index.html` and the
generated `sitemap.xml`/`robots.txt` all read from it.
