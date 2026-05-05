import { NavLink } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useMySounds } from '../hooks/useMySounds'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/library', label: 'Library' },
  { to: '/convert', label: 'Convert' },
  { to: '/my', label: 'My Sounds' },
  { to: '/setup', label: 'Setup' },
]

export function Nav() {
  const { sounds } = useMySounds()
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 text-zinc-100 hover:text-accent">
          <Radio className="h-5 w-5 text-accent" />
          <span className="font-mono text-sm tracking-wider">EDGESOUNDS</span>
        </NavLink>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors',
                  isActive
                    ? 'bg-accent/10 text-accent'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100',
                ].join(' ')
              }
            >
              <span>{l.label}</span>
              {l.to === '/my' && sounds.length > 0 && (
                <span className="rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] leading-none text-accent">
                  {sounds.length}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
