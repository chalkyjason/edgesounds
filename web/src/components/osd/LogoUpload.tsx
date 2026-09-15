import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ImageUp, Check } from 'lucide-react'
import {
  LOGO_HEIGHT,
  LOGO_WIDTH,
  LogoError,
  rasterToTiles,
  tilesToEdits,
} from '../../lib/mcm/logo'
import type { Pixel } from '../../lib/mcm/types'

type Preview = {
  edits: Record<number, Pixel[]>
  droppedReservedInk: boolean
  strict: boolean
  imageData: ImageData
}

/**
 * Boot splash uploader.
 *
 * Configurator's uploader wants a 288x72 image in exactly three colours, and
 * slice_logo.py rejects anything else rather than guessing -- a stray
 * anti-aliased pixel becomes a visibly wrong pixel on a 12x18 tile. That is
 * right for a build script but hostile on the web, where people arrive with an
 * arbitrary PNG. So: strict first, and if that fails, offer to snap each pixel
 * to the nearest of the three colours -- but always render the result first, so
 * the guess is seen and accepted rather than applied behind the user's back.
 */
export function LogoUpload({
  onApply,
}: {
  onApply: (edits: Record<number, Pixel[]>) => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [strictFailed, setStrictFailed] = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState<ImageData | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const buildPreview = useCallback((imageData: ImageData, strict: boolean) => {
    const tiles = rasterToTiles(imageData.data, imageData.width, imageData.height, { strict })
    const { edits, droppedReservedInk } = tilesToEdits(tiles)
    return { edits, droppedReservedInk, strict, imageData }
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setStrictFailed(null)
      setPreview(null)
      setPendingImage(null)

      try {
        const bitmap = await createImageBitmap(file)
        if (bitmap.width !== LOGO_WIDTH || bitmap.height !== LOGO_HEIGHT) {
          setError(
            `That image is ${bitmap.width}x${bitmap.height}. The boot splash must be exactly ${LOGO_WIDTH}x${LOGO_HEIGHT} — 24 tiles across, 4 down.`,
          )
          bitmap.close()
          return
        }
        const scratch = document.createElement('canvas')
        scratch.width = LOGO_WIDTH
        scratch.height = LOGO_HEIGHT
        const ctx = scratch.getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('Could not get a 2D context')
        ctx.drawImage(bitmap, 0, 0)
        bitmap.close()
        const imageData = ctx.getImageData(0, 0, LOGO_WIDTH, LOGO_HEIGHT)

        try {
          setPreview(buildPreview(imageData, true))
        } catch (strictError) {
          if (!(strictError instanceof LogoError)) throw strictError
          setStrictFailed(strictError.message)
          setPendingImage(imageData)
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not read that image')
      }
    },
    [buildPreview],
  )

  // Render the preview from the classified pixels, not the source image, so
  // what is shown is exactly what will be written into the font.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !preview) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#18181b'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (const [key, pixels] of Object.entries(preview.edits)) {
      const tile = Number(key) - 0xa0
      const col = tile % 24
      const row = Math.floor(tile / 24)
      pixels.forEach((pixel, i) => {
        if (pixel === 'transparent') return
        ctx.fillStyle = pixel === 'white' ? '#ffffff' : '#000000'
        ctx.fillRect(col * 12 + (i % 12), row * 18 + Math.floor(i / 12), 1, 1)
      })
    }
  }, [preview])

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div>
        <h3 className="text-sm font-medium text-zinc-100">Boot splash</h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          A {LOGO_WIDTH}×{LOGO_HEIGHT} image in black, white, and pure green for transparent —
          the three colours Configurator&rsquo;s uploader defines. It fills glyphs 0xA0–0xFE.
        </p>
      </div>

      <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-accent/50 hover:text-accent">
        <ImageUp className="h-4 w-4" />
        Choose an image
        <input
          type="file"
          accept="image/png,image/gif,image/bmp,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
            event.target.value = ''
          }}
        />
      </label>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {strictFailed && pendingImage && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="flex items-start gap-1.5 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              That image uses colours outside the palette — {strictFailed}. I can snap every
              pixel to the nearest of the three, but anti-aliased edges will shift.
            </span>
          </p>
          <button
            onClick={() => {
              setPreview(buildPreview(pendingImage, false))
              setStrictFailed(null)
            }}
            className="rounded-md border border-amber-500/50 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10"
          >
            Convert and preview
          </button>
        </div>
      )}

      {preview && (
        <div className="space-y-2">
          <canvas
            ref={canvasRef}
            width={LOGO_WIDTH}
            height={LOGO_HEIGHT}
            className="w-full rounded border border-zinc-800"
            style={{ imageRendering: 'pixelated' }}
          />
          <p className="text-[11px] text-zinc-500">
            {preview.strict ? 'Exact palette match.' : 'Converted to the nearest palette colours.'}{' '}
            This is what will be written.
          </p>
          {preview.droppedReservedInk && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-300">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              The bottom-right tile has ink in it. That slot is 0xFF, the reserved end-of-font
              marker, so it will be dropped — leave that corner empty.
            </p>
          )}
          <button
            onClick={() => {
              onApply(preview.edits)
              setPreview(null)
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim"
          >
            <Check className="h-4 w-4" />
            Apply to the font
          </button>
        </div>
      )}
    </div>
  )
}
