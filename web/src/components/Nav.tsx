import { NavLink, useLocation } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useMySounds } from '../hooks/useMySounds'
import { useVariants } from '../hooks/useVariants'

interface SubItem {
  to: string
  label: string
  end?: boolean
}

const SOUNDS_ITEMS: SubItem[] = [
  { to: '/sounds/library', label: 'Library' },
  { to: '/sounds/convert', label: 'Convert' },
  { to: '/sounds/my', label: 'My Sounds' },
  { to: '/sounds/setup', label: 'Setup' },
]

export function Nav() {
  const { sounds } = useMySounds()
  const variants = useVariants()
  const { pathname } = useLocation()

  const inSounds = pathname.startsWith('/sounds')
  const inOsd = pathname.startsWith('/osd')

  // The OSD sub-bar lists the fonts themselves, which is the useful thing to
  // jump between. It degrades to just "All fonts" if variants.json is slow or
  // unavailable, so navigation never depends on that fetch succeeding.
  const osdItems: SubItem[] = [
    { to: '/osd', label: 'All fonts', end: true },
    ...(variants.state === 'loaded'
      ? variants.variants.map((variant) => ({
          to: `/osd/fonts/${variant.id}`,
          label: variant.id.replace(/^armyjay_/, ''),
        }))
      : []),
  ]

  const subItems = inSounds ? SOUNDS_ITEMS : inOsd ? osdItems : []

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-stretch gap-1 px-4 sm:gap-2">
        <NavLink
          to="/"
          className="mr-2 flex shrink-0 items-center gap-2 py-3 text-zinc-100 outline-none transition-colors hover:text-accent focus-visible:text-accent sm:mr-4"
        >
          <Radio className="h-5 w-5 text-accent" />
          <span className="font-mono text-sm tracking-wider">ARMY JAY</span>
        </NavLink>

        <SectionLink to="/sounds" label="Sounds" active={inSounds} />
        <SectionLink to="/osd" label="OSD Fonts" active={inOsd} />
      </div>

      {subItems.length > 0 && (
        <div className="border-t border-zinc-800/60 bg-zinc-900/40">
          <nav
            aria-label={inSounds ? 'Sounds pages' : 'OSD font pages'}
            className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {subItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-accent/70',
                    isActive
                      ? 'bg-accent/10 text-accent'
                      : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100',
                  ].join(' ')
                }
              >
                <span>{item.label}</span>
                {item.to === '/sounds/my' && sounds.length > 0 && (
                  <span className="rounded-full bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] leading-none text-accent">
                    {sounds.length}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}

/**
 * A top-level section. These are the primary targets, so they are full links
 * with a generous hit area -- the previous nav rendered them as inert labels
 * beside their children, which left the two most obvious things to click dead.
 */
function SectionLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <NavLink
      to={to}
      className={[
        'relative flex items-center px-3 py-3 text-sm outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent/70',
        active ? 'text-accent' : 'text-zinc-400 hover:text-zinc-100',
      ].join(' ')}
    >
      {label}
      {/* Solid bar for the active section, the way an OSD marks a live channel. */}
      <span
        aria-hidden="true"
        className={[
          'absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors',
          active ? 'bg-accent' : 'bg-transparent',
        ].join(' ')}
      />
    </NavLink>
  )
}
