import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { composeText, validateStencils } from '../stencils'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const RAW = JSON.parse(readFileSync(resolve(REPO, 'assets/splash_stencils.json'), 'utf8'))
const STENCILS = validateStencils(RAW)

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -.!'/"

describe('assets/splash_stencils.json', () => {
  it('covers the whole character set in both fonts', () => {
    for (const font of [STENCILS.big, STENCILS.small]) {
      for (const char of CHARSET) expect(font.glyphs, char).toHaveProperty([char])
    }
  })

  it('is 14 and 9 rows tall', () => {
    expect(STENCILS.big.height).toBe(14)
    expect(STENCILS.small.height).toBe(9)
  })
})

describe('validateStencils', () => {
  it('rejects a ragged glyph and a wrong height', () => {
    const ragged = structuredClone(RAW)
    ragged.big.glyphs.A[3] = '###'
    expect(() => validateStencils(ragged)).toThrow('big "A" has a malformed row')
    const short = structuredClone(RAW)
    short.small.glyphs.T.pop()
    expect(() => validateStencils(short)).toThrow('small "T" is not 9 rows tall')
    expect(() => validateStencils({ big: RAW.big })).toThrow('no "small" font')
  })
})

describe('composeText', () => {
  it('joins glyphs with a 2 px gap and reports the width', () => {
    const { rows, width } = composeText(STENCILS.small, 'IT')
    expect(width).toBe(6 + 2 + 6)
    expect(rows).toHaveLength(9)
    expect(rows[0]).toBe('######..######')
  })

  it('uppercases, and names unsupported characters once each', () => {
    const { rows, width, unsupported } = composeText(STENCILS.big, 'a@b@~')
    expect(unsupported).toEqual(['@', '~'])
    expect(width).toBe(12 + 2 + 12)
    expect(rows[0]).toBe(STENCILS.big.glyphs.A[0] + '..' + STENCILS.big.glyphs.B[0])
  })

  it('handles variable-width glyphs', () => {
    const { width } = composeText(STENCILS.big, 'I1')
    expect(width).toBe(7 + 2 + 8)
  })

  it('returns empty rows and width 0 for nothing renderable', () => {
    const { rows, width } = composeText(STENCILS.big, '@@')
    expect(width).toBe(0)
    expect(rows).toEqual(new Array(14).fill(''))
  })
})
