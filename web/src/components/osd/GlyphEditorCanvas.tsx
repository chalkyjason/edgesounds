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
const CURSOR = '#00ff9d'

export interface Cursor {
  x: number
  y: number
}

/**
 * A 12x18 paint surface, usable with a pointer or the keyboard.
 *
 * Pointer painting uses pointer events with capture so stylus and touch work
 * and a stroke survives the pointer leaving the canvas mid-drag.
 *
 * Keyboard painting exists because a canvas is otherwise a dead end for anyone
 * not using a mouse: arrows move a visible cursor, space or enter paints it,
 * and the cursor cell is announced through aria-live so the position is
 * followable without sight of the grid.
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
  const [cursor, setCursor] = useState<Cursor>({ x: 0, y: 0 })
  const [keyboardActive, setKeyboardActive] = useState(false)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    for (let y = 0; y < GLYPH_HEIGHT; y += 1) {
      for (let x = 0; x < GLYPH_WIDTH; x += 1) {
        const pixel = glyph.pixels[y * GLYPH_WIDTH + x]
        ctx.fillStyle = pixel === 'transparent' && (x + y) % 2 === 1 ? CHECKER : COLORS[pixel]
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

    if (keyboardActive) {
      ctx.strokeStyle = CURSOR
      ctx.lineWidth = 2
      ctx.strokeRect(cursor.x * scale + 1, cursor.y * scale + 1, scale - 2, scale - 2)
    }
  }, [glyph, scale, cursor, keyboardActive])

  const paintAt = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = ref.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * GLYPH_WIDTH)
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * GLYPH_HEIGHT)
      if (x < 0 || y < 0 || x >= GLYPH_WIDTH || y >= GLYPH_HEIGHT) return
      setCursor({ x, y })
      onPaint(y * GLYPH_WIDTH + x, color)
    },
    [color, onPaint],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLCanvasElement>) => {
      const move = (dx: number, dy: number) => {
        event.preventDefault()
        setKeyboardActive(true)
        setCursor((c) => ({
          x: Math.min(GLYPH_WIDTH - 1, Math.max(0, c.x + dx)),
          y: Math.min(GLYPH_HEIGHT - 1, Math.max(0, c.y + dy)),
        }))
      }
      switch (event.key) {
        case 'ArrowLeft':
          return move(-1, 0)
        case 'ArrowRight':
          return move(1, 0)
        case 'ArrowUp':
          return move(0, -1)
        case 'ArrowDown':
          return move(0, 1)
        case 'Home':
          event.preventDefault()
          setKeyboardActive(true)
          return setCursor((c) => ({ ...c, x: 0 }))
        case 'End':
          event.preventDefault()
          setKeyboardActive(true)
          return setCursor((c) => ({ ...c, x: GLYPH_WIDTH - 1 }))
        case ' ':
        case 'Enter':
          event.preventDefault()
          setKeyboardActive(true)
          return onPaint(cursor.y * GLYPH_WIDTH + cursor.x, color)
        default:
      }
    },
    [color, cursor, onPaint],
  )

  const current = glyph.pixels[cursor.y * GLYPH_WIDTH + cursor.x]

  return (
    <div>
      <canvas
        ref={ref}
        width={GLYPH_WIDTH * scale}
        height={GLYPH_HEIGHT * scale}
        tabIndex={0}
        role="img"
        aria-label={`Glyph grid, ${GLYPH_WIDTH} by ${GLYPH_HEIGHT} pixels. Use the arrow keys to move and space to paint.`}
        className="block touch-none rounded border border-zinc-700 bg-zinc-950 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ cursor: 'crosshair' }}
        onKeyDown={onKeyDown}
        onFocus={() => setKeyboardActive(true)}
        onBlur={() => setKeyboardActive(false)}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          setKeyboardActive(false)
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
      <p aria-live="polite" className="sr-only">
        {keyboardActive
          ? `Column ${cursor.x + 1}, row ${cursor.y + 1}. Currently ${current}.`
          : ''}
      </p>
    </div>
  )
}
