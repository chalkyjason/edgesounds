// IndexedDB-backed storage for edited OSD fonts.
//
// A separate database from 'edgesounds' on purpose: adding a store to that one
// would mean a version bump and an upgrade path over users' saved sounds, for
// no benefit. These two features share nothing.
//
// Only the DIFF is stored, not the whole font. A font is 256 x 216 pixels;
// almost every edit touches a handful of glyphs, and keeping the base font by
// reference means an edit survives the pipeline rebuilding that variant.

import type { Pixel } from '../lib/mcm/types'

export interface FontEdit {
  /** `${variantId}` — one saved edit per variant. */
  id: string
  variantId: string
  /** Glyph index (0-255) -> its full 216-pixel override. */
  edits: Record<number, Pixel[]>
  savedAt: number
}

const DB_NAME = 'armyjay_osd'
const DB_VERSION = 1
const STORE = 'font_edits'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
  })
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDB()
  try {
    const tx = db.transaction(STORE, mode)
    const result = await fn(tx.objectStore(STORE))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
    return result
  } finally {
    db.close()
  }
}

export async function loadEdit(variantId: string): Promise<FontEdit | null> {
  return withStore('readonly', async (store) => {
    const found = await reqAsPromise<FontEdit | undefined>(store.get(variantId))
    return found ?? null
  })
}

export async function saveEdit(variantId: string, edits: Record<number, Pixel[]>): Promise<void> {
  const record: FontEdit = { id: variantId, variantId, edits, savedAt: Date.now() }
  await withStore('readwrite', async (store) => {
    await reqAsPromise(store.put(record))
  })
}

export async function clearEdit(variantId: string): Promise<void> {
  await withStore('readwrite', async (store) => {
    await reqAsPromise(store.delete(variantId))
  })
}

export async function listEdits(): Promise<FontEdit[]> {
  return withStore('readonly', async (store) => {
    const all = await reqAsPromise<FontEdit[]>(store.getAll())
    return all.sort((a, b) => b.savedAt - a.savedAt)
  })
}
