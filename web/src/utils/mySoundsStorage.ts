// IndexedDB-backed storage for the "My Sounds" tab.
// Single store keyed by id; oldest entries auto-evict beyond MAX_ENTRIES.
// Blobs are stored directly (IndexedDB supports them natively — no base64 inflation).

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
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('savedAt', 'savedAt')
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
  fn: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDB()
  const tx = db.transaction(STORE, mode)
  const store = tx.objectStore(STORE)
  try {
    const result = await fn(store)
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
