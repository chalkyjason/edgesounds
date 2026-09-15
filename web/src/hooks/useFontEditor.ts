import { useCallback, useEffect, useMemo, useState } from 'react'
import { PIXELS_PER_GLYPH } from '../lib/mcm/decode'
import type { Font, Pixel } from '../lib/mcm/types'
import { clearEdit, loadEdit, saveEdit } from '../utils/fontStorage'

export type EditMap = Record<number, Pixel[]>

interface History {
  present: EditMap
  past: EditMap[]
  future: EditMap[]
}

const EMPTY: History = { present: {}, past: [], future: [] }
const MAX_HISTORY = 100

function push(history: History, next: EditMap): History {
  return {
    present: next,
    past: [...history.past, history.present].slice(-MAX_HISTORY),
    future: [],
  }
}

/**
 * Editing state for one font, layered over an immutable base.
 *
 * The base font is never mutated: edits are a sparse map of glyph index to a
 * replacement pixel array. That keeps what gets persisted small, and means a
 * rebuilt base font shows through for every glyph the user has not touched.
 *
 * Undo history lives in state rather than a ref because the toolbar reads its
 * depth during render, and a ref read during render neither triggers a
 * re-render nor is safe to do. It is deliberately not persisted: restoring a
 * half-populated redo stack across reloads is worse than starting clean.
 */
export function useFontEditor(base: Font | null, variantId: string | undefined) {
  const [history, setHistory] = useState<History>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const edits = history.present

  useEffect(() => {
    if (!variantId) return
    let cancelled = false
    void (async () => {
      try {
        const saved = await loadEdit(variantId)
        if (!cancelled) setHistory({ present: saved?.edits ?? {}, past: [], future: [] })
      } catch (error) {
        console.warn('[useFontEditor] could not load saved edits', error)
        if (!cancelled) setHistory(EMPTY)
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [variantId])

  /** The base font with edits applied. */
  const font = useMemo<Font | null>(() => {
    if (!base) return null
    const indexes = Object.keys(edits)
    if (indexes.length === 0) return base
    const next = base.slice()
    for (const key of indexes) next[Number(key)] = { pixels: edits[Number(key)] }
    return next
  }, [base, edits])

  const setPixel = useCallback(
    (glyphIndex: number, pixelIndex: number, value: Pixel) => {
      if (!base) return
      setHistory((current) => {
        const existing = current.present[glyphIndex] ?? base[glyphIndex].pixels
        if (existing[pixelIndex] === value) return current
        const pixels = existing.slice()
        pixels[pixelIndex] = value
        return push(current, { ...current.present, [glyphIndex]: pixels })
      })
    },
    [base],
  )

  const fillGlyph = useCallback((glyphIndex: number, value: Pixel) => {
    setHistory((current) =>
      push(current, {
        ...current.present,
        [glyphIndex]: Array<Pixel>(PIXELS_PER_GLYPH).fill(value),
      }),
    )
  }, [])

  const revertGlyph = useCallback((glyphIndex: number) => {
    setHistory((current) => {
      if (!(glyphIndex in current.present)) return current
      const next = { ...current.present }
      delete next[glyphIndex]
      return push(current, next)
    })
  }, [])

  /** Apply many glyph overrides at once, as one undoable step. */
  const applyEdits = useCallback((incoming: EditMap) => {
    setHistory((current) => push(current, { ...current.present, ...incoming }))
  }, [])

  const revertAll = useCallback(() => {
    setHistory((current) =>
      Object.keys(current.present).length === 0 ? current : push(current, {}),
    )
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => {
      if (current.past.length === 0) return current
      const previous = current.past[current.past.length - 1]
      return {
        present: previous,
        past: current.past.slice(0, -1),
        future: [current.present, ...current.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => {
      if (current.future.length === 0) return current
      const [next, ...rest] = current.future
      return { present: next, past: [...current.past, current.present], future: rest }
    })
  }, [])

  // Persist on change, once the initial load has settled so we never write {}
  // over a saved edit before it has been read back.
  useEffect(() => {
    if (!variantId || !loaded) return
    const handle = setTimeout(() => {
      void saveEdit(variantId, edits).catch((error) =>
        console.warn('[useFontEditor] could not save edits', error),
      )
    }, 400)
    return () => clearTimeout(handle)
  }, [edits, loaded, variantId])

  const discard = useCallback(async () => {
    if (!variantId) return
    await clearEdit(variantId)
    setHistory(EMPTY)
  }, [variantId])

  return {
    font,
    edits,
    editedIndexes: useMemo(() => new Set(Object.keys(edits).map(Number)), [edits]),
    setPixel,
    fillGlyph,
    applyEdits,
    revertGlyph,
    revertAll,
    undo,
    redo,
    discard,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
