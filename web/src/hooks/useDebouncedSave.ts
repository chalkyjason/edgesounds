import { useEffect, useState } from 'react'
import { createDebouncedSaver } from '../utils/debouncedSaver'

/**
 * Save `value` after it has been still for `delayMs`, while `enabled`. A
 * pending save is written immediately when the component unmounts or the
 * page is hidden, rather than dropped.
 *
 * `save` is captured on the first render, so pass a stable function.
 */
export function useDebouncedSave<T>(
  value: T,
  enabled: boolean,
  save: (value: T) => void,
  delayMs: number,
): void {
  const [saver] = useState(() => createDebouncedSaver(save, delayMs))

  useEffect(() => {
    if (enabled) saver.schedule(value)
    else saver.cancel()
  }, [saver, value, enabled])

  useEffect(() => {
    const flush = () => saver.flush()
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [saver])
}
