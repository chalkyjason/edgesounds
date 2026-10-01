/**
 * Undo history for the two pixel editors (the glyph editor and the start
 * screen's paint layer).
 *
 * A finger drag is one undo step, however many pixels it crosses. Between
 * `beginStroke` and `endStroke`, the first change is recorded as a new step
 * and every later one folds into it. Outside a stroke -- a tap, a keyboard
 * paint, a fill -- each change is its own step.
 */
export interface History<T> {
  present: T
  past: T[]
  future: T[]
  /** 'started': in a stroke, nothing recorded yet. 'recorded': in a stroke that has its step. */
  stroke?: 'started' | 'recorded'
}

export const MAX_HISTORY = 100

export function initialHistory<T>(present: T): History<T> {
  return { present, past: [], future: [] }
}

/** Make `next` the present: a new undo step, or part of the open stroke's. */
export function record<T>(history: History<T>, next: T): History<T> {
  if (history.stroke === 'recorded') return { ...history, present: next }
  return {
    present: next,
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    future: [],
    ...(history.stroke === 'started' ? { stroke: 'recorded' as const } : {}),
  }
}

export function beginStroke<T>(history: History<T>): History<T> {
  return { ...history, stroke: 'started' }
}

export function endStroke<T>(history: History<T>): History<T> {
  if (!history.stroke) return history
  const { stroke: _stroke, ...rest } = history
  return rest
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history
  return {
    present: history.past[history.past.length - 1],
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
  }
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history
  const [next, ...rest] = history.future
  return { present: next, past: [...history.past, history.present], future: rest }
}

/**
 * Every grid cell on the line from (x0, y0) to (x1, y1), ends included
 * (Bresenham). Pointer events arrive tens of milliseconds apart, so a fast
 * drag jumps cells; painting the line between them leaves no gaps.
 */
export function linePoints(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const points: [number, number][] = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    points.push([x, y])
    if (x === x1 && y === y1) return points
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}
