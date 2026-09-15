import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react'
import { useToast } from '../hooks/useToast'

const ICONS = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
}

const TONES = {
  success: 'border-accent/30 bg-accent/10 text-accent',
  info: 'border-zinc-700 bg-zinc-900 text-zinc-200',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex min-w-[260px] items-start gap-2 rounded-md border px-3 py-2 text-sm shadow-lg ${TONES[t.kind]}`}
          >
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="text-current opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
