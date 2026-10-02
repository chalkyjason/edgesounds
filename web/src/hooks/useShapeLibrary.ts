import { useCallback, useEffect, useState } from 'react'
import type { ShapeLibrary } from '../lib/emblem/types'

type State =
  | { state: 'loading' }
  | { state: 'loaded'; library: ShapeLibrary; byId: Map<string, ShapeLibrary['shapes'][number]> }
  | { state: 'error'; message: string }

// One fetch per page load, shared by the start screen and the Credits page.
let pending: Promise<ShapeLibrary> | null = null

export function loadShapeLibrary(): Promise<ShapeLibrary> {
  pending ??= fetch('/osd/shapes.json', { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(`Couldn't load the shape library (${response.status})`)
      return response.json() as Promise<ShapeLibrary>
    })
    .catch((error: unknown) => {
      pending = null
      throw error
    })
  return pending
}

/** The shape library, with a retry for when it failed to load. */
export function useShapeLibrary(): State & { retry: () => void } {
  const [state, setState] = useState<State>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadShapeLibrary()
      .then((library) => {
        if (!cancelled) setState({ state: 'loaded', library, byId: new Map(library.shapes.map((s) => [s.id, s])) })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ state: 'error', message: error instanceof Error ? error.message : String(error) })
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ state: 'loading' })
    setAttempt((n) => n + 1)
  }, [])
  return { ...state, retry }
}
