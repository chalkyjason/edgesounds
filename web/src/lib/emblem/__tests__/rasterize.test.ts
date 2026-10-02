import { describe, expect, it } from 'vitest'
import { RASTER_WIDTH } from '../../splash/raster'
import { composeLayers, createPixelCache, haloOf, hitTest, layerPixels } from '../compose'
import type { MaskSources } from '../compose'
import { rasterizeBitmap, rasterizeShape, rowsToBitmap, thresholdImage } from '../rasterize'
import { toLocal, toRaster } from '../transform'
import type { Layer, ShapeDef } from '../types'

const at = (x: number, y: number) => y * RASTER_WIDTH + x
const count = (mask: Uint8Array) => mask.reduce((n, v) => n + v, 0)

/** A unit square, as build-shapes emits it. */
const SQUARE: ShapeDef = {
  id: 'basics/square',
  name: 'Square',
  pack: 'basics',
  w: 1,
  h: 1,
  paths: [{ rule: 'nonzero', rings: [[-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]] }],
}

/** A ring: an outer and inner square in one path. */
const ring = (rule: 'nonzero' | 'evenodd', innerReversed: boolean): ShapeDef => ({
  ...SQUARE,
  id: 'test/ring',
  paths: [
    {
      rule,
      rings: [
        [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5],
        innerReversed
          ? [-0.25, -0.25, -0.25, 0.25, 0.25, 0.25, 0.25, -0.25]
          : [-0.25, -0.25, 0.25, -0.25, 0.25, 0.25, -0.25, 0.25],
      ],
    },
  ],
})

const place = (over: Partial<Layer> = {}) =>
  ({ x: 50, y: 30, size: 10, rotation: 0, flipX: false, flipY: false, ...over }) as const

describe('transform', () => {
  it('round-trips through any rotation, flip and scale', () => {
    const layer = { x: 100, y: 20, rotation: 33, flipX: true, flipY: false }
    const [px, py] = toRaster(layer, 2.5, 3, -4)
    const [lx, ly] = toLocal(layer, 2.5, px, py)
    expect(lx).toBeCloseTo(3, 10)
    expect(ly).toBeCloseTo(-4, 10)
  })

  it('rotates clockwise on screen (y down)', () => {
    const [x, y] = toRaster({ x: 0, y: 0, rotation: 90, flipX: false, flipY: false }, 1, 1, 0)
    expect([x, y]).toEqual([0, 1])
  })
})

describe('rasterizeShape', () => {
  it('fills exactly the pixels whose centres are inside', () => {
    // A 10 px square centred on (50, 30) covers x 45..54, y 25..34.
    const mask = rasterizeShape(SQUARE, place())
    expect(count(mask)).toBe(100)
    expect(mask[at(45, 25)]).toBe(1)
    expect(mask[at(54, 34)]).toBe(1)
    expect(mask[at(44, 25)]).toBe(0)
    expect(mask[at(55, 34)]).toBe(0)
  })

  it('turns a square on its corner at 45 degrees', () => {
    const mask = rasterizeShape(SQUARE, place({ size: 20, rotation: 45 }))
    // The corners now point up, down, left and right of the centre.
    expect(mask[at(50, 30 - 13)]).toBe(1)
    expect(mask[at(50 - 9, 30 - 9)]).toBe(0)
    // Area is preserved to within the edge pixels.
    expect(Math.abs(count(mask) - 400)).toBeLessThan(40)
  })

  it('flips', () => {
    const wedge: ShapeDef = { ...SQUARE, paths: [{ rule: 'nonzero', rings: [[-0.5, -0.5, 0.5, 0.5, -0.5, 0.5]] }] }
    const plain = rasterizeShape(wedge, place())
    const flipped = rasterizeShape(wedge, place({ flipX: true }))
    // Mid-height the triangle covers the left half; flipped, the right.
    expect([plain[at(45, 30)], plain[at(54, 30)]]).toEqual([1, 0])
    expect([flipped[at(45, 30)], flipped[at(54, 30)]]).toEqual([0, 1])
  })

  it('cuts the hole with even-odd whichever way the inner ring runs', () => {
    for (const reversed of [false, true]) {
      const mask = rasterizeShape(ring('evenodd', reversed), place({ size: 20 }))
      expect(mask[at(50, 30)]).toBe(0)
      expect(mask[at(42, 30)]).toBe(1)
    }
  })

  it('cuts the hole with nonzero only when the inner ring runs the other way', () => {
    expect(rasterizeShape(ring('nonzero', true), place({ size: 20 }))[at(50, 30)]).toBe(0)
    expect(rasterizeShape(ring('nonzero', false), place({ size: 20 }))[at(50, 30)]).toBe(1)
  })

  it('clips to the raster and draws nothing for a sub-pixel shape between centres', () => {
    expect(count(rasterizeShape(SQUARE, place({ x: 0, y: 0, size: 10 })))).toBe(25)
    expect(count(rasterizeShape(SQUARE, place({ x: 50, y: 30, size: 0.4 })))).toBe(0)
  })
})

describe('rasterizeBitmap', () => {
  const bitmap = rowsToBitmap(['#..', '.#.', '..#', '###'])

  it('lands pixel for pixel at its native size', () => {
    const mask = rasterizeBitmap(bitmap, place({ x: 11.5, y: 22 }), 1)
    // 3 x 4 bitmap centred on (11.5, 22): top-left pixel at (10, 20).
    expect(mask[at(10, 20)]).toBe(1)
    expect(mask[at(11, 21)]).toBe(1)
    expect(mask[at(12, 22)]).toBe(1)
    expect([mask[at(10, 23)], mask[at(11, 23)], mask[at(12, 23)]]).toEqual([1, 1, 1])
    expect(count(mask)).toBe(6)
  })

  it('doubles every pixel at twice the size', () => {
    expect(count(rasterizeBitmap(bitmap, place({ x: 50, y: 30 }), 2))).toBe(24)
  })

  it('turns a quarter with no lost pixels', () => {
    expect(count(rasterizeBitmap(bitmap, place({ x: 50, y: 30, rotation: 90 }), 1))).toBe(6)
  })
})

describe('thresholdImage', () => {
  it('inks light pixels, or dark ones inverted, and never transparent ones', () => {
    const rgba = Uint8Array.from([255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 0])
    expect(Array.from(thresholdImage(rgba, 3, 1, 128, false).bits)).toEqual([1, 0, 0])
    expect(Array.from(thresholdImage(rgba, 3, 1, 128, true).bits)).toEqual([0, 1, 0])
  })
})

describe('composeLayers', () => {
  const sources: MaskSources = { shapes: new Map([[SQUARE.id, SQUARE]]), stencils: null, image: null }
  const layer = (over: Partial<Layer>): Layer =>
    ({
      id: Math.random().toString(),
      kind: 'shape',
      shape: SQUARE.id,
      x: 50,
      y: 30,
      size: 10,
      rotation: 0,
      flipX: false,
      flipY: false,
      fill: 'white',
      outline: false,
      mode: 'normal',
      visible: true,
      ...over,
    }) as Layer
  const pixels = createPixelCache()
  const compose = (layers: Layer[]) => composeLayers(layers, (l) => pixels(l, sources))

  it('draws later layers over earlier ones', () => {
    const raster = compose([layer({ size: 20 }), layer({ fill: 'black' })])
    expect(raster[at(50, 30)]).toBe('black')
    expect(raster[at(42, 30)]).toBe('white')
  })

  it('outlines in the opposite colour, outside the fill', () => {
    const raster = compose([layer({ outline: true })])
    expect(raster[at(44, 30)]).toBe('black')
    expect(raster[at(45, 30)]).toBe('white')
    expect(raster[at(43, 30)]).toBe('transparent')
    const black = compose([layer({ outline: true, fill: 'black' })])
    expect(black[at(44, 30)]).toBe('white')
  })

  it('cuts through everything below', () => {
    const raster = compose([layer({ size: 30 }), layer({ size: 20, fill: 'black' }), layer({ mode: 'cutout' })])
    expect(raster[at(50, 30)]).toBe('transparent')
    expect(raster[at(42, 30)]).toBe('black')
    expect(raster[at(37, 30)]).toBe('white')
  })

  it('skips hidden layers', () => {
    expect(compose([layer({ visible: false })])[at(50, 30)]).toBe('transparent')
  })

  it('reports a shape the library does not have, without drawing it', () => {
    const missing = layer({ shape: 'gone/away' } as Partial<Layer>)
    const result = layerPixels(missing, sources)
    expect(result.found).toBe(false)
    expect(result.onScreen).toBe(false)
  })

  it('reports a layer moved off screen', () => {
    expect(layerPixels(layer({ x: -100 }), sources).onScreen).toBe(false)
  })

  it('reuses a layer’s pixels until the layer changes', () => {
    const one = layer({})
    expect(pixels(one, sources)).toBe(pixels(one, sources))
    expect(pixels({ ...one }, sources)).not.toBe(pixels(one, sources))
  })
})

describe('haloOf', () => {
  it('rings a single pixel with its eight neighbours', () => {
    const mask = new Uint8Array(RASTER_WIDTH * 72)
    mask[at(10, 10)] = 1
    expect(haloOf(mask).reduce((n, v) => n + v, 0)).toBe(8)
  })
})

describe('hitTest', () => {
  const extent = (l: Layer) => ({ width: l.size, height: l.size })
  const a = { id: 'a', x: 50, y: 30, size: 10, rotation: 0, visible: true } as Layer
  const b = { id: 'b', x: 55, y: 30, size: 10, rotation: 0, visible: true } as Layer

  it('picks the topmost layer under the point', () => {
    expect(hitTest([a, b], 53, 30, extent)?.id).toBe('b')
    expect(hitTest([a, b], 46, 30, extent)?.id).toBe('a')
    expect(hitTest([a, b], 120, 30, extent)).toBeNull()
  })

  it('ignores hidden layers', () => {
    expect(hitTest([a, { ...b, visible: false }], 53, 30, extent)?.id).toBe('a')
  })
})
