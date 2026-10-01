// Builds dist-ios/, the web bundle the iPhone app ships, from dist/.
//
// The app is the site minus what it may not distribute through the App
// Store -- most of the sound library (see trim-library.mjs), ffmpeg and
// Betaflight's stock font -- and the files that only mean something to a web
// host. Capacitor's webDir points at dist-ios/, never at dist/, so the
// untrimmed library cannot be synced into the app by mistake.

import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { trimLibrary } from './trim-library.mjs'

export const WEB_ONLY_FILES = ['_headers', '_redirects', 'sitemap.xml', 'robots.txt', 'og.png']

// Betaflight's stock font, an export base on the start screen page, is
// GPL-3.0 like ffmpeg below; the app's export panel leaves it out.
export const NOT_IN_APP_FILES = ['osd/fonts/betaflight_default.mcm']

// ffmpeg.wasm is GPL, which the App Store's terms are widely held to
// conflict with, and 31 MB. The app converts with Web Audio instead.
export const WEB_ONLY_DIRS = ['ffmpeg']

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
  for (const name of NOT_IN_APP_FILES) rmSync(join(outDir, name), { force: true })
  for (const name of WEB_ONLY_DIRS) rmSync(join(outDir, name), { recursive: true, force: true })

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
