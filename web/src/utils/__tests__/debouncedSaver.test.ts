import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncedSaver } from '../debouncedSaver'

describe('createDebouncedSaver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves only the latest value once things go quiet', () => {
    const save = vi.fn()
    const saver = createDebouncedSaver(save, 400)
    saver.schedule('a')
    vi.advanceTimersByTime(300)
    saver.schedule('b')
    vi.advanceTimersByTime(399)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save).toHaveBeenCalledExactlyOnceWith('b')
  })

  it('writes a pending value straight away on flush, and only once', () => {
    const save = vi.fn()
    const saver = createDebouncedSaver(save, 400)
    saver.schedule('last stroke')
    saver.flush()
    expect(save).toHaveBeenCalledExactlyOnceWith('last stroke')
    vi.runAllTimers()
    saver.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('does nothing on flush when there is nothing pending', () => {
    const save = vi.fn()
    createDebouncedSaver(save, 400).flush()
    expect(save).not.toHaveBeenCalled()
  })

  it('drops a pending value on cancel', () => {
    const save = vi.fn()
    const saver = createDebouncedSaver(save, 400)
    saver.schedule('a')
    saver.cancel()
    vi.runAllTimers()
    saver.flush()
    expect(save).not.toHaveBeenCalled()
  })
})
