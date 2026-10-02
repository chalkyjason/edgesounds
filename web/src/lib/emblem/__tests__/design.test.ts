import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildLibrary } from '../../../../scripts/build-shapes.mjs'
import { rasterizeImage } from '../../splash/image'
import { validateStencils } from '../../splash/stencils'
import { renderTemplate } from '../../splash/template'
import { composeLayers, createPixelCache } from '../compose'
import type { MaskSources } from '../compose'
import { EMPTY_DESIGN, isV1, migrateV1 } from '../design'
import type { V1Design } from '../design'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const STENCILS = validateStencils(JSON.parse(readFileSync(resolve(REPO, 'assets/splash_stencils.json'), 'utf8')))
const LIBRARY = buildLibrary(resolve(REPO, 'assets/shapes'))
const SHAPES = new Map(LIBRARY.shapes.map((s) => [s.id, s]))

const v1 = (over: Partial<V1Design>): V1Design => ({
  generator: 'text',
  text: { big: '', small: '', rules: true },
  image: { source: null, sourceName: null, threshold: 128, invert: false, background: 'transparent', outline: false },
  paint: {},
  ...over,
})

const render = (layers: ReturnType<typeof migrateV1>['layers'], image: MaskSources['image'] = null) => {
  const pixels = createPixelCache()
  const sources: MaskSources = { shapes: SHAPES, stencils: STENCILS, image }
  return composeLayers(layers, (l) => pixels(l, sources))
}

describe('migrateV1: text template', () => {
  for (const text of [
    { big: 'ARMY JAY', small: 'TACTICAL OSD', rules: true },
    { big: 'MAVERICK', small: '', rules: false },
    { big: '', small: 'FPV 5 INCH', rules: true },
    { big: 'A', small: 'B', rules: true },
  ]) {
    it(`renders ${JSON.stringify(text)} pixel for pixel as the template did`, () => {
      const design = migrateV1(v1({ text }), STENCILS, null)
      expect(render(design.layers)).toEqual(renderTemplate(STENCILS, text).raster)
    })
  }

  it('carries the paint over', () => {
    expect(migrateV1(v1({ paint: { 5: 'black' } }), STENCILS, null).paint).toEqual({ 5: 'black' })
  })
})

describe('migrateV1: image', () => {
  // A 4 x 2 image: white, light grey, dark grey, black / two transparent, white, black.
  const rgba = Uint8ClampedArray.from([
    255, 255, 255, 255, 200, 200, 200, 255, 60, 60, 60, 255, 0, 0, 0, 255,
    0, 0, 0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0, 255,
  ])
  // Pretend fitInside already scaled it: a 4 x 2 placement in the middle.
  const placement = { x: 142, y: 35, width: 4, height: 2 }
  const image = { rgba, width: 4, height: 2 }
  const source = new Blob(['x'])

  for (const options of [
    { threshold: 128, invert: false, background: 'transparent' as const, outline: false },
    { threshold: 100, invert: true, background: 'transparent' as const, outline: true },
    { threshold: 128, invert: false, background: 'black' as const, outline: true },
  ]) {
    it(`renders ${JSON.stringify(options)} pixel for pixel as before`, () => {
      const design = migrateV1(
        v1({ generator: 'image', image: { ...options, source, sourceName: 'x.png' } }),
        STENCILS,
        placement,
      )
      expect(render(design.layers, image)).toEqual(rasterizeImage(rgba, placement, options))
      expect(design.image).toEqual({ source, sourceName: 'x.png' })
    })
  }

  it('has no layers for an image design with no image', () => {
    expect(migrateV1(v1({ generator: 'image' }), STENCILS, null).layers).toEqual([])
  })
})

describe('isV1', () => {
  it('tells the formats apart', () => {
    expect(isV1(v1({}))).toBe(true)
    expect(isV1(EMPTY_DESIGN)).toBe(false)
    expect(isV1(null)).toBe(false)
  })
})
