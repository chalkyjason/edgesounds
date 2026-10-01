// The one IndexedDB database the OSD half owns: 'armyjay_osd'.
//
// Every store lives here so there is a single version number and a single
// upgrade path. A module that opened the database with its own version would
// race the others: whichever opened first would set the version, and the
// next open with a lower number would throw VersionError.
//
// Separate from 'edgesounds' on purpose: the sounds store has its own users
// and its own upgrade history, and the two features share nothing.

export const DB_NAME = 'armyjay_osd'
export const DB_VERSION = 2

export const FONT_EDITS_STORE = 'font_edits'
export const SPLASH_STORE = 'splash'

/** Every store, in the version it arrived: 1 = font_edits, 2 = splash. */
const STORES = [FONT_EDITS_STORE, SPLASH_STORE] as const

/** Create whichever stores are missing. Exported so the upgrade is testable. */
export function upgrade(db: Pick<IDBDatabase, 'objectStoreNames' | 'createObjectStore'>): void {
  for (const name of STORES) {
    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
  }
}

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => upgrade(req.result)
  })
}

export function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const db = await openDB()
  try {
    const tx = db.transaction(storeName, mode)
    const result = await fn(tx.objectStore(storeName))
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
