import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Download } from 'lucide-react'
import { useVariants } from '../../hooks/useVariants'

export function OsdHome() {
  const state = useVariants()

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">
          Betaflight · MAX7456 analog OSD
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">OSD Fonts</h1>
        <p className="max-w-2xl text-zinc-400">
          A MAX7456 character set replaces the 256 glyphs your flight controller draws over the
          video feed — the numbers, the icons, the warnings, and the boot splash. These are built
          from source and verified against Betaflight Configurator&rsquo;s own parser before they
          ship.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold text-zinc-100">Variants</h2>
        {state.state === 'loading' && <p className="mt-3 text-zinc-400">Loading variants…</p>}
        {state.state === 'error' && (
          <p className="mt-3 text-red-400">Failed to load variants: {state.message}</p>
        )}
        {state.state === 'loaded' && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {state.variants.map((variant) => (
              <Link
                key={variant.id}
                to={`/osd/fonts/${variant.id}`}
                className="group flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-accent/50"
              >
                <img
                  src={`/osd/previews/${variant.id}_logo_preview.png`}
                  alt=""
                  className="rounded border border-zinc-800 bg-black"
                  loading="lazy"
                />
                <h3 className="font-mono text-sm text-zinc-100">{variant.id}</h3>
                <p className="flex-1 text-xs leading-relaxed text-zinc-400">
                  {variant.description}
                </p>
                <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 group-hover:text-accent">
                  All 256 glyphs
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold text-zinc-100">Installing</h2>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Props off.</strong> Always — you are connecting a powered flight controller to
            a computer.
          </p>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          <li>Connect the flight controller to Betaflight Configurator.</li>
          <li>
            Some boards need a LiPo connected to power the OSD chip during upload — USB 5&nbsp;V
            alone may not bring it up. If Font Manager reports a failure or the glyphs come back
            garbled, this is usually why.
          </li>
          <li>
            <strong>OSD</strong> tab → <strong>Font Manager</strong> →{' '}
            <strong>Open Font File</strong> → pick the <code className="font-mono">.mcm</code> →{' '}
            <strong>Upload Font</strong>.
          </li>
          <li>Reboot the flight controller.</li>
        </ol>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
          <Download className="h-3.5 w-3.5" />
          Uploading a font writes only to the OSD chip&rsquo;s character memory. It does not touch
          your tune, rates, or modes.
        </p>
      </section>
    </div>
  )
}
