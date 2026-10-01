import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ALLOWED_LICENSES, trimLibrary } from '../trim-library.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REAL = JSON.parse(readFileSync(resolve(HERE, '../../public/library.json'), 'utf8'))

const sound = (id, license) => ({ id, path: `/sounds/x/${id}.wav`, ...(license ? { license } : {}) })

describe('trimLibrary on the real library.json', () => {
  const trimmed = trimLibrary(REAL)
  const kept = trimmed.categories.flatMap((c) => c.sounds)

  // The exact set that ships in the App Store build. If this number changes,
  // the library changed: check the new clips really are original, then update.
  it('keeps the 27 original sounds', () => {
    expect(kept).toHaveLength(27)
  })

  it('keeps nothing under any other licence', () => {
    for (const s of kept) expect(ALLOWED_LICENSES).toContain(s.license)
  })

  it('leaves no empty category', () => {
    for (const c of trimmed.categories) expect(c.sounds.length).toBeGreaterThan(0)
  })

  it('actually dropped something, so the filter is not a no-op', () => {
    const total = REAL.categories.flatMap((c) => c.sounds).length
    expect(total).toBeGreaterThan(kept.length)
  })
})

describe('trimLibrary fails closed', () => {
  const library = {
    categories: [
      {
        id: 'mixed',
        sounds: [
          sound('ok', 'generated-original'),
          sound('clip', 'fair-use-personal'),
          sound('unlabelled'),
          sound('shouty', 'Generated-Original'),
          sound('padded', ' generated-original '),
        ],
      },
      { id: 'all-clips', sounds: [sound('film', 'fair-use-personal')] },
      { id: 'no-sounds-key' },
    ],
  }

  it('keeps only an exact licence match', () => {
    const trimmed = trimLibrary(library)
    expect(trimmed.categories.map((c) => c.id)).toEqual(['mixed'])
    expect(trimmed.categories[0].sounds.map((s) => s.id)).toEqual(['ok'])
  })

  it('does not mutate its input', () => {
    const before = JSON.stringify(library)
    trimLibrary(library)
    expect(JSON.stringify(library)).toBe(before)
  })

  it('rejects a file that is not a library', () => {
    expect(() => trimLibrary({})).toThrow('no categories array')
    expect(() => trimLibrary(null)).toThrow('no categories array')
  })
})
