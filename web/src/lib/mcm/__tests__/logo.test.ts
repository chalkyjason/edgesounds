import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodeFont } from '../decode'
import {
  LOGO_HEIGHT,
  LOGO_START,
  LOGO_WIDTH,
  LogoError,
  RESERVED_INDEX,
  TILE_COUNT,
  classifyPixel,
  isTileEmpty,
  rasterToTiles,
  tilesToEdits,
} from '../logo'

/** A 288x72 raster filled with one colour, optionally with one pixel changed. */
function raster(
  fill: [number, number, number],
  poke?: { x: number; y: number; rgb: [number, number, number] },
) {
  const data = new Uint8ClampedArray(LOGO_WIDTH * LOGO_HEIGHT * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0]
    data[i + 1] = fill[1]
    data[i + 2] = fill[2]
    data[i + 3] = 255
  }
  if (poke) {
    const offset = (poke.y * LOGO_WIDTH + poke.x) * 4
    data[offset] = poke.rgb[0]
    data[offset + 1] = poke.rgb[1]
    data[offset + 2] = poke.rgb[2]
  }
  return data
}

const GREEN: [number, number, number] = [0, 255, 0]
const WHITE: [number, number, number] = [255, 255, 255]

describe('classifyPixel', () => {
  it('maps the three uploader colours', () => {
    expect(classifyPixel(0, 0, 0, 255, true)).toBe('black')
    expect(classifyPixel(255, 255, 255, 255, true)).toBe('white')
    expect(classifyPixel(0, 255, 0, 255, true)).toBe('transparent')
  })

  it('treats a transparent alpha as transparent', () => {
    expect(classifyPixel(123, 45, 67, 0, true)).toBe('transparent')
  })

  it('refuses an off-palette colour in strict mode', () => {
    // An anti-aliased edge pixel: silently snapping it would put a wrong
    // pixel in a 12x18 tile, where it is clearly visible.
    expect(() => classifyPixel(12, 200, 12, 255, true)).toThrow(LogoError)
  })

  it('snaps to the nearest palette entry when not strict', () => {
    expect(classifyPixel(12, 200, 12, 255, false)).toBe('transparent')
    expect(classifyPixel(240, 240, 240, 255, false)).toBe('white')
    expect(classifyPixel(20, 20, 20, 255, false)).toBe('black')
  })
})

describe('rasterToTiles', () => {
  it('slices a correct raster into 96 tiles', () => {
    const tiles = rasterToTiles(raster(GREEN), LOGO_WIDTH, LOGO_HEIGHT)
    expect(tiles).toHaveLength(TILE_COUNT)
    expect(tiles.every(isTileEmpty)).toBe(true)
  })

  it('puts a poked pixel in the tile that owns it', () => {
    // (13, 19) is one pixel into tile column 1, row 1 => tile index 24 + 1.
    const tiles = rasterToTiles(raster(GREEN, { x: 13, y: 19, rgb: WHITE }), LOGO_WIDTH, LOGO_HEIGHT)
    expect(isTileEmpty(tiles[25])).toBe(false)
    expect(tiles[25].pixels[1 * 12 + 1]).toBe('white')
    expect(tiles.filter((t) => !isTileEmpty(t))).toHaveLength(1)
  })

  it('rejects the wrong size', () => {
    expect(() => rasterToTiles(new Uint8ClampedArray(4), 1, 1)).toThrow(/288x72/)
  })
})

describe('tilesToEdits', () => {
  it('writes 95 tiles and skips the reserved index', () => {
    const tiles = rasterToTiles(raster(GREEN), LOGO_WIDTH, LOGO_HEIGHT)
    const { edits } = tilesToEdits(tiles)
    const indexes = Object.keys(edits).map(Number)
    expect(indexes).toHaveLength(TILE_COUNT - 1)
    expect(indexes).not.toContain(RESERVED_INDEX)
    expect(Math.min(...indexes)).toBe(LOGO_START)
    expect(Math.max(...indexes)).toBe(RESERVED_INDEX - 1)
  })

  it('reports ink in the reserved bottom-right tile rather than dropping it silently', () => {
    const bottomRight = raster(GREEN, { x: LOGO_WIDTH - 1, y: LOGO_HEIGHT - 1, rgb: WHITE })
    const { droppedReservedInk } = tilesToEdits(
      rasterToTiles(bottomRight, LOGO_WIDTH, LOGO_HEIGHT),
    )
    expect(droppedReservedInk).toBe(true)
  })

  it('is quiet when the reserved tile is empty', () => {
    const { droppedReservedInk } = tilesToEdits(
      rasterToTiles(raster(GREEN), LOGO_WIDTH, LOGO_HEIGHT),
    )
    expect(droppedReservedInk).toBe(false)
  })
})

describe('the shipped fonts honour the reserved tile', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const REPO = resolve(HERE, '../../../../..')

  it.each([
    'fonts/armyjay_full.mcm',
    'fonts/armyjay_clean.mcm',
    'fonts/armyjay_highreadability.mcm',
  ])('%s leaves 0xFF empty', (rel) => {
    // 0xA0 + 96 tiles ends at 0xFF inclusive, which is also SYM_END_OF_FONT.
    // The pipeline resolves that by inking only 95 tiles; if a future splash
    // ever fills the bottom-right corner, this is where it surfaces.
    const font = decodeFont(readFileSync(resolve(REPO, rel), 'latin1'))
    expect(isTileEmpty(font[RESERVED_INDEX])).toBe(true)
  })
})
