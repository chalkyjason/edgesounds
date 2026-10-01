import { Eraser, Redo2, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExportPanel } from '../../components/splash/ExportPanel'
import { ImagePanel } from '../../components/splash/ImagePanel'
import { PaintCanvas } from '../../components/splash/PaintCanvas'
import type { BrushSize } from '../../components/splash/PaintCanvas'
import { SplashPreview } from '../../components/splash/SplashPreview'
import { TextTemplatePanel } from '../../components/splash/TextTemplatePanel'
import { useSplashDesign } from '../../hooks/useSplashDesign'
import { useStencils } from '../../hooks/useStencils'
import { useToast } from '../../hooks/useToast'
import type { Pixel } from '../../lib/mcm/types'

type Tool = 'text' | 'image' | 'paint'

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'image', label: 'Image' },
  { id: 'paint', label: 'Paint' },
]

const PALETTE: { value: Pixel; label: string; swatch: string }[] = [
  { value: 'white', label: 'White', swatch: 'bg-white' },
  { value: 'black', label: 'Black', swatch: 'bg-black border border-zinc-600' },
  { value: 'transparent', label: 'Clear', swatch: 'bg-zinc-800 border border-zinc-600' },
]

const TOOLBAR =
  'flex items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40'

export function SplashMaker() {
  const stencils = useStencils()
  const editor = useSplashDesign(stencils.state === 'loaded' ? stencils.stencils : null)
  const { notify } = useToast()
  const [tool, setTool] = useState<Tool>('text')
  const [color, setColor] = useState<Pixel>('white')
  const [size, setSize] = useState<BrushSize>(1)

  // A restored design may be an image: open on that tool, not on an empty
  // text template that contradicts the preview. Runs once, when the saved
  // design has been read.
  const [followedRestore, setFollowedRestore] = useState(false)
  if (editor.loaded && !followedRestore) {
    setFollowedRestore(true)
    setTool(editor.design.generator)
  }

  const pickTool = (next: Tool) => {
    setTool(next)
    if (next === 'text' || next === 'image') editor.setGenerator(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/osd" className="touch-target text-sm text-zinc-400 hover:text-accent">
          ← OSD fonts
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">Start screen</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          The 288×72 splash Betaflight shows at boot. Type it, drop a picture in, or paint it, then
          export a font with it in — one of the Army Jay variants, or Betaflight's default font with
          only the splash swapped. Paint sits on top: change the text later and your touch-ups stay.
        </p>
        {editor.storage === 'unavailable' && (
          <p className="mt-2 text-xs text-amber-400">
            The design can't be saved here, so it will be gone on reload.
          </p>
        )}
      </div>

      <SplashPreview raster={editor.raster} />

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Start screen tools" className="flex gap-1 rounded-md bg-zinc-900/60 p-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tool === t.id}
              onClick={() => pickTool(t.id)}
              className={[
                'rounded px-3 py-1.5 text-sm transition-colors',
                tool === t.id ? 'bg-accent/10 text-accent' : 'text-zinc-400 hover:text-zinc-100',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-500">
          Base: {editor.design.generator === 'text' ? 'text template' : 'image'}
        </span>
        <button
          type="button"
          onClick={() => {
            void editor.reset()
            notify('Started over', 'info')
          }}
          className={`${TOOLBAR} ml-auto`}
        >
          <Trash2 className="h-3.5 w-3.5" /> Start over
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* min-w-0: the 864 px paint canvas must scroll inside its column, not widen the page. */}
        <div className="min-w-0 space-y-4">
          {tool === 'text' &&
            (stencils.state === 'error' ? (
              <p className="text-sm text-red-400">{stencils.message}</p>
            ) : (
              <TextTemplatePanel editor={editor} />
            ))}
          {tool === 'image' && <ImagePanel editor={editor} />}
          {tool === 'paint' && (
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
                      size === s
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-zinc-700 text-zinc-300 hover:border-zinc-500',
                    ].join(' ')}
                  >
                    {s}px
                  </button>
                ))}
              </div>
              <PaintCanvas raster={editor.raster} color={color} size={size} onStroke={editor.stroke} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={editor.undo} disabled={!editor.canUndo} className={TOOLBAR}>
                  <Undo2 className="h-3.5 w-3.5" /> Undo
                </button>
                <button type="button" onClick={editor.redo} disabled={!editor.canRedo} className={TOOLBAR}>
                  <Redo2 className="h-3.5 w-3.5" /> Redo
                </button>
                <button
                  type="button"
                  onClick={editor.clearPaint}
                  disabled={Object.keys(editor.paint).length === 0}
                  className={TOOLBAR}
                >
                  <Eraser className="h-3.5 w-3.5" /> Clear paint
                </button>
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <RotateCcw className="h-3 w-3" /> Paint sits over the base; the tinted tile is 0xFF and
                  is never written.
                </span>
              </div>
            </div>
          )}
        </div>
        <ExportPanel raster={editor.raster} />
      </div>
    </div>
  )
}
