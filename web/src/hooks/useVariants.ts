import { useEffect, useState } from 'react'
import type { OsdVariant } from '../types/osd'

type State =
  | { state: 'loading' }
  | { state: 'loaded'; variants: OsdVariant[] }
  | { state: 'error'; message: string }

/** Load public/osd/variants.json, derived from variants.toml at build time. */
export function useVariants(): State {
  const [state, setState] = useState<State>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/osd/variants.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch variants: ${response.status}`)
        return response.json() as Promise<OsdVariant[]>
      })
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
