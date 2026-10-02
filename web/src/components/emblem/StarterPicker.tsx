import { X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { composeLayers, createPixelCache } from '../../lib/emblem/compose'
import type { MaskSources } from '../../lib/emblem/compose'
import { STARTERS } from '../../lib/emblem/starters'
import type { Starter } from '../../lib/emblem/starters'
import { RASTER_HEIGHT, RASTER_WIDTH } from '../../lib/splash/raster'
import type { Raster } from '../../lib/splash/raster'

/** Starter emblems to begin from, each previewed as it will look. */
export function StarterPicker({
  sources,
  onPick,
  onClose,
}: {
  sources: MaskSources
  onPick: (starter: Starter) => void
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const previews = useMemo(() => {
    const pixels = createPixelCache()
    return STARTERS.map((starter) => ({
      starter,
      raster: composeLayers(starter.layers(), (layer) => pixels(layer, sources)),
    }))
  }, [sources])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Start from a starter emblem"
        className="safe-bottom flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-2xl border border-zinc-800 bg-zinc-950 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-100">Start from…</h2>
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
        <ul className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
          {previews.map(({ starter, raster }) => (
            <li key={starter.id}>
              <button
                type="button"
                onClick={() => onPick(starter)}
                className="w-full space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2 text-left hover:border-accent/50"
              >
                <Preview raster={raster} label={starter.name} />
                <span className="block px-1 text-sm text-zinc-200">{starter.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Preview({ raster, label }: { raster: Raster; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    const image = ctx.createImageData(RASTER_WIDTH, RASTER_HEIGHT)
    for (let i = 0; i < raster.length; i += 1) {
      const v = raster[i] === 'white' ? 255 : raster[i] === 'black' ? 0 : 0x7a
      image.data.set([v, v, v, 255], i * 4)
    }
    ctx.putImageData(image, 0, 0)
  }, [raster])
  return (
    <canvas
      ref={ref}
      width={RASTER_WIDTH}
      height={RASTER_HEIGHT}
      role="img"
      aria-label={`${label} preview`}
      className="block w-full rounded"
      style={{ aspectRatio: `${RASTER_WIDTH} / ${RASTER_HEIGHT}`, imageRendering: 'pixelated' }}
    />
  )
}
