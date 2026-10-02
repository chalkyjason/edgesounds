import type { Pixel } from '../../lib/mcm/types'

/** The three MAX7456 pixel values as paint swatches, shared by both pixel editors. */
export const PALETTE: { value: Pixel; label: string; swatch: string }[] = [
  { value: 'white', label: 'White', swatch: 'bg-white' },
  { value: 'black', label: 'Black', swatch: 'bg-black border border-zinc-600' },
  { value: 'transparent', label: 'Clear', swatch: 'bg-zinc-800 border border-zinc-600' },
]
