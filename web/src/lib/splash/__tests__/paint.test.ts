import { describe, expect, it } from 'vitest'
import { EMPTY_HISTORY, paintReducer } from '../paint'
import { RASTER_WIDTH } from '../raster'

const at = (x: number, y: number) => y * RASTER_WIDTH + x
const stroke = (x: number, y: number, color: 'white' | 'black' | 'transparent' = 'white', size: 1 | 2 | 3 = 1) =>
  ({ type: 'stroke', x, y, size, color }) as const

describe('paintReducer', () => {
  it('paints with the brush and records history', () => {
    const h = paintReducer(EMPTY_HISTORY, stroke(5, 5, 'white', 2))
    expect(Object.keys(h.present)).toHaveLength(4)
    expect(h.present[at(6, 6)]).toBe('white')
    expect(h.past).toHaveLength(1)
  })

  it('ignores a stroke that changes nothing', () => {
    const h1 = paintReducer(EMPTY_HISTORY, stroke(5, 5))
    const h2 = paintReducer(h1, stroke(5, 5))
    expect(h2).toBe(h1)
  })

  it('undoes, redoes, and drops the redo stack on a new stroke', () => {
    let h = paintReducer(EMPTY_HISTORY, stroke(1, 1))
    h = paintReducer(h, stroke(2, 2, 'black'))
    h = paintReducer(h, { type: 'undo' })
    expect(h.present[at(2, 2)]).toBeUndefined()
    expect(h.future).toHaveLength(1)
    h = paintReducer(h, { type: 'redo' })
    expect(h.present[at(2, 2)]).toBe('black')
    h = paintReducer(h, { type: 'undo' })
    h = paintReducer(h, stroke(3, 3))
    expect(h.future).toHaveLength(0)
    expect(paintReducer(EMPTY_HISTORY, { type: 'undo' })).toBe(EMPTY_HISTORY)
    expect(paintReducer(EMPTY_HISTORY, { type: 'redo' })).toBe(EMPTY_HISTORY)
  })

  it('clears as one undoable step and loads without history', () => {
    let h = paintReducer(EMPTY_HISTORY, stroke(1, 1))
    h = paintReducer(h, { type: 'clear' })
    expect(h.present).toEqual({})
    expect(paintReducer(h, { type: 'undo' }).present[at(1, 1)]).toBe('white')
    expect(paintReducer(EMPTY_HISTORY, { type: 'clear' })).toBe(EMPTY_HISTORY)
    const loaded = paintReducer(h, { type: 'load', paint: { 7: 'black' } })
    expect(loaded).toEqual({ present: { 7: 'black' }, past: [], future: [] })
  })
})
