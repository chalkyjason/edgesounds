import type { Layer, ShapeDef } from './types'

/** Degrees into -180..180, one decimal. */
export function normalizeAngle(degrees: number): number {
  const d = ((((degrees + 180) % 360) + 360) % 360) - 180
  return Math.round(d * 10) / 10
}

/** Rotation snaps to these when within SNAP_DEGREES of one. */
const SNAPS = [-180, -135, -90, -45, 0, 45, 90, 135, 180]
const SNAP_DEGREES = 3

export function snapAngle(degrees: number): number {
  const snap = SNAPS.find((s) => Math.abs(s - degrees) <= SNAP_DEGREES)
  return snap === undefined ? degrees : snap === -180 ? 180 : snap
}

/** A layer's name in the list and in announcements. */
export function layerName(layer: Layer, shapes: Map<string, ShapeDef> | null): string {
  if (layer.kind === 'text') return layer.text.trim() ? `“${layer.text.toUpperCase()}”` : 'Empty text'
  if (layer.kind === 'image') return 'Image'
  return shapes?.get(layer.shape)?.name ?? layer.shape.split('/').pop()?.replace(/-/g, ' ') ?? 'Shape'
}
