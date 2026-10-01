import { describe, expect, it, vi } from 'vitest'
import { DB_VERSION, FONT_EDITS_STORE, SPLASH_STORE, upgrade } from '../osdDb'

/** A stub IDBDatabase that records createObjectStore calls. */
function stubDb(existing: string[]) {
  const created: [string, unknown][] = []
  return {
    created,
    db: {
      objectStoreNames: { contains: (name: string) => existing.includes(name) } as DOMStringList,
      createObjectStore: vi.fn((name: string, options?: IDBObjectStoreParameters) => {
        created.push([name, options])
        return {} as IDBObjectStore
      }),
    },
  }
}

describe('armyjay_osd upgrade', () => {
  it('is at version 2', () => {
    expect(DB_VERSION).toBe(2)
  })

  it('creates both stores on a fresh database', () => {
    const { db, created } = stubDb([])
    upgrade(db)
    expect(created).toEqual([
      [FONT_EDITS_STORE, { keyPath: 'id' }],
      [SPLASH_STORE, { keyPath: 'id' }],
    ])
  })

  it('leaves a version-1 database its font_edits and adds only splash', () => {
    const { db, created } = stubDb([FONT_EDITS_STORE])
    upgrade(db)
    expect(created).toEqual([[SPLASH_STORE, { keyPath: 'id' }]])
  })

  it('does nothing when both stores exist', () => {
    const { db, created } = stubDb([FONT_EDITS_STORE, SPLASH_STORE])
    upgrade(db)
    expect(created).toEqual([])
  })
})
