import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

type ToastContextValue = {
  toasts: Toast[]
  notify: (message: string, kind?: ToastKind) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, kind, message }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3500)
    },
    []
  )

  return (
    <ToastContext.Provider value={{ toasts, notify, dismiss }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
