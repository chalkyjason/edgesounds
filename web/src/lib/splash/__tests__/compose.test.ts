import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeFont } from '../../mcm/decode'
import { encodeFont } from '../../mcm/encode'
import { fontWithSplash, splashPng } from '../compose'
import { RASTER_WIDTH, emptyRaster, rasterToRgba } from '../raster'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../../..')
const STOCK = decodeFont(readFileSync(resolve(REPO, 'assets/references/stock/default_v2.mcm'), 'latin1'))

const at = (x: number, y: number) => y * RASTER_WIDTH + x

describe('fontWithSplash', () => {
  const raster = emptyRaster()
  raster[at(0, 0)] = 'white' // tile 0xA0
  raster[at(RASTER_WIDTH - 1, 71)] = 'white' // tile 0xFF, the reserved one

  it('replaces only the splash block and keeps every other glyph by identity', () => {
    const { font, droppedReservedInk } = fontWithSplash(STOCK, raster)
    expect(font).toHaveLength(256)
    for (let i = 0; i < 0xa0; i += 1) expect(font[i]).toBe(STOCK[i])
    expect(font[0xff]).toBe(STOCK[0xff])
    expect(font[0xa0].pixels[0]).toBe('white')
    expect(font[0xa1].pixels.every((p) => p === 'transparent')).toBe(true)
    expect(droppedReservedInk).toBe(true)
    expect(STOCK[0xa0].pixels[0]).not.toBe('white') // base untouched
  })

  it('encodes to a valid 147463-byte font', () => {
    const { font } = fontWithSplash(STOCK, emptyRaster())
    const text = encodeFont(font)
    expect(text.length).toBe(147463)
    expect(decodeFont(text)).toHaveLength(256)
  })

  it('rejects a base of the wrong size', () => {
    expect(() => fontWithSplash(STOCK.slice(1), raster)).toThrow('255 glyphs')
  })
})

describe('splashPng', () => {
  it('writes a 288 x 72 RGB PNG whose pixels are the upload palette', () => {
    const raster = emptyRaster()
    raster[at(3, 1)] = 'white'
    raster[at(4, 1)] = 'black'
    const png = splashPng(raster)
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const view = new DataView(png.buffer, png.byteOffset)
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe('IHDR')
    expect(view.getUint32(16)).toBe(288)
    expect(view.getUint32(20)).toBe(72)
    expect(png[24]).toBe(8)
    expect(png[25]).toBe(2)

    // Pull the IDAT out and inflate it with Node's zlib: the stored blocks
    // must be a valid stream, and the scanlines must match the raster.
    const idatLength = view.getUint32(33)
    expect(String.fromCharCode(...png.subarray(37, 41))).toBe('IDAT')
    const inflated = inflateSync(png.subarray(41, 41 + idatLength))
    expect(inflated.length).toBe((288 * 3 + 1) * 72)
    const rgba = rasterToRgba(raster)
    const row1 = 1 * (288 * 3 + 1)
    expect(inflated[row1]).toBe(0)
    expect([...inflated.subarray(row1 + 1 + 3 * 3, row1 + 1 + 5 * 3)]).toEqual([255, 255, 255, 0, 0, 0])
    expect([...inflated.subarray(1, 4)]).toEqual([...rgba.subarray(0, 3)])
    expect(String.fromCharCode(...png.subarray(png.length - 8, png.length - 4))).toBe('IEND')
  })
})
