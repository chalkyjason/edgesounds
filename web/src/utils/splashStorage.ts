// The start-screen design, one record, in the shared 'armyjay_osd' database.
//
// The layer stack, the paint over it, and the one image the image layers
// draw from, kept as a Blob so thresholds can be re-applied after a reload;
// decoded pixels are not stored. A design saved before layers (no
// `version`) is converted on load. Undo history is not persisted.

import type { EmblemDesign, V1Design } from '../lib/emblem/design'
import { SPLASH_STORE, reqAsPromise, withStore } from './osdDb'

/** What is stored: the current format, or a design saved before layers. */
type SplashRecord = { id: 'current'; savedAt: number } & (EmblemDesign | V1Design)

/** The saved design as stored; a version-1 design is converted by the caller (see migrateV1). */
export async function loadDesign(): Promise<EmblemDesign | V1Design | null> {
  return withStore(SPLASH_STORE, 'readonly', async (store) => {
    const found = await reqAsPromise<SplashRecord | undefined>(store.get('current'))
    if (!found) return null
    const { id: _id, savedAt: _savedAt, ...design } = found
    return design
  })
}

export async function saveDesign(design: EmblemDesign): Promise<void> {
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
