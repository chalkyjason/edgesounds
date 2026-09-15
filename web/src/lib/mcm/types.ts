/** A single pixel of a MAX7456 glyph. */
export type Pixel = 'black' | 'white' | 'transparent'

/** One 12x18 character cell, row-major, always PIXELS_PER_GLYPH long. */
export interface Glyph {
  pixels: Pixel[]
}

/** A complete font: exactly GLYPH_COUNT glyphs, indexed 0x00-0xFF. */
export type Font = Glyph[]

/**
 * Thrown for any structural problem in a .mcm file.
 *
 * `line` is 1-based and counts the header, matching the diagnostics the
 * Python parser in tools/mcm_decode.py produces, so an error reported by
 * either implementation points at the same line of the same file.
 */
export class McmParseError extends Error {
  readonly line: number

  constructor(message: string, line: number) {
    super(`line ${line}: ${message}`)
    this.name = 'McmParseError'
    this.line = line
  }
}
