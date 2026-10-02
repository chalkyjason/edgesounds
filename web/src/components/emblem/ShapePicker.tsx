import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ShapeLibrary } from '../../lib/emblem/types'
import { ShapeThumb } from './ShapeThumb'

/**
 * The shape library as a sheet over the page: pack tabs, a search, and a
 * grid of shapes. Picking one calls `onPick` and closes.
 */
export function ShapePicker({
  library,
  title,
  onPick,
  onClose,
}: {
  library: ShapeLibrary
  title: string
  onPick: (shapeId: string) => void
  onClose: () => void
}) {
  const [pack, setPack] = useState(library.packs[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    // A search looks across every pack; otherwise, the chosen pack.
    return library.shapes.filter((s) => (q ? s.name.toLowerCase().includes(q) : s.pack === pack))
  }, [library, pack, query])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="safe-bottom flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-2xl border border-zinc-800 bg-zinc-950 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="touch-target rounded-md p-1.5 text-zinc-400 hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-4 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search all shapes…"
              aria-label="Search shapes"
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-2 pl-8 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-accent"
            />
          </div>
          {!query.trim() && (
            <div role="tablist" aria-label="Packs" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
              {library.packs.map((p) => (
                <button
                  key={p.id}
                  role="tab"
                  type="button"
                  aria-selected={pack === p.id}
                  onClick={() => setPack(p.id)}
                  className={[
                    'shrink-0 rounded-md px-3 py-1.5 text-sm',
                    pack === p.id ? 'bg-accent/10 text-accent' : 'text-zinc-400 hover:text-zinc-100',
                  ].join(' ')}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">No shapes match “{query.trim()}”.</p>
          ) : (
            <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {shown.map((shape) => (
                <li key={shape.id}>
                  <button
                    type="button"
                    onClick={() => onPick(shape.id)}
                    className="flex w-full flex-col items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-zinc-100 hover:border-accent/50"
                  >
                    <ShapeThumb shape={shape} className="h-12 w-12" />
                    <span className="line-clamp-2 text-center text-[11px] leading-tight text-zinc-400">{shape.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
