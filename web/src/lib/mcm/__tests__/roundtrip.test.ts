import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodeFont } from '../decode'
import { encodeFont } from '../encode'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const read = (rel: string) => readFileSync(resolve(REPO, rel), 'latin1')

/**
 * Every font this repo ships, plus the two vendored stock references.
 * These are the real files the Python pipeline builds and CI verifies, so a
 * change on the Python side fails this suite rather than shipping a font the
 * web app would mis-encode.
 */
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
    const original = read(rel)
    expect(encodeFont(decodeFont(original))).toBe(original)
  })

  it('is 147463 bytes with an unterminated final line', () => {
    const original = read(rel)
    expect(original.length).toBe(147463)
    expect(original.endsWith('\n')).toBe(false)
  })
})
