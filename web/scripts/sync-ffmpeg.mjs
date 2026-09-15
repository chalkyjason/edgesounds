// Copies ffmpeg.wasm runtime assets from node_modules into public/ffmpeg/
// so the browser fetches them same-origin (no COEP/CORP cross-origin grief)
// and the patched classic-worker variant works correctly.
//
// Run automatically via the postinstall script. Re-run by hand whenever
// @ffmpeg/core or @ffmpeg/ffmpeg is bumped.

import { copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dest = join(root, 'public', 'ffmpeg')
mkdirSync(dest, { recursive: true })

const files = [
  ['node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js',  'ffmpeg-core.js'],
  ['node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm','ffmpeg-core.wasm'],
  ['node_modules/@ffmpeg/ffmpeg/dist/umd/814.ffmpeg.js', '814.ffmpeg.js'],
]

for (const [src, name] of files) {
  const from = join(root, src)
  if (!existsSync(from)) {
    console.error(`[sync-ffmpeg] missing source: ${src}`)
    process.exit(1)
  }
  copyFileSync(from, join(dest, name))
  console.log(`[sync-ffmpeg] ${name}`)
}
