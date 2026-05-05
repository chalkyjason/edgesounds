import { useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { Download, Pause, Play, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMySounds } from '../hooks/useMySounds'
import { useToast } from '../hooks/useToast'
import { formatBytes, formatDuration } from '../utils/validateAudio'
import { MAX_ENTRIES } from '../utils/mySoundsStorage'

export function MySounds() {
  const { sounds, loading, remove, clearAll } = useMySounds()
  const { notify } = useToast()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [zipping, setZipping] = useState(false)

  // Build short-lived object URLs for each blob; revoke when sounds change
  const urls = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sounds) map.set(s.id, URL.createObjectURL(s.blob))
    return map
  }, [sounds])

  useEffect(() => {
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url)
    }
  }, [urls])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    const onEnded = () => setPlayingId(null)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audioRef.current = null
    }
  }, [])

  const togglePlay = (id: string) => {
    const audio = audioRef.current
    if (!audio) return
    if (playingId === id) {
      audio.pause()
      setPlayingId(null)
      return
    }
    const url = urls.get(id)
    if (!url) return
    if (audio.src !== url) audio.src = url
    void audio.play()
    setPlayingId(id)
  }

  const handleRemove = async (id: string, name: string) => {
    if (playingId === id) {
      audioRef.current?.pause()
      setPlayingId(null)
    }
    await remove(id)
    notify(`Removed ${name}`, 'info')
  }

  const handleClear = async () => {
    if (!confirm(`Remove all ${sounds.length} saved sounds? This can't be undone.`)) return
    audioRef.current?.pause()
    setPlayingId(null)
    await clearAll()
    notify('Cleared all saved sounds', 'info')
  }

  const downloadAll = async () => {
    if (sounds.length === 0) return
    setZipping(true)
    try {
      const zip = new JSZip()
      // Build SD-card layout: bare files in /SOUNDS/<lang>/ — flat zip is fine
      for (const s of sounds) zip.file(s.filename, s.blob)
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'my-edgesounds.zip'
      a.click()
      URL.revokeObjectURL(url)
      notify(`Bundled ${sounds.length} sounds into my-edgesounds.zip`, 'success')
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Zip failed', 'error')
    } finally {
      setZipping(false)
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Loading your sounds…</p>
  }

  if (sounds.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-100">My Sounds</h1>
        <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center">
          <p className="text-zinc-300">Nothing saved yet.</p>
          <p className="mt-1 text-sm text-zinc-400">
            Every clip you convert is automatically tucked away here for later. Stays on this device — nothing leaves your browser.
          </p>
          <Link
            to="/convert"
            className="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim"
          >
            Convert your first sound
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">My Sounds</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {sounds.length} of {MAX_ENTRIES} saved on this device. Oldest gets evicted when full. Nothing leaves your browser.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadAll}
            disabled={zipping}
            className="flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download all as ZIP
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-500/60 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </button>
        </div>
      </div>

      <ul className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
        {sounds.map((s) => {
          const url = urls.get(s.id)
          const playing = playingId === s.id
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <button
                onClick={() => togglePlay(s.id)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/5 text-accent hover:border-accent/60 hover:bg-accent/15"
                aria-label={playing ? 'Pause' : 'Play'}
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-100">
                  {s.displayName}
                </div>
                <div className="mt-0.5 font-mono text-xs text-zinc-400">
                  {s.filename} · {formatDuration(s.duration)} · {formatBytes(s.sizeBytes)} · saved {formatRelative(s.savedAt)}
                </div>
              </div>
              {url && (
                <a
                  href={url}
                  download={s.filename}
                  className="flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-accent/50 hover:text-accent"
                >
                  <Download className="h-3.5 w-3.5" />
                  WAV
                </a>
              )}
              <button
                onClick={() => handleRemove(s.id, s.displayName)}
                className="flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-red-500/60 hover:text-red-400"
                aria-label={`Remove ${s.displayName}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function formatRelative(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (diffSec < 60) return 'just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  const days = Math.floor(diffSec / 86400)
  if (days < 30) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}
