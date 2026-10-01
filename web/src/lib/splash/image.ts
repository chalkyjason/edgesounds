import { RASTER_HEIGHT, RASTER_WIDTH, emptyRaster, maskToRaster, outlineMask } from './raster'
import type { Raster } from './raster'

export interface ImageOptions {
  /** 0..255; grey at or above it is ink. */
  threshold: number
  invert: boolean
  background: 'transparent' | 'black'
  outline: boolean
}

export const DEFAULT_IMAGE_OPTIONS: ImageOptions = {
  threshold: 128,
  invert: false,
  background: 'transparent',
  outline: false,
}

/** What the page converts. HEIC (an iPhone's default) is not among them, so say so. */
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

/** Null when the file can be used; otherwise the message to show. */
export function checkImageFile(file: Pick<File, 'name' | 'type'>): string | null {
  if ((ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return null
  return `${file.name} is not a PNG, JPEG, WebP or GIF`
}

export interface Placement {
  x: number
  y: number
  width: number
  height: number
}

/** Scale a w x h image to fit inside the raster, aspect kept, centred. */
export function fitInside(width: number, height: number): Placement {
  if (width <= 0 || height <= 0) throw new Error('image has no size')
  const scale = Math.min(RASTER_WIDTH / width, RASTER_HEIGHT / height)
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  return {
    x: Math.floor((RASTER_WIDTH - w) / 2),
    y: Math.floor((RASTER_HEIGHT - h) / 2),
    width: w,
    height: h,
  }
}

/**
 * Threshold an RGBA image already scaled to `placement` and drop it into a
 * raster. Alpha below 128 is transparent whatever the threshold; otherwise
 * grey at or above the threshold is white (inverted: below), and the rest is
 * the chosen background. The outline is computed over the whole raster.
 */
export function rasterizeImage(
  rgba: Uint8ClampedArray | Uint8Array,
  placement: Placement,
  options: ImageOptions,
): Raster {
  const { x: x0, y: y0, width, height } = placement
  if (rgba.length !== width * height * 4) {
    throw new Error(`expected ${width * height * 4} bytes of RGBA, got ${rgba.length}`)
  }
  const mask = new Array<boolean>(RASTER_WIDTH * RASTER_HEIGHT).fill(false)
  const plate = new Array<boolean>(RASTER_WIDTH * RASTER_HEIGHT).fill(false)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = x0 + x
      const py = y0 + y
      if (px < 0 || py < 0 || px >= RASTER_WIDTH || py >= RASTER_HEIGHT) continue
      const i = (y * width + x) * 4
      if (rgba[i + 3] < 128) continue
      const grey = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2])
      const ink = options.invert ? grey < options.threshold : grey >= options.threshold
      const offset = py * RASTER_WIDTH + px
      if (ink) mask[offset] = true
      else plate[offset] = true
    }
  }
  const raster = options.background === 'black' ? withPlate(mask, plate) : emptyRaster()
  const inked = maskToRaster(mask, options.outline)
  for (let i = 0; i < raster.length; i += 1) {
    if (inked[i] !== 'transparent') raster[i] = inked[i]
  }
  return raster
}

function withPlate(mask: boolean[], plate: boolean[]): Raster {
  const raster = emptyRaster()
  for (let i = 0; i < raster.length; i += 1) if (plate[i] && !mask[i]) raster[i] = 'black'
  return raster
}

export { outlineMask }
