import { McmParseError } from './types'
import type { Font, Glyph, Pixel } from './types'

export type { Font, Glyph, Pixel }
export { McmParseError }

export const HEADER = 'MAX7456'
export const GLYPH_WIDTH = 12
export const GLYPH_HEIGHT = 18
export const PIXELS_PER_GLYPH = GLYPH_WIDTH * GLYPH_HEIGHT // 216
export const GLYPH_COUNT = 256
export const PIXELS_PER_BYTE = 4
export const DATA_BYTES_PER_GLYPH = PIXELS_PER_GLYPH / PIXELS_PER_BYTE // 54
export const FIELD_BYTES_PER_GLYPH = 64
export const PAD_BYTES_PER_GLYPH = FIELD_BYTES_PER_GLYPH - DATA_BYTES_PER_GLYPH // 10
export const PAD_LINE = '01010101' // 0x55
export const DATA_LINE_COUNT = GLYPH_COUNT * FIELD_BYTES_PER_GLYPH // 16384

/**
 * Bit pair -> pixel.
 *
 * `11` is not a value any encoder should produce, and validate.py rejects a
 * font containing one. We map it to transparent anyway, for parity with
 * tools/mcm_encode.py's BITS_TO_CHAR. The asymmetry is deliberate: decoding
 * is lenient, encoding never emits `11`, and round-trip byte-exactness is
 * therefore guaranteed for valid fonts only. Do not "fix" this.
 */
const BITS_TO_PIXEL: Record<string, Pixel> = {
  '00': 'black',
  '10': 'white',
  '01': 'transparent',
  '11': 'transparent',
}

/** Split into lines, tolerating CRLF and a single trailing newline. */
function toLines(text: string): string[] {
  const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalised.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * Parse a MAX7456 .mcm font.
 *
 * @throws {McmParseError} on any structural problem; never returns a
 *   partially-parsed font.
 */
export function decodeFont(text: string): Font {
  const lines = toLines(text)

  if (lines.length === 0) throw new McmParseError('file is empty', 1)
  if (lines[0] !== HEADER) {
    throw new McmParseError(`expected header ${HEADER}, got ${JSON.stringify(lines[0])}`, 1)
  }

  const body = lines.slice(1)
  if (body.length !== DATA_LINE_COUNT) {
    throw new McmParseError(
      `expected ${DATA_LINE_COUNT} data lines, found ${body.length}`,
      Math.min(body.length + 2, DATA_LINE_COUNT + 1),
    )
  }

  const font: Font = []
  for (let index = 0; index < GLYPH_COUNT; index += 1) {
    const base = index * FIELD_BYTES_PER_GLYPH
    const pixels: Pixel[] = []

    for (let row = 0; row < DATA_BYTES_PER_GLYPH; row += 1) {
      const fileLine = base + row + 2 // +1 past the header, +1 for 1-based
      const line = body[base + row]
      if (!/^[01]{8}$/.test(line)) {
        throw new McmParseError(
          `expected 8 characters of 0/1, got ${JSON.stringify(line)}`,
          fileLine,
        )
      }
      for (let bit = 0; bit < 8; bit += 2) {
        pixels.push(BITS_TO_PIXEL[line.slice(bit, bit + 2)])
      }
    }

    for (let pad = 0; pad < PAD_BYTES_PER_GLYPH; pad += 1) {
      const offset = base + DATA_BYTES_PER_GLYPH + pad
      const fileLine = offset + 2
      if (body[offset] !== PAD_LINE) {
        throw new McmParseError(
          `expected padding ${PAD_LINE} (0x55), got ${JSON.stringify(body[offset])}`,
          fileLine,
        )
      }
    }

    const glyph: Glyph = { pixels }
    font.push(glyph)
  }

  return font
}
