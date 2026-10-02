import { shapeLayer, textLayer } from './design'
import type { Layer } from './types'

export interface Starter {
  id: string
  name: string
  /** Fresh layers each call, with new ids. */
  layers: () => Layer[]
}

/** Starting points built from the library, to customise rather than start blank. */
export const STARTERS: Starter[] = [
  {
    id: 'wings',
    name: 'Callsign + wings',
    layers: () => [
      shapeLayer('insignia/pilot-wings', { x: 144, y: 24, size: 150 }),
      textLayer('CALLSIGN', 'big', { x: 144, y: 57 }),
    ],
  },
  {
    id: 'skull-props',
    name: 'Skull & props',
    layers: () => [
      shapeLayer('fpv/propeller', { x: 92, y: 36, size: 54, rotation: 20 }),
      shapeLayer('fpv/propeller', { x: 196, y: 36, size: 54, rotation: -20, flipX: true }),
      shapeLayer('military/skull-crossed-bones', { x: 144, y: 36, size: 66 }),
    ],
  },
  {
    id: 'shield-star',
    name: 'Shield + star',
    layers: () => [
      shapeLayer('insignia/shield-heater', { x: 60, y: 36, size: 66 }),
      shapeLayer('basics/star', { x: 60, y: 32, size: 30, mode: 'cutout' }),
      textLayer('CALLSIGN', 'big', { x: 182, y: 30 }),
      textLayer('FPV SQUADRON', 'small', { x: 182, y: 50 }),
    ],
  },
  {
    id: 'chevrons',
    name: 'Squadron chevrons',
    layers: () => [
      shapeLayer('insignia/rank-3', { x: 34, y: 36, size: 56 }),
      shapeLayer('insignia/rank-3', { x: 254, y: 36, size: 56 }),
      textLayer('CALLSIGN', 'big', { x: 144, y: 36 }),
    ],
  },
  {
    id: 'eagle-banner',
    name: 'Eagle & banner',
    layers: () => [
      shapeLayer('beasts/eagle-emblem', { x: 144, y: 24, size: 46 }),
      shapeLayer('insignia/banner', { x: 144, y: 58, size: 190, outline: true }),
      textLayer('CALLSIGN', 'small', { x: 144, y: 57, fill: 'black', outline: false }),
    ],
  },
  {
    id: 'crosshair',
    name: 'On target',
    layers: () => [
      shapeLayer('insignia/crosshair-ring', { x: 44, y: 36, size: 62 }),
      textLayer('CALLSIGN', 'big', { x: 182, y: 28 }),
      shapeLayer('basics/line', { x: 182, y: 41, size: 150 }),
      textLayer('LOCKED ON', 'small', { x: 182, y: 58 }),
    ],
  },
  {
    id: 'quad',
    name: 'Quad squadron',
    layers: () => [
      shapeLayer('fpv/quad', { x: 44, y: 36, size: 62, rotation: 0 }),
      textLayer('CALLSIGN', 'big', { x: 182, y: 30 }),
      textLayer('FPV SQUADRON', 'small', { x: 182, y: 50 }),
    ],
  },
  {
    id: 'wolf',
    name: 'Wolf roundel',
    layers: () => [
      shapeLayer('basics/circle', { x: 144, y: 36, size: 66, fill: 'black', outline: true }),
      shapeLayer('basics/ring', { x: 144, y: 36, size: 66 }),
      shapeLayer('beasts/wolf-head', { x: 144, y: 36, size: 44 }),
      shapeLayer('basics/chevron', { x: 60, y: 36, size: 40, rotation: -90 }),
      shapeLayer('basics/chevron', { x: 228, y: 36, size: 40, rotation: 90 }),
    ],
  },
]
