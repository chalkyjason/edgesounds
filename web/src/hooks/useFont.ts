import { useEffect, useState } from 'react'
import { McmParseError, decodeFont } from '../lib/mcm/decode'
import type { Font } from '../lib/mcm/types'

type State =
  | { state: 'loading' }
  | { state: 'loaded'; font: Font; text: string }
  | { state: 'error'; message: string }

/**
 * Fetch a .mcm and decode it.
 *
 * The raw text is kept alongside the parsed font so a download can serve the
 * exact bytes that were fetched rather than a re-encode -- what a pilot
 * flashes should be the file CI verified, byte for byte.
 *
 * State is stored tagged with the filename it belongs to, so "loading" and
 * "no font specified" are derived during render rather than written from the
 * effect. That keeps setState confined to the async callbacks and avoids the
 * cascading render the effect-body form causes.
 */
export function useFont(filename: string | undefined): State {
  const [result, setResult] = useState<{ filename: string; value: State } | null>(null)

  useEffect(() => {
    if (!filename) return
    let cancelled = false

    fetch(`/osd/fonts/${filename}`, { cache: 'no-cache' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed to fetch ${filename}: ${response.status}`)
        const text = await response.text()
        return { font: decodeFont(text), text }
      })
      .then(({ font, text }) => {
        if (!cancelled) setResult({ filename, value: { state: 'loaded', font, text } })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message =
          error instanceof McmParseError
            ? `${filename} is not a valid MAX7456 font — ${error.message}`
            : error instanceof Error
              ? error.message
              : 'Failed to load font'
        setResult({ filename, value: { state: 'error', message } })
      })

    return () => {
      cancelled = true
    }
  }, [filename])

  if (!filename) return { state: 'error', message: 'No font specified.' }
  if (!result || result.filename !== filename) return { state: 'loading' }
  return result.value
}
