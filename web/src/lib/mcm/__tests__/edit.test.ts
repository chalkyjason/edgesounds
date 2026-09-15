import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PIXELS_PER_GLYPH, decodeFont } from '../decode'
import { encodeFont } from '../encode'
import type { Pixel } from '../types'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const original = readFileSync(resolve(REPO, 'fonts/armyjay_full.mcm'), 'latin1')

/**
 * The editor hands users a font they will flash to hardware. An edit that
 * produced a structurally invalid file would brick their OSD silently, so the
 * edit -> encode path has to keep every invariant the format requires.
 */
describe('an edited font', () => {
  it('is still exactly 147463 bytes', () => {
    const font = decodeFont(original)
    font[0x41] = { pixels: Array<Pixel>(PIXELS_PER_GLYPH).fill('white') }
    const encoded = encodeFont(font)
    expect(encoded.length).toBe(147463)
    expect(encoded.endsWith('\n')).toBe(false)
  })

  it('round-trips the edit back out', () => {
    const font = decodeFont(original)
    const painted = Array<Pixel>(PIXELS_PER_GLYPH).fill('transparent')
    painted[0] = 'white'
    painted[1] = 'black'
    font[0x07] = { pixels: painted }

    const reread = decodeFont(encodeFont(font))
    expect(reread[0x07].pixels[0]).toBe('white')
    expect(reread[0x07].pixels[1]).toBe('black')
    expect(reread[0x07].pixels[2]).toBe('transparent')
  })

  it('leaves every untouched glyph identical', () => {
    const font = decodeFont(original)
    font[0x41] = { pixels: Array<Pixel>(PIXELS_PER_GLYPH).fill('black') }
    const reread = decodeFont(encodeFont(font))
    const base = decodeFont(original)
    for (let i = 0; i < 256; i += 1) {
      if (i === 0x41) continue
      expect(reread[i].pixels).toEqual(base[i].pixels)
    }
  })

  it('still parses, so padding and structure survived the edit', () => {
    const font = decodeFont(original)
    font[0xa0] = { pixels: Array<Pixel>(PIXELS_PER_GLYPH).fill('white') }
    expect(() => decodeFont(encodeFont(font))).not.toThrow()
  })
})
