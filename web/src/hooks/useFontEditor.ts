import { useCallback, useEffect, useMemo, useState } from 'react'
import { PIXELS_PER_GLYPH } from '../lib/mcm/decode'
import type { Font, Pixel } from '../lib/mcm/types'
import {
  beginStroke as begin,
  endStroke as end,
  initialHistory,
  record,
  redo as redoStep,
  undo as undoStep,
} from '../lib/history'
import type { History } from '../lib/history'
import { loadEdit, saveEdit } from '../utils/fontStorage'
import { useDebouncedSave } from './useDebouncedSave'

export type EditMap = Record<number, Pixel[]>

type EditHistory = History<EditMap>

const EMPTY: EditHistory = initialHistory({})
const SAVE_DEBOUNCE_MS = 400

function persist(pending: { variantId: string; edits: EditMap } | null) {
  if (!pending) return
  void saveEdit(pending.variantId, pending.edits).catch((error) =>
    console.warn('[useFontEditor] could not save edits', error),
  )
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
  const [history, setHistory] = useState<EditHistory>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const edits = history.present

  useEffect(() => {
    if (!variantId) return
    let cancelled = false
    void (async () => {
      try {
        const saved = await loadEdit(variantId)
        if (!cancelled) setHistory(initialHistory(saved?.edits ?? {}))
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
        return record(current, { ...current.present, [glyphIndex]: pixels })
      })
    },
    [base],
  )

  const fillGlyph = useCallback((glyphIndex: number, value: Pixel) => {
    setHistory((current) =>
      record(end(current), {
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
      return record(end(current), next)
    })
  }, [])

  /** Apply many glyph overrides at once, as one undoable step. */
  const applyEdits = useCallback((incoming: EditMap) => {
    setHistory((current) => record(end(current), { ...current.present, ...incoming }))
  }, [])

  const revertAll = useCallback(() => {
    setHistory((current) =>
      Object.keys(current.present).length === 0 ? current : record(end(current), {}),
    )
  }, [])

  /** Bracket a drag so it becomes one undo step. */
  const beginStroke = useCallback(() => setHistory(begin), [])
  const endStroke = useCallback(() => setHistory(end), [])
  const undo = useCallback(() => setHistory((current) => undoStep(end(current))), [])
  const redo = useCallback(() => setHistory((current) => redoStep(end(current))), [])

  // Persist on change, once the initial load has settled so we never write {}
  // over a saved edit before it has been read back.
  const pending = useMemo(() => (variantId ? { variantId, edits } : null), [variantId, edits])
  useDebouncedSave(pending, Boolean(pending) && loaded, persist, SAVE_DEBOUNCE_MS)

  return {
    font,
    edits,
    editedIndexes: useMemo(() => new Set(Object.keys(edits).map(Number)), [edits]),
    setPixel,
    fillGlyph,
    applyEdits,
    revertGlyph,
    revertAll,
    beginStroke,
    endStroke,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
