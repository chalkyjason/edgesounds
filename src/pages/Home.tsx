import { Link } from 'react-router-dom'
import { ArrowRight, Plane, Sliders, Wand2, Zap } from 'lucide-react'
import { useLibrary } from '../hooks/useLibrary'
import { SoundCard } from '../components/SoundCard'

export function Home() {
  const lib = useLibrary()
  const featured =
    lib.state === 'loaded'
      ? lib.library.categories.flatMap((c) => c.sounds).slice(0, 6)
      : []

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/5 px-3 py-1 text-xs uppercase tracking-wider text-accent">
            <Zap className="h-3 w-3" /> EdgeTX-ready in your browser
          </span>
          <h1 className="text-4xl font-semibold text-zinc-50 md:text-5xl">
            Make your FPV radio <span className="text-accent">talk back.</span>
          </h1>
          <p className="text-zinc-400">
            Convert any audio clip to the exact format EdgeTX wants — 32 kHz mono 16-bit PCM —
            without uploading a thing. Or grab one from the library and drop it on your SD card.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/convert"
              className="flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 font-medium text-zinc-950 hover:bg-accent-dim"
            >
              <Wand2 className="h-4 w-4" />
              Convert a file
            </Link>
            <Link
              to="/library"
              className="flex items-center gap-2 rounded-md border border-zinc-700 px-4 py-2.5 text-zinc-200 hover:border-accent/60 hover:text-accent"
            >
              Browse library <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <PipelineDiagram />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <FeatureCard
          icon={<Wand2 className="h-5 w-5 text-accent" />}
          title="In-browser conversion"
          body="ffmpeg.wasm runs locally. Your audio never leaves the tab."
        />
        <FeatureCard
          icon={<Sliders className="h-5 w-5 text-accent" />}
          title="Trim before you ship"
          body="Most EdgeTX sounds want to be 1–3 seconds. Clip with sliders."
        />
        <FeatureCard
          icon={<Plane className="h-5 w-5 text-accent" />}
          title="Pilot-grade defaults"
          body="6-char filenames, lowercase only, ASCII safe — exactly what the radio expects."
        />
      </section>

      {featured.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="text-2xl font-semibold text-zinc-100">Featured sounds</h2>
            <Link
              to="/library"
              className="text-sm text-accent hover:underline"
            >
              All sounds →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => (
              <SoundCard key={s.id} sound={s} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">First time on EdgeTX?</h2>
        <p className="mt-1 text-sm text-zinc-400">
          The setup guide walks through SD card layout, auto-trigger filenames, and Special Functions.
        </p>
        <Link
          to="/setup"
          className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          Read the setup guide <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-2">{icon}</div>
      <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
      <p className="mt-1 text-sm text-zinc-400">{body}</p>
    </div>
  )
}

function PipelineDiagram() {
  const steps = [
    { label: 'Source audio', sub: 'mp3 · m4a · wav' },
    { label: 'Convert', sub: '32 kHz · mono · 16-bit' },
    { label: 'SD card', sub: '/SOUNDS/<lang>/' },
    { label: 'Fly', sub: 'radio talks back' },
  ]
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 font-mono text-xs text-accent">
              {i + 1}
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium text-zinc-100">{s.label}</div>
              <div className="font-mono text-xs text-zinc-500">{s.sub}</div>
            </div>
            {i < steps.length - 1 && (
              <span className="font-mono text-xs text-zinc-600">↓</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
