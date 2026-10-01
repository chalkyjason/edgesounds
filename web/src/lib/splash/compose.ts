import { GLYPH_COUNT } from '../mcm/decode'
import { LOGO_START, RESERVED_INDEX, TILE_COUNT, isTileEmpty } from '../mcm/logo'
import type { Font } from '../mcm/types'
import { RASTER_HEIGHT, RASTER_WIDTH, rasterToGlyphs, rasterToRgba } from './raster'
import type { Raster } from './raster'

/**
 * The base font with the raster in its splash block. Glyphs 0xA0-0xFE are
 * replaced by the sliced tiles; 0xFF (the end-of-font marker) and every
 * other glyph are the base's own objects, untouched.
 */
export function fontWithSplash(base: Font, raster: Raster): { font: Font; droppedReservedInk: boolean } {
  if (base.length !== GLYPH_COUNT) throw new Error(`base font has ${base.length} glyphs, expected ${GLYPH_COUNT}`)
  const tiles = rasterToGlyphs(raster)
  const font = base.slice()
  for (let i = 0; i < TILE_COUNT; i += 1) {
    const index = LOGO_START + i
    if (index === RESERVED_INDEX) continue
    font[index] = tiles[i]
  }
  return { font, droppedReservedInk: !isTileEmpty(tiles[TILE_COUNT - 1]) }
}

/**
 * The raster as a 288 x 72 PNG in Configurator's three upload colours.
 * Hand-rolled with stored (uncompressed) deflate blocks: no dependency, no
 * canvas, deterministic bytes, and 62 KB is nothing for a one-off download.
 */
export function splashPng(raster: Raster): Uint8Array<ArrayBuffer> {
  const rgba = rasterToRgba(raster)
  const stride = RASTER_WIDTH * 3
  const scanlines = new Uint8Array((stride + 1) * RASTER_HEIGHT)
  for (let y = 0; y < RASTER_HEIGHT; y += 1) {
    const row = y * (stride + 1)
    scanlines[row] = 0 // filter: none
    for (let x = 0; x < RASTER_WIDTH; x += 1) {
      const src = (y * RASTER_WIDTH + x) * 4
      const dst = row + 1 + x * 3
      scanlines[dst] = rgba[src]
      scanlines[dst + 1] = rgba[src + 1]
      scanlines[dst + 2] = rgba[src + 2]
    }
  }
  const ihdr = new Uint8Array(13)
  const view = new DataView(ihdr.buffer)
  view.setUint32(0, RASTER_WIDTH)
  view.setUint32(4, RASTER_HEIGHT)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: RGB
  return concat([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', storedDeflate(scanlines)),
    chunk('IEND', new Uint8Array(0)),
  ])
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** zlib stream of stored blocks: header, <=65535-byte blocks, adler32. */
function storedDeflate(data: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [new Uint8Array([0x78, 0x01])]
  for (let offset = 0; offset < data.length || offset === 0; offset += 65535) {
    const slice = data.subarray(offset, offset + 65535)
    const final = offset + 65535 >= data.length ? 1 : 0
    const header = new Uint8Array(5)
    header[0] = final
    header[1] = slice.length & 0xff
    header[2] = slice.length >> 8
    header[3] = ~slice.length & 0xff
    header[4] = (~slice.length >> 8) & 0xff
    blocks.push(header, slice)
    if (final) break
  }
  const adler = new Uint8Array(4)
  new DataView(adler.buffer).setUint32(0, adler32(data))
  blocks.push(adler)
  return concat(blocks)
}

function adler32(data: Uint8Array): number {
  let a = 1
  let b = 0
  for (let i = 0; i < data.length; i += 1) {
    a = (a + data[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
