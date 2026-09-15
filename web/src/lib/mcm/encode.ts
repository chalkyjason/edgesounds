import {
  DATA_BYTES_PER_GLYPH,
  FIELD_BYTES_PER_GLYPH,
  GLYPH_COUNT,
  HEADER,
  PAD_BYTES_PER_GLYPH,
  PAD_LINE,
  PIXELS_PER_BYTE,
  PIXELS_PER_GLYPH,
} from './decode'
import type { Font, Pixel } from './types'

/**
 * Pixel -> bit pair. Note there is no entry producing `11`: the encoder must
 * never emit it. See the note on BITS_TO_PIXEL in decode.ts.
 */
const PIXEL_TO_BITS: Record<Pixel, string> = {
  black: '00',
  white: '10',
  transparent: '01',
}

/**
 * Serialise a font to MAX7456 .mcm text.
 *
 * Byte-for-byte compatible with tools/mcm_encode.py, including the stock
 * convention that the final line carries no trailing newline.
 */
export function encodeFont(font: Font): string {
  if (font.length !== GLYPH_COUNT) {
    throw new Error(`expected ${GLYPH_COUNT} glyphs, got ${font.length}`)
  }

  const lines: string[] = [HEADER]

  for (let index = 0; index < GLYPH_COUNT; index += 1) {
    const { pixels } = font[index]
    if (pixels.length !== PIXELS_PER_GLYPH) {
      throw new Error(
        `glyph 0x${index.toString(16).padStart(2, '0')}: expected ${PIXELS_PER_GLYPH} pixels, got ${pixels.length}`,
      )
    }

    for (let byte = 0; byte < DATA_BYTES_PER_GLYPH; byte += 1) {
      const start = byte * PIXELS_PER_BYTE
      let line = ''
      for (let p = 0; p < PIXELS_PER_BYTE; p += 1) {
        line += PIXEL_TO_BITS[pixels[start + p]]
      }
      lines.push(line)
    }

    for (let pad = 0; pad < PAD_BYTES_PER_GLYPH; pad += 1) lines.push(PAD_LINE)
  }

  // GLYPH_COUNT * FIELD_BYTES_PER_GLYPH data lines, plus the header.
  if (lines.length !== GLYPH_COUNT * FIELD_BYTES_PER_GLYPH + 1) {
    throw new Error(`produced ${lines.length} lines, expected ${GLYPH_COUNT * FIELD_BYTES_PER_GLYPH + 1}`)
  }

  // No trailing newline: the stock fonts end mid-line and the round trip
  // must reproduce that exactly.
  return lines.join('\n')
}
