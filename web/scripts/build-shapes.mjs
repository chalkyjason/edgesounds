// Builds public/osd/shapes.json, the start screen's shape library, from the
// SVGs under ../assets/shapes/<pack>/ and ../assets/shapes/packs.json.
//
// Each SVG's paths are flattened to polygons -- arcs to curves, curves to
// line segments, then simplified -- and the shape is centred and scaled so
// its larger side is 1. The browser rasterizes those polygons itself (see
// src/lib/emblem/rasterize.ts), so the pixels are the same on every engine.
//
// Plain JavaScript: Node runs it directly before dev and build.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import svgpath from 'svgpath'

/** Curve flattening: line segments per curve, scaled to its size. */
const MIN_CURVE_STEPS = 4
const MAX_CURVE_STEPS = 24
/** Douglas-Peucker tolerance, in units of the shape's larger side. */
export const SIMPLIFY_TOLERANCE = 0.0015

/**
 * Flatten one SVG path's `d` to rings of [x, y] points, in source units.
 * @param {string} d
 * @returns {number[][][]}
 */
export function flattenPath(d) {
  const rings = []
  let ring = []
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  const close = () => {
    if (ring.length >= 3) rings.push(ring)
    ring = []
  }
  for (const seg of svgpath(d).abs().unarc().unshort().segments) {
    const cmd = seg[0]
    // Drawing on after Z without an M starts a new subpath at the last start.
    if (cmd !== 'M' && cmd !== 'Z' && cmd !== 'z' && ring.length === 0) ring.push([x, y])
    if (cmd === 'M') {
      close()
      ;[x, y] = [seg[1], seg[2]]
      ;[startX, startY] = [x, y]
      ring.push([x, y])
    } else if (cmd === 'L') {
      ;[x, y] = [seg[1], seg[2]]
      ring.push([x, y])
    } else if (cmd === 'H') {
      x = seg[1]
      ring.push([x, y])
    } else if (cmd === 'V') {
      y = seg[1]
      ring.push([x, y])
    } else if (cmd === 'C') {
      const [, x1, y1, x2, y2, x3, y3] = seg
      const steps = curveSteps([x, y], [x1, y1], [x2, y2], [x3, y3])
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps
        const u = 1 - t
        ring.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ])
      }
      ;[x, y] = [x3, y3]
    } else if (cmd === 'Q') {
      const [, x1, y1, x2, y2] = seg
      const steps = curveSteps([x, y], [x1, y1], [x2, y2])
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps
        const u = 1 - t
        ring.push([u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2])
      }
      ;[x, y] = [x2, y2]
    } else if (cmd === 'Z' || cmd === 'z') {
      close()
      ;[x, y] = [startX, startY]
    } else {
      throw new Error(`unsupported path command ${cmd}`)
    }
  }
  close()
  return rings
}

/** More segments for a longer control polygon, within bounds. */
function curveSteps(...points) {
  let length = 0
  for (let i = 1; i < points.length; i += 1) {
    length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  }
  return Math.max(MIN_CURVE_STEPS, Math.min(MAX_CURVE_STEPS, Math.ceil(length / 6)))
}

/**
 * The paths of an SVG document: `d` and fill rule, skipping unfilled ones.
 * @param {string} svg
 * @returns {{ d: string, rule: 'nonzero' | 'evenodd' }[]}
 */
export function svgPaths(svg) {
  const paths = []
  for (const match of svg.matchAll(/<path\b([^>]*)\/?>/g)) {
    const attrs = match[1]
    const d = /\sd="([^"]*)"/.exec(attrs)?.[1]
    if (!d) continue
    if (/\sfill="none"/.test(attrs)) continue
    const rule = /\sfill-rule="evenodd"/.test(attrs) ? 'evenodd' : 'nonzero'
    paths.push({ d, rule })
  }
  return paths
}

/** Douglas-Peucker on a closed ring; keeps at least a triangle. */
export function simplifyRing(ring, tolerance) {
  if (ring.length <= 4) return ring
  const keep = new Array(ring.length).fill(false)
  keep[0] = true
  keep[ring.length - 1] = true
  const stack = [[0, ring.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let worst = -1
    let index = -1
    for (let i = a + 1; i < b; i += 1) {
      const d = distanceToSegment(ring[i], ring[a], ring[b])
      if (d > worst) [worst, index] = [d, i]
    }
    if (worst > tolerance) {
      keep[index] = true
      stack.push([a, index], [index, b])
    }
  }
  const out = ring.filter((_, i) => keep[i])
  return out.length >= 3 ? out : ring
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/**
 * One shape: its paths centred on the origin and scaled so the larger side
 * of the whole shape is 1. `w`/`h` are that box (max 1).
 * @param {string} svg
 */
export function buildShape(svg) {
  const paths = svgPaths(svg).map(({ d, rule }) => ({ rule, rings: flattenPath(d) }))
  const points = paths.flatMap((p) => p.rings.flat())
  if (points.length === 0) throw new Error('no filled paths')
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const side = Math.max(maxX - minX, maxY - minY)
  if (!(side > 0)) throw new Error('shape has no size')
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const round = (v) => Math.round(v * 1e4) / 1e4
  return {
    w: round((maxX - minX) / side),
    h: round((maxY - minY) / side),
    paths: paths.map(({ rule, rings }) => ({
      rule,
      // Flat [x0, y0, x1, y1, ...] per ring keeps the JSON small.
      rings: rings
        .map((ring) => simplifyRing(ring.map(([x, y]) => [(x - cx) / side, (y - cy) / side]), SIMPLIFY_TOLERANCE))
        .map((ring) => ring.flatMap(([x, y]) => [round(x), round(y)])),
    })),
  }
}

/** Display name from a file name: "skull-crossed-bones" -> "Skull crossed bones". */
export function shapeName(file) {
  const words = file.replace(/\.svg$/, '').replace(/-/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The whole library from an assets/shapes directory.
 * @param {string} dir
 */
export function buildLibrary(dir) {
  const meta = JSON.parse(readFileSync(join(dir, 'packs.json'), 'utf8'))
  const packs = []
  const shapes = []
  for (const id of meta.order) {
    const pack = meta.packs[id]
    if (!pack) throw new Error(`packs.json: "${id}" is in order but not described`)
    for (const field of ['name', 'author', 'license', 'url']) {
      if (!pack[field]) throw new Error(`packs.json: pack "${id}" has no ${field}`)
    }
    const folder = join(dir, id)
    const files = existsSync(folder) ? readdirSync(folder).filter((f) => f.endsWith('.svg')).sort() : []
    if (files.length === 0) throw new Error(`pack "${id}" has no shapes`)
    packs.push({
      id,
      name: pack.name,
      author: pack.author,
      license: pack.license,
      url: pack.url,
      ...(pack.licenseUrl ? { licenseUrl: pack.licenseUrl } : {}),
    })
    for (const file of files) {
      const name = file.replace(/\.svg$/, '')
      let shape
      try {
        shape = buildShape(readFileSync(join(folder, file), 'utf8'))
      } catch (error) {
        throw new Error(`${id}/${file}: ${error.message}`)
      }
      const credit = pack.shapes?.[name]
      shapes.push({
        id: `${id}/${name}`,
        name: shapeName(file),
        pack: id,
        ...(credit?.author ? { author: credit.author } : {}),
        ...shape,
      })
    }
  }
  for (const id of Object.keys(meta.packs)) {
    if (!meta.order.includes(id)) throw new Error(`packs.json: pack "${id}" is described but not in order`)
  }
  return { packs, shapes }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const WEB = dirname(dirname(fileURLToPath(import.meta.url)))
  const out = join(WEB, 'public', 'osd', 'shapes.json')
  try {
    const library = buildLibrary(join(WEB, '..', 'assets', 'shapes'))
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, JSON.stringify(library))
    console.log(`[build-shapes] ${library.shapes.length} shapes in ${library.packs.length} packs -> public/osd/shapes.json`)
  } catch (error) {
    console.error(`[build-shapes] ${error.message}`)
    process.exit(1)
  }
}
