import { Link } from 'react-router-dom'
import { ArrowRight, Radio, Type } from 'lucide-react'

const HALVES = [
  {
    to: '/sounds/convert',
    icon: Radio,
    title: 'Sounds',
    tagline: 'Make your radio talk back.',
    body: 'Convert any audio file to the 32 kHz mono 16-bit .wav EdgeTX actually accepts — entirely in your browser, nothing uploaded. Plus a library of ready-to-flash callouts, and a setup guide covering the filenames EdgeTX triggers on its own.',
    cta: 'Convert a sound',
  },
  {
    to: '/osd',
    icon: Type,
    title: 'OSD Fonts',
    tagline: 'Make your feed readable.',
    body: 'Custom MAX7456 character sets for Betaflight, in three variants — from the full Army Jay letterforms to a high-readability set built for a degraded analog feed. Every glyph is previewed here, decoded from the font file itself.',
    cta: 'Browse the fonts',
  },
]

export function Landing() {
  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          FPV tooling that runs in your browser
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Army Jay
        </h1>
        <p className="max-w-2xl text-zinc-400">
          Two tools for the same cockpit: the sounds your radio plays, and the font your
          goggles render. No accounts, no uploads, no server doing the work.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {HALVES.map((half) => (
          <Link
            key={half.to}
            to={half.to}
            className="group flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 transition-colors hover:border-accent/50"
          >
            <half.icon className="h-6 w-6 text-accent" />
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">{half.title}</h2>
              <p className="text-sm text-accent/80">{half.tagline}</p>
            </div>
            <p className="flex-1 text-sm leading-relaxed text-zinc-400">{half.body}</p>
            <span className="mt-1 flex items-center gap-1.5 text-sm font-medium text-zinc-300 group-hover:text-accent">
              {half.cta}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
