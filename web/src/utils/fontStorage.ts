// IndexedDB-backed storage for edited OSD fonts, in the shared 'armyjay_osd'
// database (see osdDb.ts).
//
// Only the DIFF is stored, not the whole font. A font is 256 x 216 pixels;
// almost every edit touches a handful of glyphs, and keeping the base font by
// reference means an edit survives the pipeline rebuilding that variant.

import type { Pixel } from '../lib/mcm/types'
import { FONT_EDITS_STORE, reqAsPromise, withStore } from './osdDb'

export interface FontEdit {
  /** `${variantId}` — one saved edit per variant. */
  id: string
  variantId: string
  /** Glyph index (0-255) -> its full 216-pixel override. */
  edits: Record<number, Pixel[]>
  savedAt: number
}

export async function loadEdit(variantId: string): Promise<FontEdit | null> {
  return withStore(FONT_EDITS_STORE, 'readonly', async (store) => {
    const found = await reqAsPromise<FontEdit | undefined>(store.get(variantId))
    return found ?? null
  })
}

export async function saveEdit(variantId: string, edits: Record<number, Pixel[]>): Promise<void> {
  const record: FontEdit = { id: variantId, variantId, edits, savedAt: Date.now() }
  await withStore(FONT_EDITS_STORE, 'readwrite', async (store) => {
    await reqAsPromise(store.put(record))
  })
}
