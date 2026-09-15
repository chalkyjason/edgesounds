import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GLYPH_COUNT, PIXELS_PER_GLYPH, decodeFont } from '../decode'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const read = (rel: string) => readFileSync(resolve(REPO, rel), 'latin1')

describe('decodeFont', () => {
  it('decodes a shipped font to 256 glyphs of 216 pixels', () => {
    const font = decodeFont(read('fonts/armyjay_full.mcm'))
    expect(font).toHaveLength(GLYPH_COUNT)
    for (const glyph of font) expect(glyph.pixels).toHaveLength(PIXELS_PER_GLYPH)
  })

  it('finds 0xFF fully transparent in stock v2 — the reserved splash tile', () => {
    const font = decodeFont(read('assets/references/stock/default_v2.mcm'))
    expect(new Set(font[0xff].pixels)).toEqual(new Set(['transparent']))
  })

  it('finds ink in a glyph that is definitely drawn', () => {
    const font = decodeFont(read('fonts/armyjay_full.mcm'))
    // 0x41 is 'A' in the ASCII block; it must have white pixels.
    expect(font[0x41].pixels).toContain('white')
  })
})
