import { GLYPH_HEIGHT, GLYPH_WIDTH } from './decode'
import type { Glyph, Pixel } from './types'

/**
 * Boot splash geometry, from tools/slice_logo.py and Betaflight's
 * SYM_LOGO_START block.
 */
export const LOGO_START = 0xa0
export const TILES_HORIZ = 24
export const TILES_VERT = 4
export const TILE_COUNT = TILES_HORIZ * TILES_VERT // 96, 0xA0..0xFF
/** 0xFF is also SYM_END_OF_FONT, so the bottom-right tile must stay empty. */
export const RESERVED_INDEX = 0xff
export const LOGO_WIDTH = GLYPH_WIDTH * TILES_HORIZ // 288
export const LOGO_HEIGHT = GLYPH_HEIGHT * TILES_VERT // 72

/**
 * The exact colours Betaflight Configurator's boot-logo uploader defines.
 * Transparent is pure green, not magenta — verified against
 * LogoManager.constants.MCM_COLORMAP.
 */
export const UPLOAD_PALETTE: Record<Pixel, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  transparent: [0, 255, 0],
}

export class LogoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LogoError'
  }
}

/** Squared distance in RGB — enough to pick a nearest palette entry. */
function distance(r: number, g: number, b: number, to: [number, number, number]): number {
  const dr = r - to[0]
  const dg = g - to[1]
  const db = b - to[2]
  return dr * dr + dg * dg + db * db
}

/**
 * Map one RGB triple to a pixel.
 *
 * `strict` refuses anything that is not exactly one of the three palette
 * colours, matching slice_logo.py: a stray anti-aliased pixel otherwise
 * becomes a wrong pixel in a glyph, and on a 12x18 tile that is visible.
 * Non-strict snaps to the nearest palette entry, which is only offered in the
 * UI alongside a preview so the result is seen before it is applied.
 */
export function classifyPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  strict: boolean,
): Pixel {
  if (a < 128) return 'transparent'
  for (const [pixel, rgb] of Object.entries(UPLOAD_PALETTE) as [Pixel, [number, number, number]][]) {
    if (r === rgb[0] && g === rgb[1] && b === rgb[2]) return pixel
  }
  if (strict) {
    throw new LogoError(
      `pixel rgb(${r}, ${g}, ${b}) is not one of the three allowed colours ` +
        '(black, white, or pure green for transparent)',
    )
  }
  let best: Pixel = 'transparent'
  let bestDistance = Infinity
  for (const [pixel, rgb] of Object.entries(UPLOAD_PALETTE) as [Pixel, [number, number, number]][]) {
    const d = distance(r, g, b, rgb)
    if (d < bestDistance) {
      bestDistance = d
      best = pixel
    }
  }
  return best
}

/**
 * Slice a 288x72 RGBA raster into the 96 splash tiles, row-major from 0xA0.
 *
 * @param rgba  width * height * 4 bytes.
 * @throws {LogoError} on a wrong size, or in strict mode on an off-palette pixel.
 */
export function rasterToTiles(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  { strict = true }: { strict?: boolean } = {},
): Glyph[] {
  if (width !== LOGO_WIDTH || height !== LOGO_HEIGHT) {
    throw new LogoError(`expected a ${LOGO_WIDTH}x${LOGO_HEIGHT} image, got ${width}x${height}`)
  }
  if (rgba.length !== width * height * 4) {
    throw new LogoError(`expected ${width * height * 4} bytes of RGBA, got ${rgba.length}`)
  }

  const tiles: Glyph[] = []
  for (let row = 0; row < TILES_VERT; row += 1) {
    for (let col = 0; col < TILES_HORIZ; col += 1) {
      const pixels: Pixel[] = []
      for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
        for (let x = 0; x < GLYPH_WIDTH; x += 1) {
          const px = col * GLYPH_WIDTH + x
          const py = row * GLYPH_HEIGHT + y
          const offset = (py * width + px) * 4
          pixels.push(
            classifyPixel(rgba[offset], rgba[offset + 1], rgba[offset + 2], rgba[offset + 3], strict),
          )
        }
      }
      tiles.push({ pixels })
    }
  }
  return tiles
}

/** True if every pixel of the tile is transparent. */
export function isTileEmpty(tile: Glyph): boolean {
  return tile.pixels.every((pixel) => pixel === 'transparent')
}

/**
 * Turn sliced tiles into font edits at 0xA0 onwards.
 *
 * 0xFF is skipped: it is the reserved end-of-font marker, so only 95 of the 96
 * tiles are written. Ink in the bottom-right tile would be silently dropped,
 * so it is reported rather than ignored.
 */
export function tilesToEdits(tiles: Glyph[]): {
  edits: Record<number, Pixel[]>
  droppedReservedInk: boolean
} {
  if (tiles.length !== TILE_COUNT) {
    throw new LogoError(`expected ${TILE_COUNT} tiles, got ${tiles.length}`)
  }
  const edits: Record<number, Pixel[]> = {}
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const index = LOGO_START + i
    if (index === RESERVED_INDEX) continue
    edits[index] = tiles[i].pixels
  }
  return {
    edits,
    droppedReservedInk: !isTileEmpty(tiles[TILE_COUNT - 1]),
  }
}
