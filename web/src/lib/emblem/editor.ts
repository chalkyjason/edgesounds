import { beginStroke, endStroke, initialHistory, record, redo, undo } from '../history'
import type { History } from '../history'
import type { Pixel } from '../mcm/types'
import { brushOffsets } from '../splash/raster'
import type { PaintLayer } from '../splash/raster'
import { MAX_LAYERS } from './types'
import type { Layer, LayerBase } from './types'

/** What undo covers: the layer stack and the paint over it. */
export interface EditorState {
  layers: Layer[]
  paint: PaintLayer
}

export type EditorHistory = History<EditorState>

export const EMPTY_EDITOR: EditorHistory = initialHistory({ layers: [], paint: {} })

/** Fields any layer can change; kind-specific ones are ignored on other kinds. */
export type LayerPatch = Partial<Omit<LayerBase, 'id'>> & {
  shape?: string
  text?: string
  font?: 'big' | 'small'
  threshold?: number
  invert?: boolean
}

export type Reorder = 'up' | 'down' | 'front' | 'back'

export type EditorAction =
  | { type: 'load'; state: EditorState }
  /** Bracket a drag, pinch, twist or slider movement so it is one undo step. */
  | { type: 'begin' }
  | { type: 'end' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'add'; layer: Layer }
  | { type: 'update'; id: string; patch: LayerPatch }
  /** Move by an offset: a held nudge repeats this without reading stale positions. */
  | { type: 'nudge'; id: string; dx: number; dy: number }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string; newId: string }
  | { type: 'move'; id: string; to: Reorder }
  | { type: 'replace'; layers: Layer[] }
  | { type: 'paint'; x: number; y: number; size: 1 | 2 | 3; color: Pixel }
  | { type: 'clearPaint' }

/** A change becomes a step only when something actually changed. */
function change(history: EditorHistory, next: EditorState): EditorHistory {
  return next === history.present ? history : record(history, next)
}

function withLayers(state: EditorState, layers: Layer[]): EditorState {
  return layers === state.layers ? state : { ...state, layers }
}

export function editorReducer(history: EditorHistory, action: EditorAction): EditorHistory {
  const state = history.present
  const { layers } = state
  switch (action.type) {
    case 'load':
      return initialHistory(action.state)
    case 'begin':
      return beginStroke(history)
    case 'end':
      return endStroke(history)
    case 'undo':
      return undo(endStroke(history))
    case 'redo':
      return redo(endStroke(history))
    case 'add':
      if (layers.length >= MAX_LAYERS) return history
      return change(history, withLayers(state, [...layers, action.layer]))
    case 'update': {
      const index = layers.findIndex((l) => l.id === action.id)
      if (index < 0) return history
      const current = layers[index]
      const next = { ...current, ...action.patch } as Layer
      const same = (Object.keys(action.patch) as (keyof Layer)[]).every((k) => next[k] === current[k])
      if (same) return history
      const nextLayers = layers.slice()
      nextLayers[index] = next
      return change(history, withLayers(state, nextLayers))
    }
    case 'nudge': {
      const layer = layers.find((l) => l.id === action.id)
      if (!layer || (action.dx === 0 && action.dy === 0)) return history
      return editorReducer(history, { type: 'update', id: action.id, patch: { x: layer.x + action.dx, y: layer.y + action.dy } })
    }
    case 'remove': {
      const nextLayers = layers.filter((l) => l.id !== action.id)
      return nextLayers.length === layers.length ? history : change(history, withLayers(state, nextLayers))
    }
    case 'duplicate': {
      const index = layers.findIndex((l) => l.id === action.id)
      if (index < 0 || layers.length >= MAX_LAYERS) return history
      // Offset a little so the copy is visibly a second layer.
      const copy = { ...layers[index], id: action.newId, x: layers[index].x + 6, y: layers[index].y + 4 }
      return change(history, withLayers(state, [...layers.slice(0, index + 1), copy, ...layers.slice(index + 1)]))
    }
    case 'move':
      return change(history, withLayers(state, reorder(layers, action.id, action.to)))
    case 'replace':
      return change(history, withLayers(state, action.layers.slice(0, MAX_LAYERS)))
    case 'paint': {
      const offsets = brushOffsets(action.x, action.y, action.size)
      if (offsets.every((o) => state.paint[o] === action.color)) return history
      const paint = { ...state.paint }
      for (const offset of offsets) paint[offset] = action.color
      return change(history, { ...state, paint })
    }
    case 'clearPaint':
      return Object.keys(state.paint).length === 0 ? history : change(endStroke(history), { ...state, paint: {} })
  }
}

/** The stack is bottom first, so "up" and "front" move towards the end. */
export function reorder(layers: Layer[], id: string, to: Reorder): Layer[] {
  const index = layers.findIndex((l) => l.id === id)
  if (index < 0) return layers
  const target =
    to === 'front' ? layers.length - 1 : to === 'back' ? 0 : to === 'up' ? index + 1 : index - 1
  if (target === index || target < 0 || target >= layers.length) return layers
  const next = layers.slice()
  const [layer] = next.splice(index, 1)
  next.splice(target, 0, layer)
  return next
}
