/** One entry of public/osd/variants.json, written by scripts/stage-osd-assets.mjs. */
export interface OsdVariant {
  id: string
  output: string
  description: string
  /** Matching craft-name build, or null if the pipeline did not produce one. */
  craftName: string | null
}
