import { describe, expect, it } from 'vitest'
import { shapeLayer } from '../design'
import { EMPTY_EDITOR, editorReducer, reorder } from '../editor'
import type { EditorAction, EditorHistory } from '../editor'
import { MAX_LAYERS } from '../types'
import type { Layer } from '../types'

const run = (actions: EditorAction[], from: EditorHistory = EMPTY_EDITOR) => actions.reduce(editorReducer, from)
const star = (id: string): Layer => ({ ...shapeLayer('basics/star'), id })

describe('editorReducer', () => {
  it('adds layers on top, one undo step each', () => {
    const h = run([{ type: 'add', layer: star('a') }, { type: 'add', layer: star('b') }])
    expect(h.present.layers.map((l) => l.id)).toEqual(['a', 'b'])
    expect(run([{ type: 'undo' }], h).present.layers.map((l) => l.id)).toEqual(['a'])
  })

  it('stops at the layer limit', () => {
    let h = EMPTY_EDITOR
    for (let i = 0; i < MAX_LAYERS + 3; i += 1) h = editorReducer(h, { type: 'add', layer: star(`l${i}`) })
    expect(h.present.layers).toHaveLength(MAX_LAYERS)
    expect(editorReducer(h, { type: 'duplicate', id: 'l0', newId: 'x' })).toBe(h)
  })

  it('folds a whole gesture into one undo step', () => {
    let h = run([{ type: 'add', layer: star('a') }])
    h = run(
      [
        { type: 'begin' },
        { type: 'update', id: 'a', patch: { x: 10 } },
        { type: 'update', id: 'a', patch: { x: 20, size: 60 } },
        { type: 'update', id: 'a', patch: { rotation: 45 } },
        { type: 'end' },
      ],
      h,
    )
    expect(h.present.layers[0]).toMatchObject({ x: 20, size: 60, rotation: 45 })
    expect(h.past).toHaveLength(2)
    expect(run([{ type: 'undo' }], h).present.layers[0]).toMatchObject({ x: 144, size: 48, rotation: 0 })
  })

  it('records nothing for an update that changes nothing', () => {
    const h = run([{ type: 'add', layer: star('a') }])
    expect(editorReducer(h, { type: 'update', id: 'a', patch: { x: 144 } })).toBe(h)
    expect(editorReducer(h, { type: 'update', id: 'nope', patch: { x: 1 } })).toBe(h)
  })

  it('nudges by an offset', () => {
    const h = run([{ type: 'add', layer: star('a') }, { type: 'nudge', id: 'a', dx: -1, dy: 2 }, { type: 'nudge', id: 'a', dx: -1, dy: 0 }])
    expect(h.present.layers[0]).toMatchObject({ x: 142, y: 38 })
  })

  it('duplicates just above the original, offset', () => {
    const h = run([{ type: 'add', layer: star('a') }, { type: 'add', layer: star('b') }, { type: 'duplicate', id: 'a', newId: 'c' }])
    expect(h.present.layers.map((l) => l.id)).toEqual(['a', 'c', 'b'])
    expect(h.present.layers[1]).toMatchObject({ x: 150, y: 40 })
  })

  it('removes, and undo brings it back', () => {
    let h = run([{ type: 'add', layer: star('a') }, { type: 'remove', id: 'a' }])
    expect(h.present.layers).toEqual([])
    h = run([{ type: 'undo' }], h)
    expect(h.present.layers.map((l) => l.id)).toEqual(['a'])
  })

  it('replaces the whole stack as one step', () => {
    const h = run([{ type: 'add', layer: star('a') }, { type: 'replace', layers: [star('x'), star('y')] }])
    expect(h.present.layers.map((l) => l.id)).toEqual(['x', 'y'])
    expect(run([{ type: 'undo' }], h).present.layers.map((l) => l.id)).toEqual(['a'])
  })

  it('paints and clears paint, with the layers untouched', () => {
    let h = run([{ type: 'add', layer: star('a') }, { type: 'paint', x: 3, y: 4, size: 1, color: 'black' }])
    expect(h.present.paint).toEqual({ [4 * 288 + 3]: 'black' })
    h = run([{ type: 'clearPaint' }], h)
    expect(h.present.paint).toEqual({})
    expect(h.present.layers).toHaveLength(1)
  })

  it('loads without history', () => {
    const h = run([{ type: 'add', layer: star('a') }, { type: 'load', state: { layers: [], paint: {} } }])
    expect(h.past).toEqual([])
  })
})

describe('reorder', () => {
  const layers = ['a', 'b', 'c'].map(star)
  const ids = (l: Layer[]) => l.map((x) => x.id).join('')

  it('moves up, down, to the front and to the back', () => {
    expect(ids(reorder(layers, 'a', 'up'))).toBe('bac')
    expect(ids(reorder(layers, 'c', 'down'))).toBe('acb')
    expect(ids(reorder(layers, 'a', 'front'))).toBe('bca')
    expect(ids(reorder(layers, 'c', 'back'))).toBe('cab')
  })

  it('returns the same array when nothing moves', () => {
    expect(reorder(layers, 'c', 'up')).toBe(layers)
    expect(reorder(layers, 'a', 'back')).toBe(layers)
    expect(reorder(layers, 'nope', 'up')).toBe(layers)
  })
})
