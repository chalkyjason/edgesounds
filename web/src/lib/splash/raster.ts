import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../mcm/decode'
import { LOGO_HEIGHT, LOGO_WIDTH, TILES_HORIZ, TILES_VERT, UPLOAD_PALETTE } from '../mcm/logo'
import type { Glyph, Pixel } from '../mcm/types'

/** The 288 x 72 start screen, row-major, one Pixel per cell. */
export type Raster = Pixel[]

export const RASTER_WIDTH = LOGO_WIDTH
export const RASTER_HEIGHT = LOGO_HEIGHT
export const RASTER_SIZE = RASTER_WIDTH * RASTER_HEIGHT

/** Sparse pixel overrides: raster offset (y * 288 + x) -> value. */
export type PaintLayer = Record<number, Pixel>

export function emptyRaster(): Raster {
  return new Array<Pixel>(RASTER_SIZE).fill('transparent')
}

/** A white-only mask (true = white) to a raster, with or without the black halo. */
export function maskToRaster(mask: boolean[], outline: boolean): Raster {
  const raster = emptyRaster()
  const halo = outline ? outlineMask(mask) : null
  for (let i = 0; i < RASTER_SIZE; i += 1) {
    if (mask[i]) raster[i] = 'white'
    else if (halo && halo[i]) raster[i] = 'black'
  }
  return raster
}

/**
 * 1 px black halo around the white mask, over the whole raster rather than
 * per tile, so outlines stay continuous across tile seams. A port of
 * tools/make_logo.py's outline_mask.
 */
export function outlineMask(mask: boolean[]): boolean[] {
  const halo = new Array<boolean>(RASTER_SIZE).fill(false)
  for (let y = 0; y < RASTER_HEIGHT; y += 1) {
    for (let x = 0; x < RASTER_WIDTH; x += 1) {
      const i = y * RASTER_WIDTH + x
      if (mask[i]) continue
      halo[i] = neighbours(mask, x, y)
    }
  }
  return halo
}

function neighbours(mask: boolean[], x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= RASTER_WIDTH || ny >= RASTER_HEIGHT) continue
      if (mask[ny * RASTER_WIDTH + nx]) return true
    }
  }
  return false
}

/** The base raster with the paint layer laid over it. Neither input is mutated. */
export function applyPaint(base: Raster, paint: PaintLayer): Raster {
  const out = base.slice()
  for (const key of Object.keys(paint)) {
    const offset = Number(key)
    if (offset >= 0 && offset < RASTER_SIZE) out[offset] = paint[offset]
  }
  return out
}

/** RGBA in Configurator's upload palette: black, white, pure green for transparent. */
export function rasterToRgba(raster: Raster): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(RASTER_SIZE * 4)
  for (let i = 0; i < RASTER_SIZE; i += 1) {
    const [r, g, b] = UPLOAD_PALETTE[raster[i]]
    rgba[i * 4] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

/**
 * The raster as the 96 splash tiles, row-major from 0xA0. Sliced directly:
 * the raster is already Pixels, and going through RGBA and back costs more
 * than everything else on the page put together.
 */
export function rasterToGlyphs(raster: Raster): Glyph[] {
  if (raster.length !== RASTER_SIZE) throw new Error(`raster has ${raster.length} pixels, expected ${RASTER_SIZE}`)
  const tiles: Glyph[] = []
  for (let row = 0; row < TILES_VERT; row += 1) {
    for (let col = 0; col < TILES_HORIZ; col += 1) {
      const pixels: Pixel[] = new Array<Pixel>(GLYPH_WIDTH * GLYPH_HEIGHT)
      for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
        const start = (row * GLYPH_HEIGHT + y) * RASTER_WIDTH + col * GLYPH_WIDTH
        for (let x = 0; x < GLYPH_WIDTH; x += 1) pixels[y * GLYPH_WIDTH + x] = raster[start + x]
      }
      tiles.push({ pixels })
    }
  }
  return tiles
}

export function isRasterEmpty(raster: Raster): boolean {
  return raster.every((pixel) => pixel === 'transparent')
}

/** Offsets a brush of `size` px covers when centred as near as possible on (x, y). */
export function brushOffsets(x: number, y: number, size: 1 | 2 | 3): number[] {
  const start = size === 3 ? -1 : 0
  const end = size === 1 ? 0 : 1
  const offsets: number[] = []
  for (let dy = start; dy <= end; dy += 1) {
    for (let dx = start; dx <= end; dx += 1) {
      const px = x + dx
      const py = y + dy
      if (px < 0 || py < 0 || px >= RASTER_WIDTH || py >= RASTER_HEIGHT) continue
      offsets.push(py * RASTER_WIDTH + px)
    }
  }
  return offsets
}

export { GLYPH_HEIGHT, GLYPH_WIDTH }
