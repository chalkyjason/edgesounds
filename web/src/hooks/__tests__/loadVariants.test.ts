import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadVariants, resetVariantsCache } from '../useVariants'

const VARIANTS = [{ id: 'armyjay_full', output: 'armyjay_full.mcm' }]

beforeEach(() => resetVariantsCache())
afterEach(() => vi.unstubAllGlobals())

describe('loadVariants', () => {
  it('fetches variants.json once for every caller', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(VARIANTS)))
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([loadVariants(), loadVariants()])
    await loadVariants()
    expect(a).toEqual(VARIANTS)
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries after a failure instead of caching it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(VARIANTS)))
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadVariants()).rejects.toThrow('Failed to fetch variants: 500')
    await expect(loadVariants()).resolves.toEqual(VARIANTS)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
