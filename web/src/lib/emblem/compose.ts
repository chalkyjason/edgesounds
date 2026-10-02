import { RASTER_HEIGHT, RASTER_SIZE, RASTER_WIDTH, emptyRaster } from '../splash/raster'
import type { Raster } from '../splash/raster'
import { composeText } from '../splash/stencils'
import type { Stencils } from '../splash/stencils'
import { bitmapScale, emptyMask, rasterizeBitmap, rasterizeShape, rowsToBitmap, thresholdImage } from './rasterize'
import { toLocal } from './transform'
import type { Bitmap, DecodedImage, Layer, ShapeDef } from './types'

/** What a layer's pixels depend on beyond the layer itself. */
export interface MaskSources {
  shapes: Map<string, ShapeDef> | null
  stencils: Stencils | null
  image: DecodedImage | null
}

export interface LayerPixels {
  mask: Uint8Array
  /** The 1 px ring around the mask; only computed for outlined layers. */
  halo: Uint8Array | null
  /** False when the layer names a shape the library does not have. */
  found: boolean
  /** True when the mask has at least one pixel on screen. */
  onScreen: boolean
}

/** A layer's source bitmap for text, or null when there is nothing to draw. */
export function textBitmap(stencils: Stencils, layer: Extract<Layer, { kind: 'text' }>): Bitmap | null {
  const composed = composeText(stencils[layer.font], layer.text)
  return composed.width > 0 ? rowsToBitmap(composed.rows) : null
}

/** The bitmap a text or image layer samples, or null when there is none yet. */
export function sourceBitmap(layer: Extract<Layer, { kind: 'text' | 'image' }>, sources: MaskSources): Bitmap | null {
  if (layer.kind === 'text') return sources.stencils ? textBitmap(sources.stencils, layer) : null
  const image = sources.image
  return image ? thresholdImage(image.rgba, image.width, image.height, layer.threshold, layer.invert) : null
}

export function layerPixels(layer: Layer, sources: MaskSources): LayerPixels {
  let mask: Uint8Array | null = null
  let found = true
  if (layer.kind === 'shape') {
    const shape = sources.shapes?.get(layer.shape)
    if (shape) mask = rasterizeShape(shape, layer)
    else found = sources.shapes === null // still loading is not "missing"
  } else {
    const bitmap = sourceBitmap(layer, sources)
    if (bitmap) mask = rasterizeBitmap(bitmap, layer, bitmapScale(layer.kind, layer.size, bitmap))
  }
  mask ??= emptyMask()
  return {
    mask,
    halo: layer.outline ? haloOf(mask) : null,
    found,
    onScreen: mask.some((v) => v === 1),
  }
}

/** Pixels outside the mask that touch it, the 8 neighbours (as outlineMask). */
export function haloOf(mask: Uint8Array): Uint8Array {
  const halo = new Uint8Array(RASTER_SIZE)
  for (let y = 0; y < RASTER_HEIGHT; y += 1) {
    for (let x = 0; x < RASTER_WIDTH; x += 1) {
      if (!mask[y * RASTER_WIDTH + x]) continue
      for (let dy = -1; dy <= 1; dy += 1) {
        const ny = y + dy
        if (ny < 0 || ny >= RASTER_HEIGHT) continue
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx
          if (nx < 0 || nx >= RASTER_WIDTH) continue
          const n = ny * RASTER_WIDTH + nx
          if (!mask[n]) halo[n] = 1
        }
      }
    }
  }
  return halo
}

/**
 * Remembers each layer's pixels until the layer object or what it draws
 * from changes. Layers are immutable values, so identity is the key.
 */
export function createPixelCache() {
  const cache = new WeakMap<Layer, { sources: unknown; pixels: LayerPixels }>()
  return (layer: Layer, sources: MaskSources): LayerPixels => {
    const dependency =
      layer.kind === 'shape' ? sources.shapes : layer.kind === 'text' ? sources.stencils : sources.image
    const hit = cache.get(layer)
    if (hit && hit.sources === dependency) return hit.pixels
    const pixels = layerPixels(layer, sources)
    cache.set(layer, { sources: dependency, pixels })
    return pixels
  }
}

/**
 * The layer stack, bottom first, onto a clear raster: a normal layer draws
 * its outline in the opposite colour, then its fill; a cut-out clears.
 */
export function composeLayers(layers: Layer[], pixelsOf: (layer: Layer) => LayerPixels): Raster {
  const raster = emptyRaster()
  for (const layer of layers) {
    if (!layer.visible) continue
    const { mask, halo } = pixelsOf(layer)
    if (layer.mode === 'cutout') {
      for (let i = 0; i < RASTER_SIZE; i += 1) if (mask[i]) raster[i] = 'transparent'
      continue
    }
    if (halo) {
      const edge = layer.fill === 'white' ? 'black' : 'white'
      for (let i = 0; i < RASTER_SIZE; i += 1) if (halo[i]) raster[i] = edge
    }
    for (let i = 0; i < RASTER_SIZE; i += 1) if (mask[i]) raster[i] = layer.fill
  }
  return raster
}

/** A layer's box on screen before rotation, in raster pixels; null when it has nothing to draw. */
export function layerExtent(layer: Layer, sources: MaskSources): { width: number; height: number } | null {
  if (layer.kind === 'shape') {
    const shape = sources.shapes?.get(layer.shape)
    return shape ? { width: shape.w * layer.size, height: shape.h * layer.size } : null
  }
  const bitmap = sourceBitmap(layer, sources)
  if (!bitmap) return null
  const k = bitmapScale(layer.kind, layer.size, bitmap)
  return { width: bitmap.width * k, height: bitmap.height * k }
}

/**
 * The topmost visible layer whose box contains (px, py), with a little
 * slack so thin shapes are easy to tap; null when none does.
 */
export function hitTest(
  layers: Layer[],
  px: number,
  py: number,
  extentOf: (layer: Layer) => { width: number; height: number } | null,
  slack = 2,
): Layer | null {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i]
    if (!layer.visible) continue
    const extent = extentOf(layer)
    if (!extent) continue
    const [lx, ly] = toLocal({ ...layer, flipX: false, flipY: false }, 1, px, py)
    if (Math.abs(lx) <= extent.width / 2 + slack && Math.abs(ly) <= extent.height / 2 + slack) return layer
  }
  return null
}
