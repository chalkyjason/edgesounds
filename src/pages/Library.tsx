import { useMemo, useState } from 'react'
import JSZip from 'jszip'
import { Download, Loader2, Search } from 'lucide-react'
import { useLibrary } from '../hooks/useLibrary'
import { SoundCard } from '../components/SoundCard'
import { useToast } from '../hooks/useToast'
import { track } from '../utils/analytics'
import type { SoundEntry } from '../types'

export function Library() {
  const lib = useLibrary()
  const { notify } = useToast()
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [zipping, setZipping] = useState(false)

  const categories = lib.state === 'loaded' ? lib.library.categories : []
  const current = categories.find((c) => c.id === activeCategory) ?? null
  const allSounds = current ? current.sounds : categories.flatMap((c) => c.sounds)
  const filtered = filterSounds(allSounds, query)

  const selectedSounds = useMemo(
    () => allSounds.filter((s) => selected.has(s.id)),
    [allSounds, selected]
  )

  if (lib.state === 'loading') {
    return <p className="text-zinc-400">Loading library…</p>
  }
  if (lib.state === 'error') {
    return <p className="text-red-400">Failed to load library: {lib.message}</p>
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const downloadZip = async (sounds: SoundEntry[], zipName: string) => {
    if (sounds.length === 0) {
      notify('Nothing to bundle.', 'info')
      return
    }
    setZipping(true)
    track('library_zip_download', { count: sounds.length, zip: zipName })
    try {
      const zip = new JSZip()
      await Promise.all(
        sounds.map(async (s) => {
          const r = await fetch(s.path)
          if (!r.ok) throw new Error(`Failed to fetch ${s.filename}`)
          zip.file(s.filename, await r.blob())
        })
      )
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = zipName
      a.click()
      URL.revokeObjectURL(url)
      notify(`${sounds.length} sounds bundled into ${zipName}`, 'success')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Zip failed', 'error')
    } finally {
      setZipping(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Library</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Pre-converted, EdgeTX-ready clips. Click play to preview, click download to grab.
          </p>
        </div>
        {selectedSounds.length > 0 && (
          <button
            onClick={() => downloadZip(selectedSounds, 'edgesounds-pack.zip')}
            disabled={zipping}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim disabled:opacity-50"
          >
            {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download {selectedSounds.length} as ZIP
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <CategoryPill
          label="All"
          active={activeCategory === null}
          onClick={() => setActiveCategory(null)}
        />
        {categories.map((c) => (
          <CategoryPill
            key={c.id}
            label={c.name}
            active={activeCategory === c.id}
            onClick={() => setActiveCategory(c.id)}
          />
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or tag…"
          className="w-full rounded-md border border-zinc-800 bg-zinc-900/60 py-2 pl-9 pr-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-accent"
        />
      </div>

      {current && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">{current.name}</h2>
              <p className="mt-1 text-sm text-zinc-400">{current.description}</p>
            </div>
            <button
              onClick={() => downloadZip(current.sounds, `${current.id}.zip`)}
              disabled={zipping || current.sounds.length === 0}
              className="flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-accent/60 hover:text-accent disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> Download category
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SoundCard
              key={s.id}
              sound={s}
              selected={selected.has(s.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-accent/60 bg-accent/10 text-accent'
          : 'border-zinc-800 bg-zinc-900/40 text-zinc-300 hover:border-zinc-600',
      ].join(' ')}
    >
      {label}
    </button>
  )
}

function EmptyState({ query }: { query: string }) {
  if (query) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center">
        <p className="text-zinc-400">No matches for "{query}".</p>
        <p className="mt-1 text-sm text-zinc-500">Try a different search or pick a category.</p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center">
      <p className="text-zinc-400">This category is empty for now.</p>
      <p className="mt-1 text-sm text-zinc-500">
        Library files get added directly to the repo. PRs welcome.
      </p>
    </div>
  )
}

function filterSounds(sounds: SoundEntry[], query: string): SoundEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return sounds
  return sounds.filter((s) => {
    if (s.displayName.toLowerCase().includes(q)) return true
    if (s.filename.toLowerCase().includes(q)) return true
    if (s.tags.some((t) => t.toLowerCase().includes(q))) return true
    return false
  })
}
