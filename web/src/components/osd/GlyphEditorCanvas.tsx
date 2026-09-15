import { useCallback, useEffect, useRef, useState } from 'react'
import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../../lib/mcm/decode'
import type { Glyph, Pixel } from '../../lib/mcm/types'

const COLORS: Record<Pixel, string> = {
  white: '#ffffff',
  black: '#000000',
  transparent: '#18181b',
}
const CHECKER = '#232327'
const GRID = 'rgba(255,255,255,0.10)'

/**
 * A 12x18 paint surface.
 *
 * Painting is driven by pointer events rather than mouse events so a stylus or
 * touch drag works; pointer capture keeps a stroke alive when the pointer
 * leaves the canvas mid-drag, which otherwise strands the user mid-stroke.
 */
export function GlyphEditorCanvas({
  glyph,
  color,
  onPaint,
  scale = 22,
}: {
  glyph: Glyph
  color: Pixel
  onPaint: (pixelIndex: number, value: Pixel) => void
  scale?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [painting, setPainting] = useState(false)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
      for (let x = 0; x < GLYPH_WIDTH; x += 1) {
        const pixel = glyph.pixels[y * GLYPH_WIDTH + x]
        ctx.fillStyle =
          pixel === 'transparent' && (x + y) % 2 === 1 ? CHECKER : COLORS[pixel]
        ctx.fillRect(x * scale, y * scale, scale, scale)
      }
    }

    ctx.strokeStyle = GRID
    ctx.lineWidth = 1
    for (let x = 0; x <= GLYPH_WIDTH; x += 1) {
      ctx.beginPath()
      ctx.moveTo(x * scale + 0.5, 0)
      ctx.lineTo(x * scale + 0.5, GLYPH_HEIGHT * scale)
      ctx.stroke()
    }
    for (let y = 0; y <= GLYPH_HEIGHT; y += 1) {
      ctx.beginPath()
      ctx.moveTo(0, y * scale + 0.5)
      ctx.lineTo(GLYPH_WIDTH * scale, y * scale + 0.5)
      ctx.stroke()
    }
  }, [glyph, scale])

  const paintAt = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = ref.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * GLYPH_WIDTH)
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * GLYPH_HEIGHT)
      if (x < 0 || y < 0 || x >= GLYPH_WIDTH || y >= GLYPH_HEIGHT) return
      onPaint(y * GLYPH_WIDTH + x, color)
    },
    [color, onPaint],
  )

  return (
    <canvas
      ref={ref}
      width={GLYPH_WIDTH * scale}
      height={GLYPH_HEIGHT * scale}
      className="touch-none rounded border border-zinc-700 bg-zinc-950"
      style={{ cursor: 'crosshair' }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        setPainting(true)
        paintAt(event)
      }}
      onPointerMove={(event) => {
        if (painting) paintAt(event)
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId)
        setPainting(false)
      }}
      onPointerCancel={() => setPainting(false)}
    />
  )
}
