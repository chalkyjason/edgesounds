import { useEffect, useRef } from 'react'
import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../../lib/mcm/decode'
import type { Glyph } from '../../lib/mcm/types'

const CHECKER_A = '#18181b'
const CHECKER_B = '#232327'

/**
 * Draw one glyph at an integer scale.
 *
 * Transparent pixels get a checkerboard rather than a flat colour: on an OSD
 * transparent means "show the video feed", and without the checker it is
 * indistinguishable from black, which is the single most confusing thing when
 * reading a glyph sheet.
 */
export function GlyphCanvas({ glyph, scale = 3 }: { glyph: Glyph; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
      for (let x = 0; x < GLYPH_WIDTH; x += 1) {
        const pixel = glyph.pixels[y * GLYPH_WIDTH + x]
        ctx.fillStyle =
          pixel === 'white'
            ? '#ffffff'
            : pixel === 'black'
              ? '#000000'
              : (x + y) % 2 === 0
                ? CHECKER_A
                : CHECKER_B
        ctx.fillRect(x * scale, y * scale, scale, scale)
      }
    }
  }, [glyph, scale])

  return (
    <canvas
      ref={ref}
      width={GLYPH_WIDTH * scale}
      height={GLYPH_HEIGHT * scale}
      className="block"
      aria-hidden="true"
    />
  )
}
