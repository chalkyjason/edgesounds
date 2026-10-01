/** A font the start screen can be exported into. */
export interface ExportBase {
  id: string
  /** Filename under /osd/fonts/. */
  output: string
  label: string
  note?: string
}

/** Betaflight's own default font, vendored as a reference and staged for the export page. */
export const STOCK_BASE: ExportBase = {
  id: 'betaflight_default',
  output: 'betaflight_default.mcm',
  label: "Betaflight's default font",
  note: 'GPL-3.0 — a font exported from it carries the same licence.',
}
