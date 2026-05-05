import type { ConversionStatus } from '../types'

export function ConversionProgress({ status }: { status: ConversionStatus }) {
  if (status.state === 'idle' || status.state === 'done') return null

  let label = ''
  let pct = 0
  if (status.state === 'loading-engine') {
    label = 'Loading audio engine (~30 MB, one-time)…'
    pct = 0
  } else if (status.state === 'converting') {
    label = `Converting… ${Math.round(status.progress * 100)}%`
    pct = status.progress * 100
  } else if (status.state === 'error') {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
        <div className="font-medium">Conversion failed</div>
        <div className="mt-1 text-red-200/80">{status.message}</div>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between text-sm text-zinc-300">
        <span>{label}</span>
        {status.state === 'loading-engine' && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-r-transparent" />
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${status.state === 'loading-engine' ? 12 : pct}%` }}
        />
      </div>
    </div>
  )
}
