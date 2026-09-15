import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'

// All three assets are served from public/ffmpeg/ so they're same-origin.
// This avoids COEP/CORP friction with cross-origin fetches in a
// cross-origin-isolated context, and lets the worker's importScripts succeed.
// Files are copied from node_modules during dev/build (see scripts/sync-ffmpeg.ps1
// and the postinstall hook in package.json).
const CORE_URL = '/ffmpeg/ffmpeg-core.js'
const WASM_URL = '/ffmpeg/ffmpeg-core.wasm'
const CLASS_WORKER_URL = '/ffmpeg/814.ffmpeg.js'

type FFmpegContextValue = {
  load: () => Promise<FFmpeg>
  isLoaded: boolean
  isLoading: boolean
  error: string | null
}

const FFmpegContext = createContext<FFmpegContextValue | null>(null)

export function FFmpegProvider({ children }: { children: ReactNode }) {
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const loadPromiseRef = useRef<Promise<FFmpeg> | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (ffmpegRef.current && isLoaded) return ffmpegRef.current
    if (loadPromiseRef.current) return loadPromiseRef.current

    setIsLoading(true)
    setError(null)

    const promise = (async () => {
      const ffmpeg = new FFmpeg()
      ffmpegRef.current = ffmpeg
      try {
        await ffmpeg.load({
          coreURL: CORE_URL,
          wasmURL: WASM_URL,
          classWorkerURL: CLASS_WORKER_URL,
        })
        setIsLoaded(true)
        return ffmpeg
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Failed to load audio engine'
        setError(message)
        ffmpegRef.current = null
        loadPromiseRef.current = null
        throw e
      } finally {
        setIsLoading(false)
      }
    })()

    loadPromiseRef.current = promise
    return promise
  }, [isLoaded])

  useEffect(() => {
    return () => {
      ffmpegRef.current?.terminate()
      ffmpegRef.current = null
    }
  }, [])

  return (
    <FFmpegContext.Provider value={{ load, isLoaded, isLoading, error }}>
      {children}
    </FFmpegContext.Provider>
  )
}

export function useFFmpeg(): FFmpegContextValue {
  const ctx = useContext(FFmpegContext)
  if (!ctx) throw new Error('useFFmpeg must be used inside <FFmpegProvider>')
  return ctx
}
