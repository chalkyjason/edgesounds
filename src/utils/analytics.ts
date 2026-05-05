type EventName =
  | 'convert_start'
  | 'convert_complete'
  | 'convert_error'
  | 'library_download'
  | 'library_zip_download'

export function track(_event: EventName, _props?: Record<string, unknown>): void {
  // Stub. Wire up later (Plausible/Umami/etc.) — keep it privacy-friendly.
}
