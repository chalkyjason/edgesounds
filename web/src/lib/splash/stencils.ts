/**
 * The stencil alphabets the Army Jay splash is set in, from
 * assets/splash_stencils.json (staged to /osd/stencils.json). The Python
 * splash builder reads the same file, so there is one set of letterforms.
 */
export interface StencilFont {
  height: number
  /** Character -> rows of '.' (clear) and '#' (white); rows share a width. */
  glyphs: Record<string, string[]>
}

export interface Stencils {
  big: StencilFont
  small: StencilFont
}

/** Pixels between letters, both fonts. */
export const LETTER_GAP = 2

export interface Composed {
  /** `font.height` rows; empty strings when the text has no renderable characters. */
  rows: string[]
  width: number
  /** Characters with no glyph, in first-seen order, after uppercasing. */
  unsupported: string[]
}

export function normalizeText(text: string): string {
  return text.toUpperCase()
}

/** Lay a string out in a stencil font: a port of make_logo.py's _compose. */
export function composeText(font: StencilFont, text: string): Composed {
  const unsupported: string[] = []
  const glyphs: string[][] = []
  for (const char of normalizeText(text)) {
    const glyph = font.glyphs[char]
    if (glyph) glyphs.push(glyph)
    else if (!unsupported.includes(char)) unsupported.push(char)
  }
  if (glyphs.length === 0) {
    return { rows: new Array<string>(font.height).fill(''), width: 0, unsupported }
  }
  const filler = '.'.repeat(LETTER_GAP)
  const rows: string[] = []
  for (let y = 0; y < font.height; y += 1) {
    rows.push(glyphs.map((glyph) => glyph[y]).join(filler))
  }
  return { rows, width: rows[0].length, unsupported }
}

/** Throws unless the file has the shape the compositor relies on. */
export function validateStencils(data: unknown): Stencils {
  if (!data || typeof data !== 'object') throw new Error('stencils.json is not an object')
  const stencils = data as Record<string, unknown>
  for (const name of ['big', 'small'] as const) {
    const font = stencils[name] as StencilFont | undefined
    if (!font || typeof font.height !== 'number' || !font.glyphs) {
      throw new Error(`stencils.json has no "${name}" font`)
    }
    for (const [char, rows] of Object.entries(font.glyphs)) {
      if (!Array.isArray(rows) || rows.length !== font.height) {
        throw new Error(`stencils.json: ${name} "${char}" is not ${font.height} rows tall`)
      }
      const width = rows[0]?.length ?? 0
      for (const row of rows) {
        if (typeof row !== 'string' || row.length !== width || !/^[.#]*$/.test(row)) {
          throw new Error(`stencils.json: ${name} "${char}" has a malformed row`)
        }
      }
    }
  }
  return data as Stencils
}
