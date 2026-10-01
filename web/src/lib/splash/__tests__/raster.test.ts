import { describe, expect, it } from 'vitest'
import {
  RASTER_HEIGHT,
  RASTER_SIZE,
  RASTER_WIDTH,
  applyPaint,
  brushOffsets,
  emptyRaster,
  isRasterEmpty,
  maskToRaster,
  outlineMask,
  rasterToGlyphs,
  rasterToRgba,
} from '../raster'

const at = (x: number, y: number) => y * RASTER_WIDTH + x

describe('outlineMask', () => {
  it('gives a lone white pixel eight black neighbours', () => {
    const mask = new Array<boolean>(RASTER_SIZE).fill(false)
    mask[at(10, 10)] = true
    const halo = outlineMask(mask)
    const black = halo.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
    expect(black.sort((a, b) => a - b)).toEqual(
      [at(9, 9), at(10, 9), at(11, 9), at(9, 10), at(11, 10), at(9, 11), at(10, 11), at(11, 11)].sort(
        (a, b) => a - b,
      ),
    )
  })

  it('never marks a white pixel as halo and stays inside the raster', () => {
    const mask = new Array<boolean>(RASTER_SIZE).fill(false)
    mask[at(0, 0)] = true
    mask[at(RASTER_WIDTH - 1, RASTER_HEIGHT - 1)] = true
    const halo = outlineMask(mask)
    expect(halo[at(0, 0)]).toBe(false)
    expect(halo.filter(Boolean)).toHaveLength(6)
  })
})

describe('maskToRaster', () => {
  it('maps white and halo, or white only', () => {
    const mask = new Array<boolean>(RASTER_SIZE).fill(false)
    mask[at(5, 5)] = true
    const outlined = maskToRaster(mask, true)
    expect(outlined[at(5, 5)]).toBe('white')
    expect(outlined[at(4, 5)]).toBe('black')
    const plain = maskToRaster(mask, false)
    expect(plain[at(4, 5)]).toBe('transparent')
  })
})

describe('applyPaint', () => {
  it('overrides pixels without mutating the base and ignores out-of-range offsets', () => {
    const base = emptyRaster()
    const out = applyPaint(base, { [at(1, 1)]: 'white', [-5]: 'black', [RASTER_SIZE]: 'black' })
    expect(out[at(1, 1)]).toBe('white')
    expect(base[at(1, 1)]).toBe('transparent')
    expect(out.filter((p) => p !== 'transparent')).toHaveLength(1)
  })
})

describe('brushOffsets', () => {
  it('covers 1, 4 and 9 pixels and clips at the edges', () => {
    expect(brushOffsets(10, 10, 1)).toEqual([at(10, 10)])
    expect(brushOffsets(10, 10, 2).sort((a, b) => a - b)).toEqual(
      [at(10, 10), at(11, 10), at(10, 11), at(11, 11)].sort((a, b) => a - b),
    )
    expect(brushOffsets(10, 10, 3)).toHaveLength(9)
    expect(brushOffsets(0, 0, 3)).toHaveLength(4)
    expect(brushOffsets(RASTER_WIDTH - 1, RASTER_HEIGHT - 1, 2)).toEqual([at(RASTER_WIDTH - 1, RASTER_HEIGHT - 1)])
  })
})

describe('rasterToRgba / rasterToGlyphs', () => {
  it('uses the upload palette and slices into 96 tiles', () => {
    const raster = emptyRaster()
    raster[at(0, 0)] = 'white'
    raster[at(1, 0)] = 'black'
    const rgba = rasterToRgba(raster)
    expect([...rgba.subarray(0, 12)]).toEqual([255, 255, 255, 255, 0, 0, 0, 255, 0, 255, 0, 255])
    const tiles = rasterToGlyphs(raster)
    expect(tiles).toHaveLength(96)
    expect(tiles[0].pixels[0]).toBe('white')
    expect(tiles[0].pixels[1]).toBe('black')
    expect(isRasterEmpty(raster)).toBe(false)
    expect(isRasterEmpty(emptyRaster())).toBe(true)
  })
})
