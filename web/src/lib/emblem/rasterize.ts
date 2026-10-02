import { RASTER_HEIGHT, RASTER_SIZE, RASTER_WIDTH } from '../splash/raster'
import { toLocal, toRaster } from './transform'
import type { Bitmap, LayerBase, ShapeDef } from './types'

type Placement = Pick<LayerBase, 'x' | 'y' | 'size' | 'rotation' | 'flipX' | 'flipY'>

/** Raster pixels per bitmap pixel for a layer: text scales by letter height, the image by its larger side. */
export function bitmapScale(kind: 'text' | 'image', size: number, bitmap: Bitmap): number {
  const across = kind === 'text' ? bitmap.height : Math.max(bitmap.width, bitmap.height)
  return across > 0 ? size / across : 0
}

/** An empty 288 x 72 mask. */
export function emptyMask(): Uint8Array {
  return new Uint8Array(RASTER_SIZE)
}

/**
 * Fill a library shape into a mask: its unit-box polygons scaled to
 * `layer.size`, placed, then filled wherever a pixel's centre is inside.
 * Each path follows its own fill rule; the paths are OR-ed.
 */
export function rasterizeShape(shape: ShapeDef, layer: Placement): Uint8Array {
  const mask = emptyMask()
  for (const path of shape.paths) {
    const rings = path.rings.map((flat) => {
      const ring: [number, number][] = []
      for (let i = 0; i < flat.length; i += 2) ring.push(toRaster(layer, layer.size, flat[i], flat[i + 1]))
      return ring
    })
    fillRings(mask, rings, path.rule)
  }
  return mask
}

interface Crossing {
  x: number
  dir: number
}

/** Scanline fill sampling pixel centres: the pixel is in if (x + 0.5, y + 0.5) is. */
export function fillRings(mask: Uint8Array, rings: [number, number][][], rule: 'nonzero' | 'evenodd'): void {
  let minY = Infinity
  let maxY = -Infinity
  for (const ring of rings) {
    for (const [, y] of ring) {
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const rowStart = Math.max(0, Math.floor(minY - 0.5))
  const rowEnd = Math.min(RASTER_HEIGHT - 1, Math.ceil(maxY))
  for (let py = rowStart; py <= rowEnd; py += 1) {
    const yc = py + 0.5
    const crossings: Crossing[] = []
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 1) {
        const [ax, ay] = ring[i]
        const [bx, by] = ring[(i + 1) % ring.length]
        if (ay === by) continue
        // Half-open in y, so a vertex shared by two edges counts once.
        const low = Math.min(ay, by)
        const high = Math.max(ay, by)
        if (yc < low || yc >= high) continue
        crossings.push({ x: ax + ((yc - ay) * (bx - ax)) / (by - ay), dir: by > ay ? 1 : -1 })
      }
    }
    if (crossings.length < 2) continue
    crossings.sort((a, b) => a.x - b.x)
    let winding = 0
    for (let i = 0; i < crossings.length - 1; i += 1) {
      winding += crossings[i].dir
      const inside = rule === 'nonzero' ? winding !== 0 : (i + 1) % 2 === 1
      if (!inside) continue
      // Pixels whose centre lies in [left, right).
      const from = Math.max(0, Math.ceil(crossings[i].x - 0.5))
      const to = Math.min(RASTER_WIDTH, Math.ceil(crossings[i + 1].x - 0.5))
      for (let px = from; px < to; px += 1) mask[py * RASTER_WIDTH + px] = 1
    }
  }
}

/**
 * Sample a bitmap through the layer's transform at `k` raster pixels per
 * bitmap pixel: each raster pixel centre is mapped back into the bitmap. At
 * k = 1 and no rotation, the bitmap lands pixel for pixel.
 */
export function rasterizeBitmap(bitmap: Bitmap, layer: Placement, k: number): Uint8Array {
  const mask = emptyMask()
  const { width, height, bits } = bitmap
  if (width === 0 || height === 0 || !(k > 0)) return mask
  const corners = [
    toRaster(layer, k, -width / 2, -height / 2),
    toRaster(layer, k, width / 2, -height / 2),
    toRaster(layer, k, width / 2, height / 2),
    toRaster(layer, k, -width / 2, height / 2),
  ]
  const xs = corners.map((c) => c[0])
  const ys = corners.map((c) => c[1])
  const x0 = Math.max(0, Math.floor(Math.min(...xs)))
  const x1 = Math.min(RASTER_WIDTH - 1, Math.ceil(Math.max(...xs)))
  const y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const y1 = Math.min(RASTER_HEIGHT - 1, Math.ceil(Math.max(...ys)))
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const [lx, ly] = toLocal(layer, k, px + 0.5, py + 0.5)
      const bx = Math.floor(lx + width / 2)
      const by = Math.floor(ly + height / 2)
      if (bx < 0 || by < 0 || bx >= width || by >= height) continue
      if (bits[by * width + bx]) mask[py * RASTER_WIDTH + px] = 1
    }
  }
  return mask
}

/** Stencil rows ('#' = ink) as a bitmap. */
export function rowsToBitmap(rows: string[]): Bitmap {
  const height = rows.length
  const width = rows[0]?.length ?? 0
  const bits = new Uint8Array(width * height)
  rows.forEach((row, y) => {
    for (let x = 0; x < width; x += 1) if (row[x] === '#') bits[y * width + x] = 1
  })
  return { width, height, bits }
}

/**
 * An RGBA image as ink: alpha under 128 is never ink; otherwise grey at or
 * above the threshold is (inverted: below). The image layer's bitmap.
 */
export function thresholdImage(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  threshold: number,
  invert: boolean,
): Bitmap {
  const bits = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4
    if (rgba[o + 3] < 128) continue
    const grey = Math.round(0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2])
    if (invert ? grey < threshold : grey >= threshold) bits[i] = 1
  }
  return { width, height, bits }
}
