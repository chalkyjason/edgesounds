import { Pause, Play } from 'lucide-react'
import { useSharedAudio } from '../hooks/useSharedAudio'

export function AudioPreview({
  src,
  id,
  size = 'md',
}: {
  src: string
  id: string
  size?: 'sm' | 'md'
}) {
  const { play, currentId, isPlaying } = useSharedAudio()
  const active = currentId === id && isPlaying
  const dimensions = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'

  return (
    <button
      onClick={() => play(src, id)}
      className={`flex ${dimensions} items-center justify-center rounded-full border border-accent/30 bg-accent/5 text-accent transition-colors hover:border-accent/60 hover:bg-accent/15`}
      aria-label={active ? 'Pause' : 'Play'}
    >
      {active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
    </button>
  )
}
