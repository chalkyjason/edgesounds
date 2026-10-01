import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodeFont } from '../../mcm/decode'
import { LOGO_START, RESERVED_INDEX, TILE_COUNT, isTileEmpty } from '../../mcm/logo'
import { rasterToGlyphs } from '../raster'
import { validateStencils } from '../stencils'
import { renderTemplate } from '../template'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const STENCILS = validateStencils(
  JSON.parse(readFileSync(resolve(REPO, 'assets/splash_stencils.json'), 'utf8')),
)
const FULL = decodeFont(readFileSync(resolve(REPO, 'fonts/armyjay_full.mcm'), 'latin1'))

describe('renderTemplate', () => {
  // The decisive test: the web compositor must reproduce the shipped splash
  // tile for tile. That pins the stencil port, the outline, the gaps, the
  // rules and the centring against an artifact CI keeps current.
  it('reproduces the Army Jay splash in fonts/armyjay_full.mcm exactly', () => {
    const { raster, big, small } = renderTemplate(STENCILS, {
      big: 'ARMY JAY',
      small: 'TACTICAL OSD',
      rules: true,
    })
    expect(big).toEqual({ width: 110, overflow: 0, unsupported: [], drawn: true })
    expect(small).toEqual({ width: 94, overflow: 0, unsupported: [], drawn: true })

    const tiles = rasterToGlyphs(raster)
    expect(tiles).toHaveLength(TILE_COUNT)
    for (let i = 0; i < TILE_COUNT; i += 1) {
      const index = LOGO_START + i
      if (index === RESERVED_INDEX) {
        expect(isTileEmpty(tiles[i])).toBe(true)
        continue
      }
      expect(tiles[i].pixels, `tile 0x${index.toString(16)}`).toEqual(FULL[index].pixels)
    }
  })

  it('reports a line that is too wide and leaves it undrawn', () => {
    const { raster, big } = renderTemplate(STENCILS, { big: 'W'.repeat(25), small: '', rules: false })
    expect(big.overflow).toBe(25 * 12 + 24 * 2 - 288)
    expect(big.drawn).toBe(false)
    expect(raster.every((p) => p === 'transparent')).toBe(true)
  })

  it('names unsupported characters and still draws the rest', () => {
    const { big, raster } = renderTemplate(STENCILS, { big: 'a@b#a', small: '', rules: false })
    expect(big.unsupported).toEqual(['@', '#'])
    expect(big.drawn).toBe(true)
    expect(raster.some((p) => p === 'white')).toBe(true)
  })

  it('draws nothing for an empty template', () => {
    const { raster, big, small } = renderTemplate(STENCILS, { big: '', small: '', rules: false })
    expect(raster.every((p) => p === 'transparent')).toBe(true)
    expect(big.drawn).toBe(false)
    expect(small.width).toBe(0)
  })
})
