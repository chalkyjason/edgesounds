import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Eraser, Redo2, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { GlyphCanvas } from '../../components/osd/GlyphCanvas'
import { GlyphEditorCanvas } from '../../components/osd/GlyphEditorCanvas'
import { GLYPH_COUNT } from '../../lib/mcm/decode'
import { encodeFont } from '../../lib/mcm/encode'
import type { Pixel } from '../../lib/mcm/types'
import { useFont } from '../../hooks/useFont'
import { useFontEditor } from '../../hooks/useFontEditor'
import { useVariants } from '../../hooks/useVariants'
import { useToast } from '../../hooks/useToast'

const hex = (index: number) => `0x${index.toString(16).toUpperCase().padStart(2, '0')}`

const PALETTE: { value: Pixel; label: string; swatch: string }[] = [
  { value: 'white', label: 'White', swatch: 'bg-white' },
  { value: 'black', label: 'Black', swatch: 'bg-black border border-zinc-600' },
  { value: 'transparent', label: 'Clear', swatch: 'bg-zinc-800 border border-zinc-600' },
]

export function FontEditor() {
  const { variant: variantId } = useParams<{ variant: string }>()
  const variants = useVariants()
  const variant =
    variants.state === 'loaded' ? variants.variants.find((v) => v.id === variantId) : undefined
  const loaded = useFont(variant?.output)
  const base = loaded.state === 'loaded' ? loaded.font : null

  const editor = useFontEditor(base, variantId)
  const { notify } = useToast()
  const [selected, setSelected] = useState(0x41) // 'A' — something recognisable
  const [color, setColor] = useState<Pixel>('white')

  // Keyboard: undo/redo and the three paint colours.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) editor.redo()
        else editor.undo()
        return
      }
      if (event.key === '1') setColor('white')
      if (event.key === '2') setColor('black')
      if (event.key === '3') setColor('transparent')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])

  const download = useMemo(() => {
    if (!editor.font || !variant) return null
    // Re-encode only here, for a font the user has actually changed. The
    // unmodified download on the browse page still serves the original bytes.
    const text = encodeFont(editor.font)
    const blob = new Blob([text], { type: 'application/octet-stream' })
    return {
      url: URL.createObjectURL(blob),
      name: variant.output.replace(/\.mcm$/, '_edited.mcm'),
      bytes: text.length,
    }
  }, [editor.font, variant])

  useEffect(() => {
    return () => {
      if (download) URL.revokeObjectURL(download.url)
    }
  }, [download])

  if (variants.state === 'loading' || loaded.state === 'loading')
    return <p className="text-zinc-400">Loading font…</p>
  if (loaded.state === 'error') return <p className="text-red-400">{loaded.message}</p>
  if (!variant || !editor.font)
    return (
      <div className="space-y-3">
        <p className="text-red-400">No such font: {variantId}</p>
        <Link to="/osd" className="text-sm text-accent hover:underline">
          Back to the fonts
        </Link>
      </div>
    )

  // Hoisted after the guard above: TypeScript keeps the narrowing on a local
  // const, but loses it on `editor.font` inside the picker's map callback.
  const font = editor.font
  const glyph = font[selected]
  const editedCount = editor.editedIndexes.size

  return (
    <div className="space-y-6">
      <div>
        <Link
          to={`/osd/fonts/${variant.id}`}
          className="flex w-fit items-center gap-1.5 text-sm text-zinc-400 hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          {variant.id}
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-50">Glyph editor</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Edits are kept in this browser and layered over the original font — the base file is
          never modified.{' '}
          {editedCount > 0 && (
            <span className="text-accent">
              {editedCount} glyph{editedCount === 1 ? '' : 's'} changed.
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
        {/* Editor */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm text-zinc-300">
              {hex(selected)} <span className="text-zinc-600">({selected})</span>
            </span>
            {editor.editedIndexes.has(selected) && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 font-mono text-[10px] text-accent">
                edited
              </span>
            )}
          </div>

          <GlyphEditorCanvas
            glyph={glyph}
            color={color}
            onPaint={(pixelIndex, value) => editor.setPixel(selected, pixelIndex, value)}
          />

          <div className="flex flex-wrap items-center gap-1.5">
            {PALETTE.map((entry) => (
              <button
                key={entry.value}
                onClick={() => setColor(entry.value)}
                className={[
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                  color === entry.value
                    ? 'border-accent/60 bg-accent/10 text-accent'
                    : 'border-zinc-700 text-zinc-300 hover:border-zinc-500',
                ].join(' ')}
              >
                <span className={`h-3 w-3 rounded-sm ${entry.swatch}`} />
                {entry.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={editor.undo}
              disabled={!editor.canUndo}
              className="flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" /> Undo
            </button>
            <button
              onClick={editor.redo}
              disabled={!editor.canRedo}
              className="flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Redo2 className="h-3.5 w-3.5" /> Redo
            </button>
            <button
              onClick={() => editor.fillGlyph(selected, 'transparent')}
              className="flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
            >
              <Eraser className="h-3.5 w-3.5" /> Clear
            </button>
            <button
              onClick={() => editor.revertGlyph(selected)}
              className="flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Revert glyph
            </button>
          </div>

          <p className="text-[11px] leading-relaxed text-zinc-600">
            Drag to paint. <kbd className="font-mono">1</kbd>/<kbd className="font-mono">2</kbd>/
            <kbd className="font-mono">3</kbd> pick a colour,{' '}
            <kbd className="font-mono">⌘Z</kbd> undoes.
          </p>

          {download && (
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <a
                href={download.url}
                download={download.name}
                onClick={() => notify(`Downloading ${download.name}`, 'info')}
                className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim"
              >
                <Download className="h-4 w-4" />
                Download edited font
              </a>
              <p className="text-center font-mono text-[10px] text-zinc-500">
                {download.bytes.toLocaleString()} bytes
                {download.bytes === 147463 ? ' · valid' : ' · UNEXPECTED SIZE'}
              </p>
              <button
                onClick={() => {
                  void editor.discard()
                  notify('Reverted every glyph', 'info')
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:border-red-500/50 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" /> Discard all edits
              </button>
            </div>
          )}
        </div>

        {/* Picker */}
        <div>
          <h2 className="mb-2 text-sm font-medium text-zinc-300">Pick a glyph</h2>
          <div className="grid max-h-[70vh] grid-cols-[repeat(auto-fill,minmax(46px,1fr))] gap-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
            {Array.from({ length: GLYPH_COUNT }, (_, index) => (
              <button
                key={index}
                onClick={() => setSelected(index)}
                title={`${hex(index)} (${index})`}
                className={[
                  'flex flex-col items-center gap-0.5 rounded border p-1 transition-colors',
                  index === selected
                    ? 'border-accent bg-accent/10'
                    : editor.editedIndexes.has(index)
                      ? 'border-accent/40 bg-accent/5 hover:border-accent/60'
                      : 'border-zinc-800 hover:border-zinc-600',
                ].join(' ')}
              >
                <GlyphCanvas glyph={font[index]} scale={2} />
                <span className="font-mono text-[8px] leading-none text-zinc-500">
                  {hex(index)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
