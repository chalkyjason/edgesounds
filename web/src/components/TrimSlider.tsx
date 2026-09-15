import { formatDuration } from '../utils/validateAudio'

export function TrimSlider({
  duration,
  start,
  end,
  onChangeStart,
  onChangeEnd,
}: {
  duration: number
  start: number
  end: number
  onChangeStart: (v: number) => void
  onChangeEnd: (v: number) => void
}) {
  const max = Math.max(duration, 0)
  const span = end - start

  return (
    <div className="space-y-2">
      <label className="block text-sm text-zinc-300">
        Trim ({formatDuration(start)} → {formatDuration(end)} · {span.toFixed(2)}s)
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 text-xs text-zinc-500">Start</div>
          <input
            type="range"
            min={0}
            max={max}
            step={0.05}
            value={start}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v < end) onChangeStart(v)
            }}
            className="w-full accent-accent"
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-zinc-500">End</div>
          <input
            type="range"
            min={0}
            max={max}
            step={0.05}
            value={end}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (v > start) onChangeEnd(v)
            }}
            className="w-full accent-accent"
          />
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        EdgeTX sounds are usually 1–3 seconds. Keep it short.
      </p>
    </div>
  )
}
