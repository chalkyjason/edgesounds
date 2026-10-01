// The start-screen design, one record, in the shared 'armyjay_osd' database.
//
// The image's source file is kept as a Blob so the threshold and the other
// settings can be re-applied after a reload; the decoded pixels are not
// stored, they are cheap to recompute. Paint is the sparse override map.
// Undo history is deliberately not persisted (see useFontEditor for why).

import type { Pixel } from '../lib/mcm/types'
import type { ImageOptions } from '../lib/splash/image'
import type { PaintLayer } from '../lib/splash/raster'
import type { TemplateInput } from '../lib/splash/template'
import { SPLASH_STORE, reqAsPromise, withStore } from './osdDb'

export interface SplashRecord {
  id: 'current'
  generator: 'text' | 'image'
  text: TemplateInput
  image: ImageOptions & { source: Blob | null; sourceName: string | null }
  paint: PaintLayer
  savedAt: number
}

export type SplashDesign = Omit<SplashRecord, 'id' | 'savedAt'>

export const DEFAULT_DESIGN: SplashDesign = {
  generator: 'text',
  text: { big: '', small: '', rules: true },
  image: { source: null, sourceName: null, threshold: 128, invert: false, background: 'transparent', outline: false },
  paint: {},
}

export async function loadDesign(): Promise<SplashDesign | null> {
  return withStore(SPLASH_STORE, 'readonly', async (store) => {
    const found = await reqAsPromise<SplashRecord | undefined>(store.get('current'))
    if (!found) return null
    const { id: _id, savedAt: _savedAt, ...design } = found
    return design
  })
}

export async function saveDesign(design: SplashDesign): Promise<void> {
  const record: SplashRecord = { id: 'current', ...design, savedAt: Date.now() }
  await withStore(SPLASH_STORE, 'readwrite', async (store) => {
    await reqAsPromise(store.put(record))
  })
}

export async function clearDesign(): Promise<void> {
  await withStore(SPLASH_STORE, 'readwrite', async (store) => {
    await reqAsPromise(store.delete('current'))
  })
}

export type { Pixel }
