import type { Pixel } from '../mcm/types'
import { brushOffsets } from './raster'
import type { PaintLayer } from './raster'

export interface PaintHistory {
  present: PaintLayer
  past: PaintLayer[]
  future: PaintLayer[]
}

export const EMPTY_HISTORY: PaintHistory = { present: {}, past: [], future: [] }
const MAX_HISTORY = 100

export type PaintAction =
  | { type: 'stroke'; x: number; y: number; size: 1 | 2 | 3; color: Pixel }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear' }
  | { type: 'load'; paint: PaintLayer }

function push(history: PaintHistory, next: PaintLayer): PaintHistory {
  return { present: next, past: [...history.past, history.present].slice(-MAX_HISTORY), future: [] }
}

/**
 * The paint layer with undo/redo. One stroke action per pointer event; a
 * stroke that changes nothing leaves the history alone so a stationary drag
 * does not fill the undo stack.
 */
export function paintReducer(history: PaintHistory, action: PaintAction): PaintHistory {
  switch (action.type) {
    case 'stroke': {
      const offsets = brushOffsets(action.x, action.y, action.size)
      if (offsets.every((o) => history.present[o] === action.color)) return history
      const next = { ...history.present }
      for (const offset of offsets) next[offset] = action.color
      return push(history, next)
    }
    case 'undo': {
      if (history.past.length === 0) return history
      const previous = history.past[history.past.length - 1]
      return { present: previous, past: history.past.slice(0, -1), future: [history.present, ...history.future] }
    }
    case 'redo': {
      if (history.future.length === 0) return history
      const [next, ...rest] = history.future
      return { present: next, past: [...history.past, history.present], future: rest }
    }
    case 'clear':
      return Object.keys(history.present).length === 0 ? history : push(history, {})
    case 'load':
      return { present: action.paint, past: [], future: [] }
  }
}
