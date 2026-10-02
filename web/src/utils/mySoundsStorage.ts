// IndexedDB-backed storage for the "My Sounds" tab.
// Single store keyed by id; oldest entries auto-evict beyond MAX_ENTRIES.
// Blobs are stored directly (IndexedDB supports them natively — no base64 inflation).

import { inStore, openDatabase, reqAsPromise } from './idb'

export interface MySoundEntry {
  id: string
  filename: string
  displayName: string
  duration: number
  sizeBytes: number
  savedAt: number
  blob: Blob
}

const DB_NAME = 'edgesounds'
const DB_VERSION = 1
const STORE = 'my_sounds'
export const MAX_ENTRIES = 30

function openDB(): Promise<IDBDatabase> {
  return openDatabase(DB_NAME, DB_VERSION, (db) => {
    if (!db.objectStoreNames.contains(STORE)) {
      const store = db.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('savedAt', 'savedAt')
    }
  })
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  return inStore(openDB, STORE, mode, fn)
}

export async function listMySounds(): Promise<MySoundEntry[]> {
  return withStore('readonly', async (store) => {
    const all = (await reqAsPromise(store.getAll())) as MySoundEntry[]
    return all.sort((a, b) => b.savedAt - a.savedAt)
  })
}

export async function addMySound(entry: MySoundEntry): Promise<void> {
  await withStore('readwrite', async (store) => {
    await reqAsPromise(store.put(entry))
  })
  // Evict oldest beyond MAX_ENTRIES so storage stays bounded
  const all = await listMySounds()
  if (all.length > MAX_ENTRIES) {
    const toDelete = all.slice(MAX_ENTRIES)
    await withStore('readwrite', async (store) => {
      for (const e of toDelete) {
        await reqAsPromise(store.delete(e.id))
      }
    })
  }
}

export async function deleteMySound(id: string): Promise<void> {
  await withStore('readwrite', async (store) => {
    await reqAsPromise(store.delete(id))
  })
}

export async function clearMySounds(): Promise<void> {
  await withStore('readwrite', async (store) => {
    await reqAsPromise(store.clear())
  })
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
