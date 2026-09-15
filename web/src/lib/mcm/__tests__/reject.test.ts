import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { McmParseError, decodeFont } from '../decode'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const good = () => readFileSync(resolve(REPO, 'fonts/armyjay_full.mcm'), 'latin1')
const lines = () => good().split('\n')

/**
 * The same corruptions tools/validate.py is tested against. A decoder that
 * accepts these would let the site hand a pilot a font that bricks their OSD
 * silently, so each one must throw.
 */
describe('decodeFont rejects', () => {
  it('a wrong header', () => {
    const l = lines()
    l[0] = 'MAX7455'
    expect(() => decodeFont(l.join('\n'))).toThrow(McmParseError)
  })

  it('a truncated file', () => {
    expect(() => decodeFont(lines().slice(0, 900).join('\n'))).toThrow(/data lines/)
  })

  it('padding that is not 0x55', () => {
    const l = lines()
    l[64] = '00000000' // last padding line of glyph 0x00
    expect(() => decodeFont(l.join('\n'))).toThrow(/padding/i)
  })

  it('a line that is not 8 characters of 0 and 1', () => {
    const l = lines()
    l[5] = '0101'
    expect(() => decodeFont(l.join('\n'))).toThrow(/8 characters/)
  })

  it('a line containing something other than 0 or 1', () => {
    const l = lines()
    l[5] = '0101010x'
    expect(() => decodeFont(l.join('\n'))).toThrow(McmParseError)
  })

  it('and reports a 1-based line number that counts the header', () => {
    const l = lines()
    l[5] = '0101'
    try {
      decodeFont(l.join('\n'))
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(McmParseError)
      expect((error as McmParseError).line).toBe(6)
    }
  })
})

describe('decodeFont tolerates', () => {
  it('a trailing newline', () => {
    expect(() => decodeFont(`${good()}\n`)).not.toThrow()
  })

  it('CRLF line endings', () => {
    expect(() => decodeFont(good().replace(/\n/g, '\r\n'))).not.toThrow()
  })
})
