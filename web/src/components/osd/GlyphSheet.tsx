import { GLYPH_COUNT } from '../../lib/mcm/decode'
import type { Font } from '../../lib/mcm/types'
import { GlyphCanvas } from './GlyphCanvas'

const hex = (index: number) => `0x${index.toString(16).toUpperCase().padStart(2, '0')}`

/**
 * All 256 glyphs, rendered from the decoded font rather than from a
 * pre-rendered PNG. The codec is therefore exercised on every page view: a
 * decode bug shows up as a visibly wrong glyph instead of a silent bad byte.
 */
export function GlyphSheet({ font }: { font: Font }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
      {Array.from({ length: GLYPH_COUNT }, (_, index) => (
        <figure
          key={index}
          className="flex flex-col items-center gap-1 rounded border border-zinc-800 bg-zinc-950 p-1.5"
          title={`${hex(index)} (${index})`}
        >
          <GlyphCanvas glyph={font[index]} scale={3} />
          <figcaption className="font-mono text-[9px] leading-none text-zinc-500">
            {hex(index)}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
