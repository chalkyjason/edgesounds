import { GLYPH_HEIGHT, RASTER_HEIGHT, RASTER_SIZE, RASTER_WIDTH, maskToRaster } from './raster'
import type { Raster } from './raster'
import { composeText } from './stencils'
import type { Stencils } from './stencils'

/** The rules' geometry, from tools/make_logo.py. */
export const RULE_LEFT = 24
export const RULE_RIGHT = RASTER_WIDTH - 24
export const RULE_THICKNESS = 3
const CHEVRON_STEPS = 5

/** Which tile row each line sits in. */
export const BIG_ROW = 1
export const SMALL_ROW = 2

export interface TemplateInput {
  big: string
  small: string
  rules: boolean
}

export interface LineReport {
  /** Rendered width in px, 0 for an empty line. */
  width: number
  /** Pixels by which the line exceeds the raster; 0 when it fits. */
  overflow: number
  unsupported: string[]
  /** True when the line was drawn (non-empty and fits). */
  drawn: boolean
}

export interface TemplateResult {
  raster: Raster
  big: LineReport
  small: LineReport
}

/**
 * Today's splash layout: a big line on tile row 1, a small line on row 2,
 * both centred, rules on rows 0 and 3, and the automatic black outline.
 * A port of make_logo.py's build_mask + render.
 */
export function renderTemplate(stencils: Stencils, input: TemplateInput): TemplateResult {
  const mask = new Array<boolean>(RASTER_SIZE).fill(false)

  if (input.rules) {
    drawRule(mask, 0, true)
    drawRule(mask, 3, false)
  }
  const big = drawLine(mask, stencils, 'big', input.big, BIG_ROW)
  const small = drawLine(mask, stencils, 'small', input.small, SMALL_ROW)

  return { raster: maskToRaster(mask, true), big, small }
}

function drawLine(
  mask: boolean[],
  stencils: Stencils,
  font: keyof Stencils,
  text: string,
  tileRow: number,
): LineReport {
  const composed = composeText(stencils[font], text)
  const overflow = Math.max(0, composed.width - RASTER_WIDTH)
  const drawn = composed.width > 0 && overflow === 0
  if (drawn) {
    const x0 = centre(composed.width, 0, RASTER_WIDTH)
    const y0 = tileRow * GLYPH_HEIGHT + Math.floor((GLYPH_HEIGHT - composed.rows.length) / 2)
    blit(mask, composed.rows, x0, y0)
  }
  return { width: composed.width, overflow, unsupported: composed.unsupported, drawn }
}

/**
 * A 3 px rule vertically centred in a tile row. The top rule carries
 * five-step chevron caps; the bottom one does not -- that is how the shipped
 * splash is drawn, whatever make_logo.py's comment says about "matching".
 */
function drawRule(mask: boolean[], tileRow: number, chevrons: boolean): void {
  const y = tileRow * GLYPH_HEIGHT + Math.floor(GLYPH_HEIGHT / 2) - Math.floor(RULE_THICKNESS / 2)
  fill(mask, RULE_LEFT, y, RULE_RIGHT, y + RULE_THICKNESS)
  if (!chevrons) return
  for (let step = 0; step < CHEVRON_STEPS; step += 1) {
    fill(mask, RULE_LEFT - 4 - step * 3, y - step, RULE_LEFT - 1 - step * 3, y + RULE_THICKNESS + step)
    fill(mask, RULE_RIGHT + 1 + step * 3, y - step, RULE_RIGHT + 4 + step * 3, y + RULE_THICKNESS + step)
  }
}

function blit(mask: boolean[], rows: string[], x0: number, y0: number): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === '#') mask[(y0 + y) * RASTER_WIDTH + x0 + x] = true
    }
  })
}

function fill(mask: boolean[], x0: number, y0: number, x1: number, y1: number): void {
  for (let y = Math.max(0, y0); y < Math.min(RASTER_HEIGHT, y1); y += 1) {
    for (let x = Math.max(0, x0); x < Math.min(RASTER_WIDTH, x1); x += 1) {
      mask[y * RASTER_WIDTH + x] = true
    }
  }
}

function centre(width: number, spanStart: number, spanEnd: number): number {
  return spanStart + Math.floor((spanEnd - spanStart - width) / 2)
}
