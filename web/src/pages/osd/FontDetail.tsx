import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { GlyphSheet } from '../../components/osd/GlyphSheet'
import { useFont } from '../../hooks/useFont'
import { useVariants } from '../../hooks/useVariants'

export function FontDetail() {
  const { variant: variantId } = useParams<{ variant: string }>()
  const variants = useVariants()
  const variant =
    variants.state === 'loaded' ? variants.variants.find((v) => v.id === variantId) : undefined
  const font = useFont(variant?.output)

  if (variants.state === 'loading') return <p className="text-zinc-400">Loading…</p>
  if (variants.state === 'error')
    return <p className="text-red-400">Failed to load variants: {variants.message}</p>
  if (!variant)
    return (
      <div className="space-y-3">
        <p className="text-red-400">No such font: {variantId}</p>
        <Link to="/osd" className="text-sm text-accent hover:underline">
          Back to the fonts
        </Link>
      </div>
    )

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/osd"
          className="flex w-fit items-center gap-1.5 text-sm text-zinc-400 hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          All fonts
        </Link>
        <h1 className="mt-3 font-mono text-2xl font-semibold text-zinc-50">{variant.id}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          {variant.description}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`/osd/fonts/${variant.output}`}
          download={variant.output}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim"
        >
          <Download className="h-4 w-4" />
          {variant.output}
        </a>
        {variant.craftName && (
          <a
            href={`/osd/fonts/${variant.craftName}`}
            download={variant.craftName}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-accent/50 hover:text-accent"
          >
            <Download className="h-4 w-4" />
            craft-name build
          </a>
        )}
      </div>

      <section>
        <h2 className="text-lg font-semibold text-zinc-100">Boot splash</h2>
        <img
          src={`/osd/previews/${variant.id}_logo_preview.png`}
          alt={`Boot splash for ${variant.id}`}
          className="mt-3 w-full rounded-lg border border-zinc-800 bg-black"
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-100">All 256 glyphs</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Decoded from the <code className="font-mono">.mcm</code> in your browser. Checkerboard
          means transparent — the video feed shows through.
        </p>
        <div className="mt-4">
          {font.state === 'loading' && <p className="text-zinc-400">Decoding font…</p>}
          {font.state === 'error' && <p className="text-red-400">{font.message}</p>}
          {font.state === 'loaded' && <GlyphSheet font={font.font} />}
        </div>
      </section>
    </div>
  )
}
