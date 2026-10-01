import { ImageUp } from 'lucide-react'
import { useRef } from 'react'
import type { SplashEditor } from '../../hooks/useSplashDesign'

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif'

/** Any picture, fitted into 288 x 72 and thresholded to the three OSD colours. */
export function ImagePanel({ editor }: { editor: SplashEditor }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { image } = editor.design

  const pick = (file: File | null) => {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) {
      editor.setImageSource(null)
      return
    }
    editor.setImageSource(file)
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          pick(event.dataTransfer.files[0] ?? null)
        }}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-8 text-center text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
      >
        <ImageUp className="h-6 w-6" />
        <span className="text-sm font-medium">
          {image.sourceName ? image.sourceName : 'Choose an image'}
        </span>
        <span className="text-xs text-zinc-500">PNG · JPEG · WebP · GIF — fitted into 288×72</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />
      {editor.imageError && <p className="text-sm text-red-400">{editor.imageError}</p>}

      <div>
        <label htmlFor="splash-threshold" className="mb-1 block text-sm text-zinc-300">
          Threshold <span className="font-mono text-xs text-zinc-500">· {image.threshold}</span>
        </label>
        <input
          id="splash-threshold"
          type="range"
          min={0}
          max={255}
          value={image.threshold}
          onChange={(event) => editor.setImageOptions({ threshold: Number(event.target.value) })}
          className="w-full accent-accent"
        />
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={image.invert}
            onChange={(event) => editor.setImageOptions({ invert: event.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Invert
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={image.outline}
            onChange={(event) => editor.setImageOptions({ outline: event.target.checked })}
            className="h-4 w-4 accent-accent"
          />
          Outline
        </label>
        <label className="flex items-center gap-2">
          Background
          <select
            value={image.background}
            onChange={(event) =>
              editor.setImageOptions({ background: event.target.value as 'transparent' | 'black' })
            }
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 outline-none focus:border-accent"
          >
            <option value="transparent">Transparent</option>
            <option value="black">Black</option>
          </select>
        </label>
      </div>
    </div>
  )
}
