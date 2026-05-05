import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  addMySound as addStorage,
  clearMySounds as clearStorage,
  deleteMySound as deleteStorage,
  listMySounds,
  newId,
  type MySoundEntry,
} from '../utils/mySoundsStorage'

interface SaveInput {
  filename: string
  displayName: string
  duration: number
  blob: Blob
}

type Ctx = {
  sounds: MySoundEntry[]
  loading: boolean
  save: (input: SaveInput) => Promise<MySoundEntry>
  remove: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

const MySoundsContext = createContext<Ctx | null>(null)

export function MySoundsProvider({ children }: { children: ReactNode }) {
  const [sounds, setSounds] = useState<MySoundEntry[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const all = await listMySounds()
      setSounds(all)
    } catch (e) {
      console.error('[MySounds] failed to load', e)
      setSounds([])
    }
  }, [])

  useEffect(() => {
    void refresh().finally(() => setLoading(false))
  }, [refresh])

  const save = useCallback(
    async (input: SaveInput): Promise<MySoundEntry> => {
      const entry: MySoundEntry = {
        id: newId(),
        filename: input.filename,
        displayName: input.displayName,
        duration: input.duration,
        sizeBytes: input.blob.size,
        savedAt: Date.now(),
        blob: input.blob,
      }
      await addStorage(entry)
      await refresh()
      return entry
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteStorage(id)
      await refresh()
    },
    [refresh]
  )

  const clearAll = useCallback(async () => {
    await clearStorage()
    await refresh()
  }, [refresh])

  return (
    <MySoundsContext.Provider value={{ sounds, loading, save, remove, clearAll }}>
      {children}
    </MySoundsContext.Provider>
  )
}

export function useMySounds(): Ctx {
  const ctx = useContext(MySoundsContext)
  if (!ctx) throw new Error('useMySounds must be used inside <MySoundsProvider>')
  return ctx
}
