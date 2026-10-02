/** One item in the start screen's layer stack. See docs/superpowers/specs/2026-10-02-emblem-layers-design.md. */
export interface LayerBase {
  id: string
  /** Centre, in raster pixels. */
  x: number
  y: number
  /**
   * Shapes and the image: pixels across the larger side. Text: the letter
   * height in pixels, so typing more letters doesn't shrink them.
   */
  size: number
  /** Degrees, clockwise. */
  rotation: number
  flipX: boolean
  flipY: boolean
  fill: 'white' | 'black'
  /** A 1 px halo in the opposite colour. */
  outline: boolean
  /** Cut out clears what is below instead of drawing. */
  mode: 'normal' | 'cutout'
  visible: boolean
}

export type Layer = LayerBase &
  (
    | { kind: 'shape'; shape: string }
    | { kind: 'text'; text: string; font: 'big' | 'small' }
    | { kind: 'image'; threshold: number; invert: boolean }
  )

export const MAX_LAYERS = 32

/** A path of a library shape: rings of flat [x0, y0, x1, y1, ...], unit box, centred. */
export interface ShapePath {
  rule: 'nonzero' | 'evenodd'
  rings: number[][]
}

export interface ShapeDef {
  id: string
  name: string
  pack: string
  author?: string
  /** The shape's box; the larger of the two is 1. */
  w: number
  h: number
  paths: ShapePath[]
}

export interface PackDef {
  id: string
  name: string
  author: string
  license: string
  url: string
  licenseUrl?: string
}

export interface ShapeLibrary {
  packs: PackDef[]
  shapes: ShapeDef[]
}

/** The design's image, decoded at its fitted size. Image layers threshold it themselves. */
export interface DecodedImage {
  rgba: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

/** A 1-bit image: `bits[y * width + x]`. Text and the image layer are these. */
export interface Bitmap {
  width: number
  height: number
  bits: Uint8Array
}
