import { ChevronDown, ChevronUp, Eye, EyeOff, ImageIcon, Type } from 'lucide-react'
import type { SplashEditor } from '../../hooks/useSplashDesign'
import { layerName } from '../../lib/emblem/labels'
import type { Layer } from '../../lib/emblem/types'
import { ShapeThumb } from './ShapeThumb'

const ICON_BUTTON =
  'touch-target flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-30'

/** The stack, top layer first: select, show or hide, and reorder. */
export function LayerList({ editor }: { editor: SplashEditor }) {
  const shapes = editor.library.state === 'loaded' ? editor.library.byId : null
  const top = editor.layers.length - 1
  const rows = editor.layers.map((layer, index) => ({ layer, index })).reverse()

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-sm text-zinc-500">
        No layers yet. Add a shape or text below, or start from a starter emblem.
      </p>
    )
  }

  return (
    <ul aria-label="Layers, top first" className="divide-y divide-zinc-800 overflow-hidden rounded-lg border border-zinc-800">
      {rows.map(({ layer, index }) => {
        const name = layerName(layer, shapes)
        const isSelected = editor.selected?.id === layer.id
        const { found, onScreen } = editor.pixelsOf(layer)
        const note = !found
          ? 'Shape not found'
          : !layer.visible
            ? 'Hidden'
            : !onScreen && editor.extentOf(layer)
              ? 'Off screen'
              : layer.mode === 'cutout'
                ? 'Cut out'
                : null
        return (
          <li
            key={layer.id}
            className={['flex items-center gap-1 px-2 py-1.5', isSelected ? 'bg-accent/10' : 'bg-zinc-900/40'].join(' ')}
          >
            <button
              type="button"
              onClick={() => editor.select(layer.id)}
              aria-pressed={isSelected}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left"
            >
              <span
                className={[
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-700',
                  layer.fill === 'white' ? 'bg-zinc-800 text-white' : 'bg-zinc-300 text-black',
                ].join(' ')}
              >
                <Thumb layer={layer} shapes={shapes} />
              </span>
              <span className="min-w-0">
                <span className={['block truncate text-sm', isSelected ? 'text-accent' : 'text-zinc-100'].join(' ')}>
                  {name}
                </span>
                {note && (
                  <span className={['block text-xs', !found || note === 'Off screen' ? 'text-amber-400' : 'text-zinc-500'].join(' ')}>
                    {note}
                  </span>
                )}
              </span>
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              onClick={() => editor.update(layer.id, { visible: !layer.visible })}
              aria-label={`${layer.visible ? 'Hide' : 'Show'} ${name}`}
            >
              {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              disabled={index === top}
              onClick={() => editor.move(layer.id, 'up')}
              aria-label={`Move ${name} up`}
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={ICON_BUTTON}
              disabled={index === 0}
              onClick={() => editor.move(layer.id, 'down')}
              aria-label={`Move ${name} down`}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Thumb({ layer, shapes }: { layer: Layer; shapes: Parameters<typeof layerName>[1] }) {
  if (layer.kind === 'text') return <Type className="h-4 w-4" />
  if (layer.kind === 'image') return <ImageIcon className="h-4 w-4" />
  const shape = shapes?.get(layer.shape)
  return shape ? <ShapeThumb shape={shape} className="h-7 w-7" /> : <span className="text-xs">?</span>
}
