import { useEffect, useState } from 'react'
import type { OsdVariant } from '../types/osd'

type State =
  | { state: 'loading' }
  | { state: 'loaded'; variants: OsdVariant[] }
  | { state: 'error'; message: string }

// One fetch per page load, shared by every caller: the nav, each OSD page
// and the start screen's export panel all want the same small file.
let pending: Promise<OsdVariant[]> | null = null
let loaded: OsdVariant[] | null = null

/** Fetch public/osd/variants.json once; a failure is not cached, so the next call retries. */
export function loadVariants(): Promise<OsdVariant[]> {
  pending ??= fetch('/osd/variants.json', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`Failed to fetch variants: ${response.status}`)
      return response.json() as Promise<OsdVariant[]>
    })
    .then((variants) => (loaded = variants))
    .catch((error: unknown) => {
      pending = null
      throw error
    })
  return pending
}

/** Forget the cached list. For tests. */
export function resetVariantsCache(): void {
  pending = null
  loaded = null
}

/** Load public/osd/variants.json, derived from variants.toml at build time. */
export function useVariants(): State {
  const [state, setState] = useState<State>(() =>
    loaded ? { state: 'loaded', variants: loaded } : { state: 'loading' },
  )

  useEffect(() => {
    // Not skipped when the list is cached: it may have arrived between this
    // component's first render and now. A cached load resolves at once.
    let cancelled = false
    loadVariants()
      .then((variants) => {
        if (!cancelled) setState({ state: 'loaded', variants })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            state: 'error',
            message: error instanceof Error ? error.message : 'Failed to load variants',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
