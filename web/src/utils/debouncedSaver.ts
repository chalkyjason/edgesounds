export interface DebouncedSaver<T> {
  /** Save `value` once `delayMs` pass with no newer value. */
  schedule(value: T): void
  /** Save the pending value now, if there is one. */
  flush(): void
  /** Drop the pending value unsaved. */
  cancel(): void
}

/**
 * A debounce that can be flushed. Leaving a page cancels its timers, so a
 * plain debounce loses whatever changed in the last `delayMs` -- the last
 * stroke before clicking away. Flushing on unmount and pagehide keeps it.
 */
export function createDebouncedSaver<T>(save: (value: T) => void, delayMs: number): DebouncedSaver<T> {
  let pending: { value: T } | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    pending = null
  }
  const flush = () => {
    const current = pending
    cancel()
    if (current) save(current.value)
  }
  const schedule = (value: T) => {
    if (timer !== null) clearTimeout(timer)
    pending = { value }
    timer = setTimeout(flush, delayMs)
  }
  return { schedule, flush, cancel }
}
