import { useEffect, useRef } from 'react'
import type { SplashEditor } from '../../hooks/useSplashDesign'
import { hitTest } from '../../lib/emblem/compose'
import { layerName, normalizeAngle } from '../../lib/emblem/labels'
import { toRaster } from '../../lib/emblem/transform'
import type { Layer } from '../../lib/emblem/types'
import { RASTER_HEIGHT, RASTER_WIDTH } from '../../lib/splash/raster'

/** Device pixels per raster pixel in the backing store; CSS scales it to the column. */
const SCALE = 4
const VIDEO_RGB = [0x7a, 0x7a, 0x7a]
const SELECTION = '#00ff9d'
const MIN_SIZE = 2
const MAX_SIZE = 600

type Point = [number, number]

interface Gesture {
  /** The layer being moved, or null when the gesture only selects. */
  id: string | null
  /** The layer as it was when this phase of the gesture began. */
  start: Layer | null
  /** The layer under the first touch, for tap-to-select. */
  hit: Layer | null
  moved: boolean
  /** One finger: where it went down. Two: their centroid, spread and angle. */
  origin: Point
  spread: number
  angle: number
}

/**
 * The start screen at the width of its column, with the layers handled
 * directly: tap selects the topmost layer under the finger, one finger drags
 * the selected layer, pinch resizes it, a two-finger twist rotates it. A
 * mouse drags, the wheel resizes and Shift + wheel rotates; arrow keys nudge
 * and Delete removes. Every gesture is one undo step.
 */
export function EmblemCanvas({ editor }: { editor: SplashEditor }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const pointers = useRef(new Map<number, Point>())
  const gesture = useRef<Gesture | null>(null)
  const { raster, selected, layers, extentOf } = editor

  // Pixels, then the selected layer's box.
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(RASTER_WIDTH * SCALE, RASTER_HEIGHT * SCALE)
    const data = image.data
    const stride = RASTER_WIDTH * SCALE * 4
    for (let y = 0; y < RASTER_HEIGHT; y += 1) {
      for (let x = 0; x < RASTER_WIDTH; x += 1) {
        const pixel = raster[y * RASTER_WIDTH + x]
        const v = pixel === 'white' ? 255 : pixel === 'black' ? 0 : -1
        for (let dy = 0; dy < SCALE; dy += 1) {
          let o = (y * SCALE + dy) * stride + x * SCALE * 4
          for (let dx = 0; dx < SCALE; dx += 1) {
            data[o] = v < 0 ? VIDEO_RGB[0] : v
            data[o + 1] = v < 0 ? VIDEO_RGB[1] : v
            data[o + 2] = v < 0 ? VIDEO_RGB[2] : v
            data[o + 3] = 255
            o += 4
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0)

    const extent = selected ? extentOf(selected) : null
    if (selected && extent) {
      const w = extent.width / 2 + 1
      const h = extent.height / 2 + 1
      const corners = ([[-w, -h], [w, -h], [w, h], [-w, h]] as Point[]).map(([lx, ly]) =>
        toRaster({ ...selected, flipX: false, flipY: false }, 1, lx, ly),
      )
      ctx.save()
      ctx.strokeStyle = SELECTION
      ctx.lineWidth = 2
      ctx.setLineDash([8, 6])
      ctx.beginPath()
      corners.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * SCALE, y * SCALE) : ctx.lineTo(x * SCALE, y * SCALE)))
      ctx.closePath()
      ctx.stroke()
      ctx.restore()
    }
  }, [raster, selected, extentOf])

  const toPoint = (clientX: number, clientY: number): Point => {
    const rect = ref.current!.getBoundingClientRect()
    return [((clientX - rect.left) / rect.width) * RASTER_WIDTH, ((clientY - rect.top) / rect.height) * RASTER_HEIGHT]
  }
  const layerById = (id: string | null) => (id ? (layers.find((l) => l.id === id) ?? null) : null)

  /** Start (or restart, when fingers are added or lifted) a phase of the gesture. */
  const startPhase = (id: string | null, hit: Layer | null, moved: boolean) => {
    const points = [...pointers.current.values()]
    const [a, b] = points
    const origin: Point = b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : a
    gesture.current = {
      id,
      start: layerById(id),
      hit,
      moved,
      origin,
      spread: b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0,
      angle: b ? Math.atan2(b[1] - a[1], b[0] - a[0]) : 0,
    }
  }

  // The wheel needs a non-passive listener to keep the page from scrolling.
  const wheelEnd = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(editor)
  useEffect(() => {
    latest.current = editor
  })
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const onWheel = (event: WheelEvent) => {
      const ed = latest.current
      const layer = ed.selected
      if (!layer) return
      event.preventDefault()
      if (!wheelEnd.current) ed.beginGesture()
      else clearTimeout(wheelEnd.current)
      wheelEnd.current = setTimeout(() => {
        wheelEnd.current = null
        latest.current.endGesture()
      }, 300)
      if (event.shiftKey) {
        ed.update(layer.id, { rotation: normalizeAngle(layer.rotation + event.deltaY * 0.2) })
      } else {
        ed.update(layer.id, { size: clampSize(layer.size * Math.exp(-event.deltaY * 0.002)) })
      }
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <canvas
      ref={ref}
      width={RASTER_WIDTH * SCALE}
      height={RASTER_HEIGHT * SCALE}
      tabIndex={0}
      role="img"
      aria-label={
        selected
          ? `Start screen, 288 by 72 pixels. ${layerName(selected, editor.library.state === 'loaded' ? editor.library.byId : null)} selected: drag to move, pinch to resize, twist to rotate; arrow keys nudge.`
          : 'Start screen, 288 by 72 pixels. Tap a layer to select it.'
      }
      className="block w-full touch-none select-none rounded border border-zinc-700 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{ aspectRatio: `${RASTER_WIDTH} / ${RASTER_HEIGHT}`, imageRendering: 'pixelated', cursor: selected ? 'move' : 'pointer' }}
      onPointerDown={(event) => {
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // A pointer the browser no longer tracks; the gesture works without capture.
        }
        pointers.current.set(event.pointerId, toPoint(event.clientX, event.clientY))
        if (pointers.current.size === 1) {
          const [x, y] = toPoint(event.clientX, event.clientY)
          const hit = hitTest(layers, x, y, extentOf)
          // Drag moves the selected layer from anywhere; with none selected, the one touched.
          let target = selected
          if (!target && hit) {
            target = hit
            editor.select(hit.id)
          }
          if (target) editor.beginGesture()
          startPhase(target?.id ?? null, hit, false)
        } else if (pointers.current.size === 2 && gesture.current) {
          startPhase(gesture.current.id, gesture.current.hit, gesture.current.moved)
        }
      }}
      onPointerMove={(event) => {
        if (!pointers.current.has(event.pointerId)) return
        pointers.current.set(event.pointerId, toPoint(event.clientX, event.clientY))
        const g = gesture.current
        if (!g?.id || !g.start) return
        const points = [...pointers.current.values()]
        if (points.length >= 2) {
          const [a, b] = points
          const centre: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
          const spread = Math.hypot(b[0] - a[0], b[1] - a[1])
          const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
          g.moved = true
          editor.update(g.id, {
            x: g.start.x + centre[0] - g.origin[0],
            y: g.start.y + centre[1] - g.origin[1],
            size: g.spread > 0 ? clampSize((g.start.size * spread) / g.spread) : g.start.size,
            rotation: normalizeAngle(g.start.rotation + ((angle - g.angle) * 180) / Math.PI),
          })
        } else {
          const [x, y] = points[0]
          const dx = x - g.origin[0]
          const dy = y - g.origin[1]
          if (!g.moved && Math.hypot(dx, dy) < 1) return
          g.moved = true
          editor.update(g.id, { x: round(g.start.x + dx), y: round(g.start.y + dy) })
        }
      }}
      onPointerUp={(event) => endPointer(event.pointerId)}
      onPointerCancel={(event) => endPointer(event.pointerId)}
      onKeyDown={(event) => {
        const layer = selected
        if (!layer) return
        const step = event.shiftKey ? 10 : 1
        const nudge: Record<string, Point> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        }
        if (event.key in nudge) {
          event.preventDefault()
          const [dx, dy] = nudge[event.key]
          editor.update(layer.id, { x: layer.x + dx, y: layer.y + dy })
        } else if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault()
          editor.remove(layer.id)
        } else if (event.key === 'Escape') {
          editor.select(null)
        }
      }}
    />
  )

  function endPointer(pointerId: number) {
    if (!pointers.current.delete(pointerId)) return
    const g = gesture.current
    if (pointers.current.size > 0) {
      // A finger lifted mid-pinch: carry on dragging with the one left.
      if (g) startPhase(g.id, g.hit, g.moved)
      return
    }
    if (g) {
      if (g.id) editor.endGesture()
      // A tap, not a drag: select what was touched, or nothing.
      if (!g.moved) editor.select(g.hit?.id ?? null)
    }
    gesture.current = null
  }
}

function clampSize(size: number): number {
  return Math.round(Math.min(MAX_SIZE, Math.max(MIN_SIZE, size)) * 10) / 10
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
