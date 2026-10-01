import { useEffect, useRef } from 'react'
import { GLYPH_HEIGHT, GLYPH_WIDTH } from '../../lib/mcm/decode'
import { RASTER_HEIGHT, RASTER_WIDTH } from '../../lib/splash/raster'
import type { Raster } from '../../lib/splash/raster'

/** Mid-grey: the honest stand-in for an analog video feed behind the OSD. */
const VIDEO = '#7a7a7a'
const SEAM = '#09090b'

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
    ctx.fillStyle = seams ? SEAM : VIDEO
    ctx.fillRect(0, 0, width, height)
    for (let y = 0; y < RASTER_HEIGHT; y += 1) {
      for (let x = 0; x < RASTER_WIDTH; x += 1) {
        const pixel = raster[y * RASTER_WIDTH + x]
        ctx.fillStyle = pixel === 'white' ? '#ffffff' : pixel === 'black' ? '#000000' : VIDEO
        const px = x * scale + seam * Math.floor(x / GLYPH_WIDTH)
        const py = y * scale + seam * Math.floor(y / GLYPH_HEIGHT)
        ctx.fillRect(px, py, scale, scale)
      }
    }
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
