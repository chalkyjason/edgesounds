import { describe, expect, it } from 'vitest'
import { beginStroke, endStroke, initialHistory, linePoints, record, redo, undo } from '../history'

describe('history', () => {
  it('records each change outside a stroke as its own step', () => {
    let h = initialHistory(0)
    h = record(h, 1)
    h = record(h, 2)
    expect(h.past).toEqual([0, 1])
  })

  it('folds a whole stroke into one undo step', () => {
    let h = record(initialHistory(0), 1)
    h = beginStroke(h)
    for (const n of [2, 3, 4, 5]) h = record(h, n)
    h = endStroke(h)
    expect(h.present).toBe(5)
    expect(h.past).toEqual([0, 1])
    expect(undo(h).present).toBe(1)
  })

  it('records nothing for a stroke that changed nothing', () => {
    const h = endStroke(beginStroke(record(initialHistory(0), 1)))
    expect(h).toEqual({ present: 1, past: [0], future: [] })
  })

  it('starts a fresh step for the next stroke', () => {
    let h = initialHistory(0)
    h = endStroke(record(record(beginStroke(h), 1), 2))
    h = endStroke(record(record(beginStroke(h), 3), 4))
    expect(h.past).toEqual([0, 2])
    expect(undo(undo(h)).present).toBe(0)
  })

  it('clears the redo stack when a stroke records', () => {
    let h = undo(record(initialHistory(0), 1))
    expect(h.future).toEqual([1])
    h = record(beginStroke(h), 9)
    expect(h.future).toEqual([])
  })

  it('undoes and redoes, and does nothing at either end', () => {
    const h = record(initialHistory('a'), 'b')
    expect(redo(undo(h)).present).toBe('b')
    const empty = initialHistory('a')
    expect(undo(empty)).toBe(empty)
    expect(redo(empty)).toBe(empty)
  })
})

describe('linePoints', () => {
  it('fills every cell between two points', () => {
    expect(linePoints(0, 0, 4, 0)).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]])
    expect(linePoints(0, 0, 2, 2)).toEqual([[0, 0], [1, 1], [2, 2]])
    expect(linePoints(3, 1, 0, 0)).toEqual([[3, 1], [2, 1], [1, 0], [0, 0]])
  })

  it('is the one cell when both ends are the same', () => {
    expect(linePoints(5, 5, 5, 5)).toEqual([[5, 5]])
  })

  it('leaves no gap on a steep line', () => {
    const points = linePoints(0, 0, 1, 6)
    expect(points).toHaveLength(7)
    for (let i = 1; i < points.length; i += 1) {
      expect(Math.abs(points[i][0] - points[i - 1][0])).toBeLessThanOrEqual(1)
      expect(Math.abs(points[i][1] - points[i - 1][1])).toBeLessThanOrEqual(1)
    }
  })
})
