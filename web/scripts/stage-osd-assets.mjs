// Copies the OSD artifacts the Python pipeline builds into public/osd/ so Vite
// serves them, and derives variants.json from variants.toml.
//
// These files are deliberately NOT committed under web/: the pipeline at the
// repo root is their only author, and duplicating them would let the two
// copies drift. This runs on predev and prebuild.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = dirname(dirname(fileURLToPath(import.meta.url)))
const REPO = dirname(WEB)
const DEST = join(WEB, 'public', 'osd')

function fail(message) {
  console.error(`[stage-osd-assets] ${message}`)
  process.exit(1)
}

function copyDir(fromRel, toRel, ext) {
  const from = join(REPO, fromRel)
  const to = join(DEST, toRel)
  let names
  try {
    names = readdirSync(from).filter((n) => n.endsWith(ext))
  } catch {
    fail(`missing ${fromRel}/ -- run the Python build first`)
  }
  if (names.length === 0) fail(`${fromRel}/ has no ${ext} files`)
  mkdirSync(to, { recursive: true })
  for (const name of names) copyFileSync(join(from, name), join(to, name))
  console.log(`[stage-osd-assets] ${fromRel}/ -> public/osd/${toRel}/ (${names.length})`)
  return names
}

// variants.toml is small and regular; a regex beats adding a TOML dependency.
function readVariants() {
  const toml = readFileSync(join(REPO, 'variants.toml'), 'utf8')
  const variants = []
  const blocks = toml.split(/^\[variants\./m).slice(1)
  for (const block of blocks) {
    const id = block.slice(0, block.indexOf(']'))
    const output = block.match(/^output\s*=\s*"([^"]+)"/m)?.[1]
    // description is either "..." or a """\ ... """ continuation block
    let description = block.match(/^description\s*=\s*"([^"\n]+)"/m)?.[1]
    if (!description) {
      const multi = block.match(/^description\s*=\s*"""\\?\n([\s\S]*?)"""/m)?.[1]
      description = multi ? multi.replace(/\\\n/g, '').replace(/\s+/g, ' ').trim() : ''
    }
    if (!output) fail(`variant ${id} has no output`)
    variants.push({ id, output, description })
  }
  if (variants.length === 0) fail('variants.toml declared no variants')
  return variants
}

mkdirSync(DEST, { recursive: true })
const fonts = copyDir('fonts', 'fonts', '.mcm')
copyDir('previews', 'previews', '.png')

// The start-screen page needs two more things from the repo: the stencil
// alphabets the Python splash builder also reads, and Betaflight's stock
// font as an export base. Both are vendored at the root, neither is ours to
// duplicate under web/.
function copyFile(fromRel, toRel) {
  const from = join(REPO, fromRel)
  if (!existsSync(from)) fail(`missing ${fromRel}`)
  mkdirSync(dirname(join(DEST, toRel)), { recursive: true })
  copyFileSync(from, join(DEST, toRel))
  console.log(`[stage-osd-assets] ${fromRel} -> public/osd/${toRel}`)
}
copyFile('assets/splash_stencils.json', 'stencils.json')
copyFile('assets/references/stock/default_v2.mcm', 'fonts/betaflight_default.mcm')

const variants = readVariants().map((v) => {
  const craftName = v.output.replace(/\.mcm$/, '_craftname.mcm')
  return { ...v, craftName: fonts.includes(craftName) ? craftName : null }
})

for (const v of variants) {
  if (!fonts.includes(v.output)) fail(`variants.toml names ${v.output}, which fonts/ does not contain`)
}

writeFileSync(join(DEST, 'variants.json'), `${JSON.stringify(variants, null, 2)}\n`)
console.log(`[stage-osd-assets] variants.json (${variants.length} variants)`)
