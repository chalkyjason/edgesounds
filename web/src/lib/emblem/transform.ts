import type { LayerBase } from './types'

type Placement = Pick<LayerBase, 'x' | 'y' | 'rotation' | 'flipX' | 'flipY'>

/**
 * Local -> raster: flip, scale by `k`, rotate clockwise, move to the centre.
 * Local coordinates are centred on the layer; y points down, as on screen.
 */
export function toRaster(layer: Placement, k: number, lx: number, ly: number): [number, number] {
  const [c, s] = cosSin(layer.rotation)
  const x = (layer.flipX ? -lx : lx) * k
  const y = (layer.flipY ? -ly : ly) * k
  return [layer.x + x * c - y * s, layer.y + x * s + y * c]
}

/** Raster -> local: the exact inverse of toRaster. */
export function toLocal(layer: Placement, k: number, px: number, py: number): [number, number] {
  const [c, s] = cosSin(layer.rotation)
  const dx = px - layer.x
  const dy = py - layer.y
  const x = (dx * c + dy * s) / k
  const y = (-dx * s + dy * c) / k
  return [layer.flipX ? -x : x, layer.flipY ? -y : y]
}

/** Exact at the right angles, so an unrotated or quarter-turned layer has no drift. */
function cosSin(degrees: number): [number, number] {
  const d = ((degrees % 360) + 360) % 360
  if (d === 0) return [1, 0]
  if (d === 90) return [0, 1]
  if (d === 180) return [-1, 0]
  if (d === 270) return [0, -1]
  const r = (d * Math.PI) / 180
  return [Math.cos(r), Math.sin(r)]
}
