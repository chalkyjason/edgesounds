import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useFont } from '../../hooks/useFont'
import { useVariants } from '../../hooks/useVariants'
import { encodeFont } from '../../lib/mcm/encode'
import { fontWithSplash, splashPng } from '../../lib/splash/compose'
import { isRasterEmpty } from '../../lib/splash/raster'
import type { Raster } from '../../lib/splash/raster'
import { SaveLink } from '../SaveLink'
import { isNativeApp } from '../../platform/platform'
import { STOCK_BASE } from '../../lib/splash/bases'
import type { ExportBase } from '../../lib/splash/bases'

const EXPORT_DEBOUNCE_MS = 250

interface Exports {
  droppedReservedInk: boolean
  bytes: number
  name: string
  mcmUrl: string
  pngUrl: string
}

const BUTTON =
  'flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40'

/** Pick a base font, get it back with the start screen in its splash block -- or the PNG alone. */
export function ExportPanel({ raster }: { raster: Raster }) {
  const variants = useVariants()
  const bases = useMemo<ExportBase[]>(
    () => [
      ...(variants.state === 'loaded'
        ? variants.variants.map((v) => ({ id: v.id, output: v.output, label: v.id }))
        : []),
      // Betaflight's font is GPL-3.0, which the App Store's terms are widely
      // held to conflict with, so the app doesn't ship it (see prepare-ios).
      ...(isNativeApp() ? [] : [STOCK_BASE]),
    ],
    [variants],
  )
  const [baseId, setBaseId] = useState<string>('armyjay_full')
  const base = bases.find((b) => b.id === baseId) ?? bases[0]
  const loaded = useFont(base?.output)
  const empty = isRasterEmpty(raster)

  // Both downloads are rebuilt in one debounced effect rather than on every
  // raster change: a paint drag emits dozens of rasters a second, and encoding
  // a whole font plus a PNG for each would make the stroke stutter. The object
  // URLs are created and revoked here too, never in render.
  const [exports, setExports] = useState<Exports | null>(null)
  useEffect(() => {
    if (loaded.state !== 'loaded' || empty || !base) {
      const timer = setTimeout(() => setExports(null), 0)
      return () => clearTimeout(timer)
    }
    const font = loaded.font
    const timer = setTimeout(() => {
      const { font: composedFont, droppedReservedInk } = fontWithSplash(font, raster)
      const text = encodeFont(composedFont)
      setExports({
        droppedReservedInk,
        bytes: text.length,
        name: `${base.id}_splash.mcm`,
        mcmUrl: URL.createObjectURL(new Blob([text], { type: 'application/octet-stream' })),
        pngUrl: URL.createObjectURL(new Blob([splashPng(raster)], { type: 'image/png' })),
      })
    }, EXPORT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [loaded, raster, empty, base])

  useEffect(() => {
    return () => {
      if (exports) {
        URL.revokeObjectURL(exports.mcmUrl)
        URL.revokeObjectURL(exports.pngUrl)
      }
    }
  }, [exports])

  const composed = exports
  const png = exports?.pngUrl ?? null

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <h2 className="text-sm font-medium text-zinc-100">Export</h2>
      <label className="block text-sm text-zinc-300">
        Base font
        <select
          value={base?.id ?? ''}
          onChange={(event) => setBaseId(event.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
        >
          {bases.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      {base?.note && <p className="text-xs text-zinc-500">{base.note}</p>}
      {loaded.state === 'error' && <p className="text-sm text-red-400">{loaded.message}</p>}

      {empty && <p className="text-sm text-zinc-500">The start screen is empty — nothing to export yet.</p>}
      {composed?.droppedReservedInk && (
        <p className="text-sm text-amber-400">
          The bottom-right tile has ink. It is 0xFF, the end-of-font marker, so it will not be
          written — move the artwork up or left.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {composed ? (
          <SaveLink
            href={composed.mcmUrl}
            filename={composed.name}
            className={`${BUTTON} bg-accent text-zinc-950 hover:bg-accent-dim`}
          >
            <Download className="h-4 w-4" /> Download {composed.name}
          </SaveLink>
        ) : (
          <button type="button" disabled className={`${BUTTON} bg-accent text-zinc-950`}>
            <Download className="h-4 w-4" /> Download .mcm
          </button>
        )}
        {png ? (
          <SaveLink
            href={png}
            filename="start_screen.png"
            className={`${BUTTON} border border-zinc-700 text-zinc-300 hover:border-accent/50 hover:text-accent`}
          >
            <Download className="h-4 w-4" /> PNG for Configurator
          </SaveLink>
        ) : (
          <button
            type="button"
            disabled
            className={`${BUTTON} border border-zinc-700 text-zinc-300`}
          >
            <Download className="h-4 w-4" /> PNG for Configurator
          </button>
        )}
      </div>
      {composed && (
        <p className="font-mono text-[10px] text-zinc-500">
          {composed.bytes.toLocaleString()} bytes
          {composed.bytes === 147463 ? ' · valid' : ' · UNEXPECTED SIZE'}
        </p>
      )}
    </div>
  )
}
