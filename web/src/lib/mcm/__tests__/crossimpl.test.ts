import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fontToAscii, glyphToAscii } from '../ascii'
import { decodeFont } from '../decode'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')

/**
 * The round-trip test proves decode and encode are inverses, but not that our
 * pixel interpretation matches Python's: swapping black and white
 * consistently would still round-trip byte-exactly while rendering every
 * glyph inverted. This fixture was produced by
 * `python tools/mcm_decode.py fonts/armyjay_full.mcm`, so matching it pins
 * the interpretation to the reference implementation.
 */
describe('cross-implementation', () => {
  const font = decodeFont(readFileSync(resolve(REPO, 'fonts/armyjay_full.mcm'), 'latin1'))
  const expected = readFileSync(resolve(HERE, 'fixtures/armyjay_full.dump.txt'), 'utf8')

  it('renders all 256 glyphs exactly as the Python decoder does', () => {
    expect(fontToAscii(font)).toBe(expected)
  })

  it("draws 'A' with a black outline around a white fill, not inverted", () => {
    const rows = glyphToAscii(font[0x41])
    expect(rows[3]).toBe('..--####--..')
    expect(rows.join('\n')).toContain('#')
    expect(rows.join('\n')).toContain('-')
  })
})
