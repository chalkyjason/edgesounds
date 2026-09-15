import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-zinc-200">
        <h1 className="text-2xl font-semibold text-red-400">Something broke.</h1>
        <p className="mt-2 text-sm text-zinc-400">
          The page hit an unexpected error. The audio engine and your library are still safe — it's just this view that's misbehaving.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-xs text-zinc-300">
          {this.state.error.message}
        </pre>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:border-accent/60 hover:text-accent"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-accent-dim"
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
