import { describe, expect, it } from 'vitest'
import { DEFAULT_IMAGE_OPTIONS, fitInside, rasterizeImage } from '../image'
import { RASTER_WIDTH } from '../raster'

const at = (x: number, y: number) => y * RASTER_WIDTH + x

/** A 2 x 2 RGBA image: white, black / grey 200, transparent. */
const PIXELS = new Uint8ClampedArray([
  255, 255, 255, 255, 0, 0, 0, 255,
  200, 200, 200, 255, 90, 90, 90, 0,
])
const PLACE = { x: 10, y: 20, width: 2, height: 2 }

describe('fitInside', () => {
  it('fits a wide image to the width and centres it vertically', () => {
    expect(fitInside(576, 72)).toEqual({ x: 0, y: 18, width: 288, height: 36 })
  })
  it('fits a tall image to the height and centres it horizontally', () => {
    expect(fitInside(100, 100)).toEqual({ x: 108, y: 0, width: 72, height: 72 })
  })
  it('rejects an empty image', () => {
    expect(() => fitInside(0, 10)).toThrow('no size')
  })
})

describe('rasterizeImage', () => {
  it('thresholds grey to white, leaves the rest transparent, honours alpha', () => {
    const raster = rasterizeImage(PIXELS, PLACE, DEFAULT_IMAGE_OPTIONS)
    expect(raster[at(10, 20)]).toBe('white')
    expect(raster[at(11, 20)]).toBe('transparent')
    expect(raster[at(10, 21)]).toBe('white')
    expect(raster[at(11, 21)]).toBe('transparent')
    expect(raster.filter((p) => p !== 'transparent')).toHaveLength(2)
  })

  it('moves the threshold', () => {
    const raster = rasterizeImage(PIXELS, PLACE, { ...DEFAULT_IMAGE_OPTIONS, threshold: 220 })
    expect(raster[at(10, 20)]).toBe('white')
    expect(raster[at(10, 21)]).toBe('transparent')
  })

  it('inverts', () => {
    const raster = rasterizeImage(PIXELS, PLACE, { ...DEFAULT_IMAGE_OPTIONS, invert: true })
    expect(raster[at(10, 20)]).toBe('transparent')
    expect(raster[at(11, 20)]).toBe('white')
    expect(raster[at(11, 21)]).toBe('transparent') // alpha still wins
  })

  it('puts a black plate behind non-ink pixels when asked', () => {
    const raster = rasterizeImage(PIXELS, PLACE, { ...DEFAULT_IMAGE_OPTIONS, background: 'black' })
    expect(raster[at(11, 20)]).toBe('black')
    expect(raster[at(11, 21)]).toBe('transparent') // transparent source stays transparent
    expect(raster[at(9, 20)]).toBe('transparent') // outside the placement
  })

  it('adds the outline when asked', () => {
    const raster = rasterizeImage(PIXELS, PLACE, { ...DEFAULT_IMAGE_OPTIONS, outline: true })
    expect(raster[at(9, 19)]).toBe('black')
    expect(raster[at(11, 20)]).toBe('black') // halo fills in beside the ink
  })

  it('rejects mismatched data', () => {
    expect(() => rasterizeImage(PIXELS, { ...PLACE, width: 3 }, DEFAULT_IMAGE_OPTIONS)).toThrow('expected 24 bytes')
  })
})
