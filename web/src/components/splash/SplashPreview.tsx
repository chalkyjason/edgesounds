import { useEffect, useRef } from 'react'
import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../../lib/mcm/decode'
import { RASTER_HEIGHT, RASTER_WIDTH } from '../../lib/splash/raster'
import type { Raster } from '../../lib/splash/raster'

/** Mid-grey: the honest stand-in for an analog video feed behind the OSD. */
const VIDEO_RGB: [number, number, number] = [0x7a, 0x7a, 0x7a]
const SEAM_RGB: [number, number, number] = [0x09, 0x09, 0x0b]
const WHITE_RGB: [number, number, number] = [255, 255, 255]
const BLACK_RGB: [number, number, number] = [0, 0, 0]

/**
 * Two views of the raster: over grey "video", which is what the black
 * outline is for, and sliced into its 24 x 4 tiles with 1 px seams.
 */
export function SplashPreview({ raster }: { raster: Raster }) {
  return (
    <div className="space-y-3">
      <Canvas raster={raster} scale={2} seams={false} label="Start screen over video" />
      <Canvas raster={raster} scale={1} seams label="Start screen as 96 tiles" />
    </div>
  )
}

function Canvas({
  raster,
  scale,
  seams,
  label,
}: {
  raster: Raster
  scale: number
  seams: boolean
  label: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const seam = seams ? 1 : 0
  const width = RASTER_WIDTH * scale + seam * (RASTER_WIDTH / GLYPH_WIDTH - 1)
  const height = RASTER_HEIGHT * scale + seam * (RASTER_HEIGHT / GLYPH_HEIGHT - 1)

  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (!ctx) return
    // One ImageData, one blit: this redraws on every keystroke and stroke.
    const image = ctx.createImageData(width, height)
    const data = image.data
    const bg = seams ? SEAM_RGB : VIDEO_RGB
    for (let i = 0; i < data.length; i += 4) {
      data[i] = bg[0]
      data[i + 1] = bg[1]
      data[i + 2] = bg[2]
      data[i + 3] = 255
    }
    for (let y = 0; y < RASTER_HEIGHT; y += 1) {
      for (let x = 0; x < RASTER_WIDTH; x += 1) {
        const pixel = raster[y * RASTER_WIDTH + x]
        const [r, g, b] = pixel === 'white' ? WHITE_RGB : pixel === 'black' ? BLACK_RGB : VIDEO_RGB
        const px = x * scale + seam * Math.floor(x / GLYPH_WIDTH)
        const py = y * scale + seam * Math.floor(y / GLYPH_HEIGHT)
        for (let dy = 0; dy < scale; dy += 1) {
          let o = ((py + dy) * width + px) * 4
          for (let dx = 0; dx < scale; dx += 1) {
            data[o] = r
            data[o + 1] = g
            data[o + 2] = b
            o += 4
          }
        }
      }
    }
    ctx.putImageData(image, 0, 0)
  }, [raster, scale, seams, seam, width, height])

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="block max-w-full rounded border border-zinc-800"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
