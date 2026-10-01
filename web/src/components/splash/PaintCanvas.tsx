import { useCallback, useEffect, useRef, useState } from 'react'
import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../../lib/mcm/decode'
import { RESERVED_INDEX, LOGO_START, TILES_HORIZ } from '../../lib/mcm/logo'
import type { Pixel } from '../../lib/mcm/types'
import { RASTER_HEIGHT, RASTER_WIDTH } from '../../lib/splash/raster'
import type { Raster } from '../../lib/splash/raster'

const COLORS: Record<Pixel, string> = { white: '#ffffff', black: '#000000', transparent: '#18181b' }
const CHECKER = '#232327'
const GRID = 'rgba(255,255,255,0.14)'
const RESERVED = 'rgba(255,80,80,0.18)'

export type BrushSize = 1 | 2 | 3

/**
 * The whole 288 x 72 raster as a paint surface at `scale`. Pointer events
 * with capture, as in GlyphEditorCanvas, so a finger or stylus stroke
 * survives leaving the canvas. The tile grid is drawn over the pixels, and
 * the reserved 0xFF tile is tinted: ink there is never written to a font.
 */
export function PaintCanvas({
  raster,
  color,
  size,
  onStroke,
  scale = 3,
}: {
  raster: Raster
  color: Pixel
  size: BrushSize
  onStroke: (x: number, y: number, size: BrushSize, color: Pixel) => void
  scale?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [painting, setPainting] = useState(false)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    for (let y = 0; y < RASTER_HEIGHT; y += 1) {
      for (let x = 0; x < RASTER_WIDTH; x += 1) {
        const pixel = raster[y * RASTER_WIDTH + x]
        ctx.fillStyle = pixel === 'transparent' && (x + y) % 2 === 1 ? CHECKER : COLORS[pixel]
        ctx.fillRect(x * scale, y * scale, scale, scale)
      }
    }
    const reservedCol = (RESERVED_INDEX - LOGO_START) % TILES_HORIZ
    const reservedRow = Math.floor((RESERVED_INDEX - LOGO_START) / TILES_HORIZ)
    ctx.fillStyle = RESERVED
    ctx.fillRect(
      reservedCol * GLYPH_WIDTH * scale,
      reservedRow * GLYPH_HEIGHT * scale,
      GLYPH_WIDTH * scale,
      GLYPH_HEIGHT * scale,
    )
    ctx.strokeStyle = GRID
    ctx.lineWidth = 1
    for (let x = 0; x <= RASTER_WIDTH; x += GLYPH_WIDTH) {
      ctx.beginPath()
      ctx.moveTo(x * scale + 0.5, 0)
      ctx.lineTo(x * scale + 0.5, RASTER_HEIGHT * scale)
      ctx.stroke()
    }
    for (let y = 0; y <= RASTER_HEIGHT; y += GLYPH_HEIGHT) {
      ctx.beginPath()
      ctx.moveTo(0, y * scale + 0.5)
      ctx.lineTo(RASTER_WIDTH * scale, y * scale + 0.5)
      ctx.stroke()
    }
  }, [raster, scale])

  const paintAt = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = ref.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * RASTER_WIDTH)
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * RASTER_HEIGHT)
      if (x < 0 || y < 0 || x >= RASTER_WIDTH || y >= RASTER_HEIGHT) return
      onStroke(x, y, size, color)
    },
    [color, size, onStroke],
  )

  return (
    <div className="overflow-x-auto rounded border border-zinc-700 bg-zinc-950">
      <canvas
        ref={ref}
        width={RASTER_WIDTH * scale}
        height={RASTER_HEIGHT * scale}
        role="img"
        aria-label="Start screen, 288 by 72 pixels. Drag to paint."
        className="block touch-none"
        style={{ cursor: 'crosshair', width: RASTER_WIDTH * scale, height: RASTER_HEIGHT * scale }}
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
    </div>
  )
}
