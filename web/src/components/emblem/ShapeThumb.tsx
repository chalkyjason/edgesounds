import type { ShapeDef } from '../../lib/emblem/types'

/** A shape as a small SVG, for the picker and the layer list. Previews only; the raster is drawn by lib/emblem. */
export function ShapeThumb({ shape, className = 'h-8 w-8' }: { shape: ShapeDef; className?: string }) {
  return (
    <svg viewBox="-0.55 -0.55 1.1 1.1" className={className} aria-hidden="true">
      {shape.paths.map((path, i) => (
        <path key={i} fillRule={path.rule} fill="currentColor" d={ringsToD(path.rings)} />
      ))}
    </svg>
  )
}

function ringsToD(rings: number[][]): string {
  return rings
    .map((ring) => {
      let d = ''
      for (let i = 0; i < ring.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${ring[i]} ${ring[i + 1]}`
      return `${d}Z`
    })
    .join('')
}
