import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type SharedAudio = {
  play: (src: string, id: string) => void
  stop: () => void
  currentId: string | null
  isPlaying: boolean
}

const SharedAudioContext = createContext<SharedAudio | null>(null)

export function SharedAudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'none'
    audioRef.current = audio
    const onEnded = () => {
      setCurrentId(null)
      setIsPlaying(false)
    }
    const onPause = () => setIsPlaying(false)
    const onPlay = () => setIsPlaying(true)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('play', onPlay)
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('play', onPlay)
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  const play = useCallback((src: string, id: string) => {
    const audio = audioRef.current
    if (!audio) return
    if (currentId === id && !audio.paused) {
      audio.pause()
      return
    }
    if (audio.src !== src) audio.src = src
    setCurrentId(id)
    void audio.play().catch(() => {
      setCurrentId(null)
      setIsPlaying(false)
    })
  }, [currentId])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
    setCurrentId(null)
    setIsPlaying(false)
  }, [])

  return (
    <SharedAudioContext.Provider value={{ play, stop, currentId, isPlaying }}>
      {children}
    </SharedAudioContext.Provider>
  )
}

export function useSharedAudio(): SharedAudio {
  const ctx = useContext(SharedAudioContext)
  if (!ctx) throw new Error('useSharedAudio must be used inside <SharedAudioProvider>')
  return ctx
}
