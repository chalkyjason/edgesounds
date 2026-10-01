import { useCallback, useEffect, useRef, useState } from 'react'
import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../../lib/mcm/decode'
import { RESERVED_INDEX, LOGO_START, TILES_HORIZ } from '../../lib/mcm/logo'
import type { Pixel } from '../../lib/mcm/types'
import { linePoints } from '../../lib/history'
import { RASTER_HEIGHT, RASTER_WIDTH } from '../../lib/splash/raster'
import type { Raster } from '../../lib/splash/raster'

const RGB: Record<Pixel, [number, number, number]> = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  transparent: [0x18, 0x18, 0x1b],
}
const CHECKER_RGB: [number, number, number] = [0x23, 0x23, 0x27]
const GRID = 'rgba(255,255,255,0.14)'
const RESERVED = 'rgba(255,80,80,0.18)'

export type BrushSize = 1 | 2 | 3

/**
 * The whole 288 x 72 raster as a paint surface at `scale`. Pointer events
 * with capture, as in GlyphEditorCanvas, so a finger or stylus stroke
 * survives leaving the canvas; each drag is bracketed by onStrokeStart and
 * onStrokeEnd so it can be one undo step. The tile grid is drawn over the pixels, and
 * the reserved 0xFF tile is tinted: ink there is never written to a font.
 */
export function PaintCanvas({
  raster,
  color,
  size,
  onStroke,
  onStrokeStart,
  onStrokeEnd,
  scale = 3,
}: {
  raster: Raster
  color: Pixel
  size: BrushSize
  onStroke: (x: number, y: number, size: BrushSize, color: Pixel) => void
  onStrokeStart?: () => void
  onStrokeEnd?: () => void
  scale?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [painting, setPainting] = useState(false)
  // The cell the previous pointer event landed on, so a fast drag paints the
  // line between events rather than dots.
  const last = useRef<[number, number] | null>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    // One ImageData for all 20,736 pixels at `scale`, then a single blit --
    // 62,000 fillRects per pointer move is what made painting stutter.
    const image = ctx.createImageData(RASTER_WIDTH * scale, RASTER_HEIGHT * scale)
    const data = image.data
    const stride = RASTER_WIDTH * scale * 4
    for (let y = 0; y < RASTER_HEIGHT; y += 1) {
      for (let x = 0; x < RASTER_WIDTH; x += 1) {
        const pixel = raster[y * RASTER_WIDTH + x]
        const [r, g, b] = pixel === 'transparent' && (x + y) % 2 === 1 ? CHECKER_RGB : RGB[pixel]
        for (let dy = 0; dy < scale; dy += 1) {
          let o = (y * scale + dy) * stride + x * scale * 4
          for (let dx = 0; dx < scale; dx += 1) {
            data[o] = r
            data[o + 1] = g
            data[o + 2] = b
            data[o + 3] = 255
            o += 4
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0)
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
      const [fromX, fromY] = last.current ?? [x, y]
      last.current = [x, y]
      for (const [px, py] of linePoints(fromX, fromY, x, y)) {
        if (px < 0 || py < 0 || px >= RASTER_WIDTH || py >= RASTER_HEIGHT) continue
        onStroke(px, py, size, color)
      }
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
          last.current = null
          onStrokeStart?.()
          setPainting(true)
          paintAt(event)
        }}
        onPointerMove={(event) => {
          if (painting) paintAt(event)
        }}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId)
          setPainting(false)
          onStrokeEnd?.()
        }}
        onPointerCancel={() => {
          setPainting(false)
          onStrokeEnd?.()
        }}
      />
    </div>
  )
}
