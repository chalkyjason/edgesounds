import { useEffect, useState } from 'react'
import { validateStencils } from '../lib/splash/stencils'
import type { Stencils } from '../lib/splash/stencils'

type State =
  | { state: 'loading' }
  | { state: 'loaded'; stencils: Stencils }
  | { state: 'error'; message: string }

/** Load /osd/stencils.json, staged from assets/splash_stencils.json at build time. */
export function useStencils(): State {
  const [state, setState] = useState<State>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    fetch('/osd/stencils.json', { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to fetch stencils: ${response.status}`)
        return response.json()
      })
      .then((data: unknown) => {
        if (!cancelled) setState({ state: 'loaded', stencils: validateStencils(data) })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            state: 'error',
            message: error instanceof Error ? error.message : 'Failed to load stencils',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
