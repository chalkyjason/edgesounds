import type { ImageOptions, Placement } from '../splash/image'
import { RASTER_HEIGHT, RASTER_WIDTH } from '../splash/raster'
import type { PaintLayer } from '../splash/raster'
import { composeText } from '../splash/stencils'
import type { Stencils } from '../splash/stencils'
import { BIG_ROW, SMALL_ROW } from '../splash/template'
import type { TemplateInput } from '../splash/template'
import type { Layer, LayerBase } from './types'

/** The start screen as a stack of layers with paint on top. */
export interface EmblemDesign {
  version: 2
  /** Bottom first. */
  layers: Layer[]
  /** The one image every image layer draws from. */
  image: { source: Blob | null; sourceName: string | null }
  paint: PaintLayer
}

export const EMPTY_DESIGN: EmblemDesign = {
  version: 2,
  layers: [],
  image: { source: null, sourceName: null },
  paint: {},
}

/** The start screen maker's first design format, before layers. */
export interface V1Design {
  generator: 'text' | 'image'
  text: TemplateInput
  image: ImageOptions & { source: Blob | null; sourceName: string | null }
  paint: PaintLayer
}

export const CENTRE = { x: RASTER_WIDTH / 2, y: RASTER_HEIGHT / 2 }
/** Letter heights of the two stencil fonts, their native sizes. */
export const FONT_SIZE = { big: 14, small: 9 } as const

let counter = 0
export function newLayerId(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter}`
}

const BASE: Omit<LayerBase, 'id'> = {
  x: CENTRE.x,
  y: CENTRE.y,
  size: 48,
  rotation: 0,
  flipX: false,
  flipY: false,
  fill: 'white',
  outline: true,
  mode: 'normal',
  visible: true,
}

export function shapeLayer(shape: string, over: Partial<LayerBase> = {}): Layer {
  return { ...BASE, ...over, id: newLayerId(), kind: 'shape', shape }
}

export function textLayer(text: string, font: 'big' | 'small', over: Partial<LayerBase> = {}): Layer {
  return { ...BASE, size: FONT_SIZE[font], ...over, id: newLayerId(), kind: 'text', text, font }
}

export function imageLayer(over: Partial<LayerBase> & { threshold?: number; invert?: boolean } = {}): Layer {
  const { threshold = 128, invert = false, ...rest } = over
  return { ...BASE, size: RASTER_HEIGHT, outline: false, ...rest, id: newLayerId(), kind: 'image', threshold, invert }
}

/** Where fitInside put the image: the layer centre and size that land it there pixel for pixel. */
export function placementToLayer(placement: Placement): Pick<LayerBase, 'x' | 'y' | 'size'> {
  return {
    x: placement.x + placement.width / 2,
    y: placement.y + placement.height / 2,
    size: Math.max(placement.width, placement.height),
  }
}

/**
 * A version-1 design as layers, pixel for pixel. The text template's lines
 * become text layers where renderTemplate centres them, and its rules the
 * two rule shapes; an image becomes an image layer at its fitted placement,
 * over a black copy of itself when it had a black background.
 *
 * `placement` is the image's fitted placement, needed only for an image
 * design with a source.
 */
export function migrateV1(old: V1Design, stencils: Stencils, placement: Placement | null): EmblemDesign {
  const layers: Layer[] = []
  if (old.generator === 'text') {
    const { big, small, rules } = old.text
    if (rules) {
      layers.push(shapeLayer('basics/rule-chevrons', { x: 144, y: 9.5, size: 272 }))
      layers.push(shapeLayer('basics/rule', { x: 144, y: 63.5, size: 240 }))
    }
    for (const [text, font, row] of [
      [big, 'big', BIG_ROW],
      [small, 'small', SMALL_ROW],
    ] as const) {
      const composed = composeText(stencils[font], text)
      if (composed.width === 0 || composed.width > RASTER_WIDTH) continue
      const height = composed.rows.length
      const x0 = Math.floor((RASTER_WIDTH - composed.width) / 2)
      const y0 = row * 18 + Math.floor((18 - height) / 2)
      layers.push(textLayer(text, font, { x: x0 + composed.width / 2, y: y0 + height / 2, size: height }))
    }
  } else if (old.image.source && placement) {
    const at = placementToLayer(placement)
    const { threshold, invert } = old.image
    if (old.image.background === 'black') {
      // Every opaque pixel, black, under the image: v1's background plate.
      layers.push(imageLayer({ ...at, threshold: 0, invert: false, fill: 'black' }))
    }
    layers.push(imageLayer({ ...at, threshold, invert, outline: old.image.outline }))
  }
  return {
    version: 2,
    layers,
    image: { source: old.image.source, sourceName: old.image.sourceName },
    paint: old.paint,
  }
}

/** True for a saved record in the first format. */
export function isV1(record: unknown): record is V1Design {
  return !!record && typeof record === 'object' && !('version' in record) && 'generator' in record
}
