import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BringToFront,
  Copy,
  FlipHorizontal2,
  FlipVertical2,
  ImageIcon,
  LocateFixed,
  SendToBack,
  Shapes,
  Trash2,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SplashEditor } from '../../hooks/useSplashDesign'
import { CENTRE, FONT_SIZE } from '../../lib/emblem/design'
import type { LayerPatch } from '../../lib/emblem/editor'
import { layerName, snapAngle } from '../../lib/emblem/labels'
import type { Layer } from '../../lib/emblem/types'
import { ACCEPTED_IMAGE_TYPES, checkImageFile } from '../../lib/splash/image'

const BUTTON =
  'flex items-center justify-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40'
const SEGMENT = (on: boolean) =>
  [
    'flex-1 rounded px-2.5 py-1.5 text-xs',
    on ? 'bg-accent/10 text-accent' : 'text-zinc-400 hover:text-zinc-100',
  ].join(' ')

/** Everything about the selected layer that a finger on the preview can't set precisely. */
export function LayerControls({
  editor,
  layer,
  onChangeShape,
}: {
  editor: SplashEditor
  layer: Layer
  onChangeShape: () => void
}) {
  const id = useId()
  const set = (patch: LayerPatch) => editor.update(layer.id, patch)
  const shapes = editor.library.state === 'loaded' ? editor.library.byId : null
  const name = layerName(layer, shapes)
  const { onScreen, found } = editor.pixelsOf(layer)
  const sizeRange = layer.kind === 'text' ? { min: 5, max: 72 } : { min: 4, max: 300 }

  return (
    <section aria-label={`${name} settings`} className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium text-zinc-100">{name}</h3>
        {!onScreen && found && editor.extentOf(layer) && (
          <button type="button" className={BUTTON} onClick={() => set({ x: CENTRE.x, y: CENTRE.y })}>
            <LocateFixed className="h-3.5 w-3.5" /> Centre
          </button>
        )}
      </div>

      {layer.kind === 'text' && <TextFields editor={editor} layer={layer} />}
      {layer.kind === 'image' && <ImageFields editor={editor} layer={layer} />}
      {layer.kind === 'shape' && (
        <button type="button" className={BUTTON} onClick={onChangeShape} disabled={!shapes}>
          <Shapes className="h-3.5 w-3.5" /> Change shape
        </button>
      )}

      <Slider
        id={`${id}-size`}
        label={layer.kind === 'text' ? 'Letter height' : 'Size'}
        value={layer.size}
        min={sizeRange.min}
        max={sizeRange.max}
        unit="px"
        editor={editor}
        onChange={(size) => set({ size })}
      />
      <Slider
        id={`${id}-rotation`}
        label="Rotation"
        value={Math.round(layer.rotation)}
        min={-180}
        max={180}
        unit="°"
        editor={editor}
        onChange={(rotation) => set({ rotation: snapAngle(rotation) })}
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">Nudge</span>
        <Nudge editor={editor} label="Nudge left" onStep={() => editor.nudge(layer.id, -1, 0)}>
          <ArrowLeft className="h-4 w-4" />
        </Nudge>
        <Nudge editor={editor} label="Nudge up" onStep={() => editor.nudge(layer.id, 0, -1)}>
          <ArrowUp className="h-4 w-4" />
        </Nudge>
        <Nudge editor={editor} label="Nudge down" onStep={() => editor.nudge(layer.id, 0, 1)}>
          <ArrowDown className="h-4 w-4" />
        </Nudge>
        <Nudge editor={editor} label="Nudge right" onStep={() => editor.nudge(layer.id, 1, 0)}>
          <ArrowRight className="h-4 w-4" />
        </Nudge>
        <button
          type="button"
          className={BUTTON}
          aria-pressed={layer.flipX}
          onClick={() => set({ flipX: !layer.flipX })}
        >
          <FlipHorizontal2 className="h-3.5 w-3.5" /> Flip ↔
        </button>
        <button
          type="button"
          className={BUTTON}
          aria-pressed={layer.flipY}
          onClick={() => set({ flipY: !layer.flipY })}
        >
          <FlipVertical2 className="h-3.5 w-3.5" /> Flip ↕
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1 text-xs text-zinc-500">Mode</legend>
          <div className="flex gap-1 rounded-md bg-zinc-900 p-1">
            <button type="button" aria-pressed={layer.mode === 'normal'} className={SEGMENT(layer.mode === 'normal')} onClick={() => set({ mode: 'normal' })}>
              Normal
            </button>
            <button type="button" aria-pressed={layer.mode === 'cutout'} className={SEGMENT(layer.mode === 'cutout')} onClick={() => set({ mode: 'cutout' })}>
              Cut out
            </button>
          </div>
        </fieldset>
        {layer.mode === 'normal' && (
          <fieldset>
            <legend className="mb-1 text-xs text-zinc-500">Fill</legend>
            <div className="flex gap-1 rounded-md bg-zinc-900 p-1">
              <button type="button" aria-pressed={layer.fill === 'white'} className={SEGMENT(layer.fill === 'white')} onClick={() => set({ fill: 'white' })}>
                White
              </button>
              <button type="button" aria-pressed={layer.fill === 'black'} className={SEGMENT(layer.fill === 'black')} onClick={() => set({ fill: 'black' })}>
                Black
              </button>
            </div>
          </fieldset>
        )}
      </div>
      {layer.mode === 'normal' ? (
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={layer.outline}
            onChange={(event) => set({ outline: event.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Outline in {layer.fill === 'white' ? 'black' : 'white'}
          <span className="text-xs text-zinc-500">· keeps it readable over sky and ground</span>
        </label>
      ) : (
        <p className="text-xs text-zinc-500">Cut out clears everything below it, in this layer’s shape.</p>
      )}

      <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
        <button type="button" className={BUTTON} disabled={!editor.canAdd} onClick={() => editor.duplicate(layer.id)}>
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
        <button type="button" className={BUTTON} onClick={() => editor.move(layer.id, 'front')}>
          <BringToFront className="h-3.5 w-3.5" /> To front
        </button>
        <button type="button" className={BUTTON} onClick={() => editor.move(layer.id, 'back')}>
          <SendToBack className="h-3.5 w-3.5" /> To back
        </button>
        <button
          type="button"
          className={`${BUTTON} hover:border-red-500/60 hover:text-red-400`}
          onClick={() => editor.remove(layer.id)}
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </section>
  )
}

/** A range input whose whole drag is one undo step. */
function Slider({
  id,
  label,
  value,
  min,
  max,
  unit,
  editor,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  unit: string
  editor: SplashEditor
  onChange: (value: number) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex justify-between text-xs text-zinc-400">
        <span>{label}</span>
        <span className="font-mono text-zinc-500">
          {Math.round(value * 10) / 10}
          {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={Math.min(max, Math.max(min, value))}
        onPointerDown={editor.beginGesture}
        onPointerUp={editor.endGesture}
        onPointerCancel={editor.endGesture}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-accent"
      />
    </div>
  )
}

/** Hold to repeat; the whole hold is one undo step. */
function Nudge({
  editor,
  label,
  onStep,
  children,
}: {
  editor: SplashEditor
  label: string
  onStep: () => void
  children: ReactNode
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const step = useRef(onStep)
  useEffect(() => {
    step.current = onStep
  })
  const { endGesture } = editor
  const stop = () => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = null
    endGesture()
  }
  // Released by unmounting (the layer deleted mid-hold): stop repeating.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return (
    <button
      type="button"
      aria-label={label}
      className="touch-target flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:border-zinc-500"
      onPointerDown={(event) => {
        event.preventDefault()
        editor.beginGesture()
        step.current()
        const repeat = () => {
          step.current()
          timer.current = setTimeout(repeat, 60)
        }
        timer.current = setTimeout(repeat, 350)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      // Keyboard activation: one step per press.
      onClick={(event) => {
        if (event.detail === 0) onStep()
      }}
    >
      {children}
    </button>
  )
}

function TextFields({ editor, layer }: { editor: SplashEditor; layer: Extract<Layer, { kind: 'text' }> }) {
  const id = useId()
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-xs text-zinc-400">
        Text <span className="text-zinc-500">· A–Z, 0–9, space and - . ! &apos; /</span>
      </label>
      <input
        id={id}
        type="text"
        value={layer.text}
        // Typing is one undo step per visit to the field, not per letter.
        onFocus={editor.beginGesture}
        onBlur={editor.endGesture}
        onChange={(event) => editor.update(layer.id, { text: event.target.value.toUpperCase() })}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm uppercase text-zinc-100 outline-none focus:border-accent"
      />
      <div className="flex gap-1 rounded-md bg-zinc-900 p-1">
        {(['big', 'small'] as const).map((font) => (
          <button
            key={font}
            type="button"
            aria-pressed={layer.font === font}
            className={SEGMENT(layer.font === font)}
            onClick={() => editor.update(layer.id, { font, size: FONT_SIZE[font] })}
          >
            {font === 'big' ? 'Big letters' : 'Small letters'}
          </button>
        ))}
      </div>
    </div>
  )
}

function ImageFields({ editor, layer }: { editor: SplashEditor; layer: Extract<Layer, { kind: 'image' }> }) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [rejected, setRejected] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <button type="button" className={BUTTON} onClick={() => input.current?.click()}>
        <ImageIcon className="h-3.5 w-3.5" /> {editor.imageName ? `Replace ${editor.imageName}` : 'Choose an image'}
      </button>
      <input
        ref={input}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          const problem = checkImageFile(file)
          setRejected(problem)
          if (!problem) editor.setImageFile(file)
        }}
      />
      {rejected && <p className="text-xs text-red-400">{rejected}</p>}
      {editor.imageError && <p className="text-xs text-red-400">{editor.imageError}</p>}
      <Slider
        id={`${id}-threshold`}
        label="Threshold"
        value={layer.threshold}
        min={0}
        max={255}
        unit=""
        editor={editor}
        onChange={(threshold) => editor.update(layer.id, { threshold })}
      />
      <label className="flex items-center gap-2 text-sm text-zinc-300">
        <input
          type="checkbox"
          checked={layer.invert}
          onChange={(event) => editor.update(layer.id, { invert: event.target.checked })}
          className="h-4 w-4 accent-accent"
        />
        Invert
      </label>
    </div>
  )
}
