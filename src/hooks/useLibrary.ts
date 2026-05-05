import { useEffect, useState } from 'react'
import type { Library } from '../types'

type State =
  | { state: 'loading' }
  | { state: 'loaded'; library: Library }
  | { state: 'error'; message: string }

export function useLibrary() {
  const [state, setState] = useState<State>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/library.json', { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch library: ${r.status}`)
        return r.json() as Promise<Library>
      })
      .then((library) => {
        if (!cancelled) setState({ state: 'loaded', library })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : 'Failed to load library'
          setState({ state: 'error', message })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
