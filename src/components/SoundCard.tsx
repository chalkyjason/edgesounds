import { Download } from 'lucide-react'
import type { SoundEntry } from '../types'
import { AudioPreview } from './AudioPreview'
import { useToast } from '../hooks/useToast'
import { track } from '../utils/analytics'

export function SoundCard({
  sound,
  selected,
  onToggleSelect,
}: {
  sound: SoundEntry
  selected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const { notify } = useToast()
  const selectable = !!onToggleSelect

  const handleDownload = () => {
    track('library_download', { id: sound.id })
    notify(`Downloading ${sound.filename}`, 'info')
  }

  return (
    <div
      className={[
        'group relative flex flex-col gap-3 rounded-lg border p-4 transition-colors',
        selected
          ? 'border-accent/60 bg-accent/5'
          : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700',
      ].join(' ')}
    >
      {selectable && (
        <label className="absolute right-3 top-3 flex cursor-pointer items-center">
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onToggleSelect?.(sound.id)}
            className="h-4 w-4 cursor-pointer accent-accent"
            aria-label={`Select ${sound.displayName}`}
          />
        </label>
      )}

      <div className="flex items-start gap-3 pr-8">
        <AudioPreview src={sound.path} id={sound.id} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-100">{sound.displayName}</div>
          <div className="mt-0.5 font-mono text-xs text-zinc-500">{sound.filename}</div>
        </div>
      </div>

      {sound.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sound.tags.slice(0, 5).map((t) => (
            <span
              key={t}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-zinc-500">
        {sound.credit && <span className="truncate">{sound.credit}</span>}
        <a
          href={sound.path}
          download={sound.filename}
          onClick={handleDownload}
          className="ml-auto flex items-center gap-1 rounded border border-zinc-800 px-2 py-1 text-zinc-300 hover:border-accent/50 hover:text-accent"
        >
          <Download className="h-3.5 w-3.5" />
          <span>WAV</span>
        </a>
      </div>
    </div>
  )
}
