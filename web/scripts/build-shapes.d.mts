// Types for build-shapes.mjs, so TypeScript tests can build the library
// straight from assets/shapes (CI runs tests before the build stages it).
import type { ShapeLibrary } from '../src/lib/emblem/types'

export function buildLibrary(dir: string): ShapeLibrary
export function flattenPath(d: string): number[][][]
export function buildShape(svg: string): Pick<ShapeLibrary['shapes'][number], 'w' | 'h' | 'paths'>
export function svgPaths(svg: string): { d: string; rule: 'nonzero' | 'evenodd' }[]
export function simplifyRing(ring: number[][], tolerance: number): number[][]
export function shapeName(file: string): string
export const SIMPLIFY_TOLERANCE: number
