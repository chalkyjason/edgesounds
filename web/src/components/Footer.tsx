import { Coffee, Code2 } from 'lucide-react'

// Update this once your Buy Me A Coffee handle is set up.
// Path is `https://buymeacoffee.com/<handle>`.
const BMAC_URL = 'https://buymeacoffee.com/chalkyjason'
const REPO_URL = 'https://github.com/chalkyjason/edgesounds'

export function Footer() {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <p>Made by a pilot who's crashed too many times.</p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={BMAC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs hover:border-accent/60 hover:text-accent"
          >
            <Coffee className="h-3.5 w-3.5" />
            <span>Buy me a coffee</span>
          </a>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs hover:border-accent/60 hover:text-accent"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Source</span>
          </a>
          <p className="font-mono text-xs">
            EdgeTX is a separate project &mdash; we're just here to feed it good audio.
          </p>
        </div>
      </div>
    </footer>
  )
}
