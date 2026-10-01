import type { Pixel } from '../mcm/types'
import { beginStroke, endStroke, initialHistory, record, redo, undo } from '../history'
import type { History } from '../history'
import { brushOffsets } from './raster'
import type { PaintLayer } from './raster'

export type PaintHistory = History<PaintLayer>

export const EMPTY_HISTORY: PaintHistory = initialHistory({})

export type PaintAction =
  | { type: 'strokeBegin' }
  | { type: 'stroke'; x: number; y: number; size: 1 | 2 | 3; color: Pixel }
  | { type: 'strokeEnd' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'clear' }
  | { type: 'load'; paint: PaintLayer }

/**
 * The paint layer with undo/redo. A drag is bracketed by strokeBegin and
 * strokeEnd and becomes one undo step; a stroke that changes nothing leaves
 * the history alone, so a stationary drag records nothing.
 */
export function paintReducer(history: PaintHistory, action: PaintAction): PaintHistory {
  switch (action.type) {
    case 'strokeBegin':
      return beginStroke(history)
    case 'stroke': {
      const offsets = brushOffsets(action.x, action.y, action.size)
      if (offsets.every((o) => history.present[o] === action.color)) return history
      const next = { ...history.present }
      for (const offset of offsets) next[offset] = action.color
      return record(history, next)
    }
    case 'strokeEnd':
      return endStroke(history)
    case 'undo':
      return undo(endStroke(history))
    case 'redo':
      return redo(endStroke(history))
    case 'clear':
      return Object.keys(history.present).length === 0 ? history : record(endStroke(history), {})
    case 'load':
      return initialHistory(action.paint)
  }
}
