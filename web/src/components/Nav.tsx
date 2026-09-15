import { NavLink } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useMySounds } from '../hooks/useMySounds'

interface NavItem {
  to: string
  label: string
  end?: boolean
}

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Sounds',
    items: [
      { to: '/sounds/library', label: 'Library' },
      { to: '/sounds/convert', label: 'Convert' },
      { to: '/sounds/my', label: 'My Sounds' },
      { to: '/sounds/setup', label: 'Setup' },
    ],
  },
  {
    label: 'OSD Fonts',
    items: [{ to: '/osd', label: 'Browse', end: true }],
  },
]

function linkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors',
    isActive
      ? 'bg-accent/10 text-accent'
      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100',
  ].join(' ')
}

export function Nav() {
  const { sounds } = useMySounds()

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 text-zinc-100 hover:text-accent">
          <Radio className="h-5 w-5 text-accent" />
          <span className="font-mono text-sm tracking-wider">ARMY JAY</span>
        </NavLink>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {GROUPS.map((group) => (
            <div key={group.label} className="flex items-center gap-1">
              <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                {group.label}
              </span>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
                  <span>{item.label}</span>
                  {item.to === '/sounds/my' && sounds.length > 0 && (
                    <span className="rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] leading-none text-accent">
                      {sounds.length}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </header>
  )
}
