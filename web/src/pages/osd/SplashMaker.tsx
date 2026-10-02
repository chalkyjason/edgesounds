import { Eraser, Layers, Paintbrush, Plus, Redo2, Shapes, Sparkles, Trash2, Type, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EmblemCanvas } from '../../components/emblem/EmblemCanvas'
import { LayerControls } from '../../components/emblem/LayerControls'
import { LayerList } from '../../components/emblem/LayerList'
import { ShapePicker } from '../../components/emblem/ShapePicker'
import { StarterPicker } from '../../components/emblem/StarterPicker'
import { PALETTE } from '../../components/osd/palette'
import { ExportPanel } from '../../components/splash/ExportPanel'
import { PaintCanvas } from '../../components/splash/PaintCanvas'
import type { BrushSize } from '../../components/splash/PaintCanvas'
import { SplashPreview } from '../../components/splash/SplashPreview'
import { useSplashDesign } from '../../hooks/useSplashDesign'
import { useStencils } from '../../hooks/useStencils'
import { useToast } from '../../hooks/useToast'
import { MAX_LAYERS } from '../../lib/emblem/types'
import type { Pixel } from '../../lib/mcm/types'
import { ACCEPTED_IMAGE_TYPES, checkImageFile } from '../../lib/splash/image'
import { isNativeApp } from '../../platform/platform'

type Tab = 'layers' | 'paint'
type Sheet = null | { kind: 'add-shape' } | { kind: 'change-shape'; id: string } | { kind: 'starters' }

const TOOLBAR =
  'flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40'
const ADD =
  'flex flex-1 items-center justify-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'

export function SplashMaker() {
  const stencils = useStencils()
  const editor = useSplashDesign(stencils.state === 'loaded' ? stencils.stencils : null)
  const { notify } = useToast()
  const [tab, setTab] = useState<Tab>('layers')
  const [sheet, setSheet] = useState<Sheet>(null)
  const [color, setColor] = useState<Pixel>('white')
  const [size, setSize] = useState<BrushSize>(1)
  const [rejected, setRejected] = useState<string | null>(null)
  const library = editor.library
  const hasImageLayer = editor.layers.some((l) => l.kind === 'image')

  const chooseImage = (file: File | undefined) => {
    if (!file) return
    const problem = checkImageFile(file)
    setRejected(problem)
    if (!problem) editor.setImageFile(file)
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/osd" className="touch-target text-sm text-zinc-400 hover:text-accent">
          ← OSD fonts
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">Start screen</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          The 288×72 splash Betaflight shows at boot. Build it from layers — shapes, text and a
          picture — then touch it up with paint and export a font with it in —{' '}
          {isNativeApp()
            ? 'one of the Army Jay variants.'
            : "one of the Army Jay variants, or Betaflight's default font with only the splash swapped."}
        </p>
        {editor.storage === 'unavailable' && (
          <p className="mt-2 text-xs text-amber-400">The design can't be saved here, so it will be gone on reload.</p>
        )}
      </div>

      {tab === 'layers' ? (
        // On a phone the controls are below the fold: keep the screen in view
        // under the nav while they scroll. A child of the page, so it sticks
        // for the page's whole length.
        <div
          className="sticky z-20 -mx-4 bg-zinc-950/95 px-4 py-2 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:p-0"
          style={{ top: 'var(--nav-height, 0px)' }}
        >
          <EmblemCanvas editor={editor} />
        </div>
      ) : (
        <div className="min-w-0">
          <PaintCanvas
            raster={editor.raster}
            color={color}
            size={size}
            onStroke={editor.stroke}
            onStrokeStart={editor.beginStroke}
            onStrokeEnd={editor.endStroke}
          />
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Start screen tools" className="flex gap-1 rounded-md bg-zinc-900/60 p-1">
            {(
              [
                ['layers', 'Layers', Layers],
                ['paint', 'Paint', Paintbrush],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={[
                  'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors',
                  tab === id ? 'bg-accent/10 text-accent' : 'text-zinc-400 hover:text-zinc-100',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={editor.undo} disabled={!editor.canUndo} className={TOOLBAR}>
            <Undo2 className="h-3.5 w-3.5" /> Undo
          </button>
          <button type="button" onClick={editor.redo} disabled={!editor.canRedo} className={TOOLBAR}>
            <Redo2 className="h-3.5 w-3.5" /> Redo
          </button>
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => setSheet({ kind: 'starters' })}
              disabled={library.state !== 'loaded' || stencils.state !== 'loaded'}
              className={TOOLBAR}
            >
              <Sparkles className="h-3.5 w-3.5" /> Starters
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm("Start over? This clears every layer, the image and the paint, and can't be undone.")) return
                void editor.reset()
                notify('Started over', 'info')
              }}
              className={TOOLBAR}
            >
              <Trash2 className="h-3.5 w-3.5" /> Start over
            </button>
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          {tab === 'layers' ? (
            <>
              {library.state === 'error' && (
                <p className="text-sm text-red-400">
                  {library.message}{' '}
                  <button type="button" onClick={library.retry} className="underline">
                    Try again
                  </button>
                </p>
              )}
              {stencils.state === 'error' && <p className="text-sm text-red-400">{stencils.message}</p>}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={ADD}
                    disabled={!editor.canAdd || library.state !== 'loaded'}
                    onClick={() => setSheet({ kind: 'add-shape' })}
                  >
                    <Shapes className="h-4 w-4" /> Shape
                  </button>
                  <button type="button" className={ADD} disabled={!editor.canAdd} onClick={() => editor.addText('big')}>
                    <Type className="h-4 w-4" /> Text
                  </button>
                  <label
                    className={`${ADD} cursor-pointer ${!editor.canAdd && !hasImageLayer ? 'pointer-events-none opacity-40' : ''}`}
                  >
                    <Plus className="h-4 w-4" /> {hasImageLayer ? 'New image' : 'Image'}
                    <input
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(',')}
                      className="sr-only"
                      onChange={(event) => {
                        chooseImage(event.target.files?.[0])
                        event.target.value = ''
                      }}
                    />
                  </label>
                </div>
                {!editor.canAdd && (
                  <p className="text-xs text-amber-400">
                    {MAX_LAYERS} layers is the most a start screen can have. Delete one to add another.
                  </p>
                )}
                {rejected && <p className="text-xs text-red-400">{rejected}</p>}
              </div>
              <LayerList editor={editor} />
              {editor.selected ? (
                <LayerControls
                  key={editor.selected.id}
                  editor={editor}
                  layer={editor.selected}
                  onChangeShape={() => editor.selected && setSheet({ kind: 'change-shape', id: editor.selected.id })}
                />
              ) : (
                editor.layers.length > 0 && (
                  <p className="text-xs text-zinc-500">Tap a layer, on the screen or in the list, to change it.</p>
                )
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {PALETTE.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setColor(p.value)}
                    aria-pressed={color === p.value}
                    className={[
                      'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm',
                      color === p.value
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-500',
                    ].join(' ')}
                  >
                    <span className={`h-3.5 w-3.5 rounded-sm ${p.swatch}`} />
                    {p.label}
                  </button>
                ))}
                <span className="ml-2 text-xs text-zinc-500">Brush</span>
                {([1, 2, 3] as BrushSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    aria-pressed={size === s}
                    className={[
                      'rounded-md border px-2.5 py-1.5 font-mono text-xs',
                      size === s ? 'border-accent bg-accent/10 text-accent' : 'border-zinc-700 text-zinc-300 hover:border-zinc-500',
                    ].join(' ')}
                  >
                    {s}px
                  </button>
                ))}
                <button
                  type="button"
                  onClick={editor.clearPaint}
                  disabled={Object.keys(editor.paint).length === 0}
                  className={`${TOOLBAR} ml-auto`}
                >
                  <Eraser className="h-3.5 w-3.5" /> Clear paint
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                Paint sits over the layers: change them later and your touch-ups stay. The tinted tile is 0xFF
                and is never written.
              </p>
            </div>
          )}
          <SplashPreview raster={editor.raster} tilesOnly />
        </div>
        <ExportPanel raster={editor.raster} />
      </div>

      {sheet && library.state === 'loaded' && sheet.kind !== 'starters' && (
        <ShapePicker
          library={library.library}
          title={sheet.kind === 'add-shape' ? 'Add a shape' : 'Change shape'}
          onClose={() => setSheet(null)}
          onPick={(shape) => {
            if (sheet.kind === 'add-shape') editor.addShape(shape)
            else editor.update(sheet.id, { shape })
            setSheet(null)
          }}
        />
      )}
      {sheet?.kind === 'starters' && (
        <StarterPicker
          sources={editor.sources}
          onClose={() => setSheet(null)}
          onPick={(starter) => {
            if (editor.layers.length > 0 && !confirm(`Replace your layers with “${starter.name}”? Undo can bring them back.`)) return
            editor.replaceLayers(starter.layers())
            setSheet(null)
            setTab('layers')
          }}
        />
      )}
    </div>
  )
}
