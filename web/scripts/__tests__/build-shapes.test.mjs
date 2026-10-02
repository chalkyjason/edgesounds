import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { buildLibrary, buildShape, flattenPath, shapeName, simplifyRing, svgPaths } from '../build-shapes.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ASSETS = resolve(HERE, '../../../assets/shapes')

describe('flattenPath', () => {
  it('reads straight segments, relative and absolute', () => {
    expect(flattenPath('M0 0h10v10H0z')).toEqual([[[0, 0], [10, 0], [10, 10], [0, 10]]])
    expect(flattenPath('M1 1l4 0l0 4z')).toEqual([[[1, 1], [5, 1], [5, 5]]])
  })

  it('splits subpaths at each M and Z', () => {
    expect(flattenPath('M0 0h4v4z M10 10h4v4z')).toHaveLength(2)
  })

  it('starts a new ring at the last start when drawing on after Z', () => {
    const rings = flattenPath('M0 0h4v4zl2 0l0 2z')
    expect(rings).toHaveLength(2)
    expect(rings[1][0]).toEqual([0, 0])
  })

  it('flattens curves and arcs onto the curve', () => {
    // A circle of radius 10 as two arcs: every point within a hair of r = 10.
    const [ring] = flattenPath('M-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0z')
    expect(ring.length).toBeGreaterThan(8)
    for (const [x, y] of ring) expect(Math.hypot(x, y)).toBeCloseTo(10, 0)
  })
})

describe('svgPaths', () => {
  it('skips unfilled paths and reads the fill rule', () => {
    const svg =
      '<svg><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M1 1h2v2z"/>' +
      '<path fill-rule="evenodd" d="M0 0h9v9z"/></svg>'
    expect(svgPaths(svg)).toEqual([
      { d: 'M1 1h2v2z', rule: 'nonzero' },
      { d: 'M0 0h9v9z', rule: 'evenodd' },
    ])
  })
})

describe('buildShape', () => {
  it('centres on the origin and scales the larger side to 1', () => {
    const shape = buildShape('<svg><path d="M100 50h40v20h-40z"/></svg>')
    expect(shape).toMatchObject({ w: 1, h: 0.5 })
    expect(shape.paths[0].rings[0]).toEqual([-0.5, -0.25, 0.5, -0.25, 0.5, 0.25, -0.5, 0.25])
  })

  it('refuses an SVG with nothing to fill', () => {
    expect(() => buildShape('<svg><path d="M0 0h1v1z" fill="none"/></svg>')).toThrow('no filled paths')
  })
})

describe('simplifyRing', () => {
  it('drops points that lie on a straight edge', () => {
    const ring = [[0, 0], [0.5, 0], [1, 0], [1, 1], [0, 1]]
    expect(simplifyRing(ring, 0.001)).toEqual([[0, 0], [1, 0], [1, 1], [0, 1]])
  })
})

describe('shapeName', () => {
  it('turns a file name into a label', () => {
    expect(shapeName('skull-crossed-bones.svg')).toBe('Skull crossed bones')
  })
})

describe('buildLibrary on the real assets', () => {
  const library = buildLibrary(ASSETS)

  it('has the six packs, each with an author and licence', () => {
    expect(library.packs.map((p) => p.id)).toEqual(['basics', 'insignia', 'military', 'beasts', 'fpv', 'symbols'])
    for (const pack of library.packs) {
      expect(pack.author).toBeTruthy()
      expect(pack.license).toMatch(/^(MIT|CC BY 3\.0)$/)
    }
  })

  it('has at least 80 shapes, every one in a pack and with something to draw', () => {
    expect(library.shapes.length).toBeGreaterThanOrEqual(80)
    const packs = new Set(library.packs.map((p) => p.id))
    for (const shape of library.shapes) {
      expect(packs.has(shape.pack)).toBe(true)
      expect(shape.paths.length).toBeGreaterThan(0)
      for (const path of shape.paths) for (const ring of path.rings) expect(ring.length).toBeGreaterThanOrEqual(6)
      expect(Math.max(shape.w, shape.h)).toBe(1)
    }
  })

  it('credits every CC BY shape to its author', () => {
    for (const shape of library.shapes) {
      const pack = library.packs.find((p) => p.id === shape.pack)
      if (pack.license.startsWith('CC BY')) expect(shape.author, shape.id).toMatch(/^(Lorc|Delapouite)$/)
    }
  })

  it('has unique ids', () => {
    const ids = library.shapes.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildLibrary rejects bad metadata', () => {
  let dir
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }))

  const make = (packs, files = { a: ['x.svg'] }) => {
    dir = mkdtempSync(join(tmpdir(), 'shapes-'))
    writeFileSync(join(dir, 'packs.json'), JSON.stringify(packs))
    for (const [pack, names] of Object.entries(files)) {
      mkdirSync(join(dir, pack), { recursive: true })
      for (const name of names) writeFileSync(join(dir, pack, name), '<svg><path d="M0 0h1v1z"/></svg>')
    }
    return dir
  }
  const pack = { name: 'A', author: 'Me', license: 'MIT', url: 'https://example.com' }

  it('needs a licence', () => {
    expect(() => buildLibrary(make({ order: ['a'], packs: { a: { ...pack, license: '' } } }))).toThrow('has no license')
  })

  it('needs every described pack in the order, and the reverse', () => {
    expect(() => buildLibrary(make({ order: ['a'], packs: { a: pack, b: pack } }))).toThrow('not in order')
    expect(() => buildLibrary(make({ order: ['a', 'b'], packs: { a: pack } }))).toThrow('not described')
  })

  it('needs at least one shape per pack', () => {
    expect(() => buildLibrary(make({ order: ['a'], packs: { a: pack } }, { a: [] }))).toThrow('has no shapes')
  })
})
