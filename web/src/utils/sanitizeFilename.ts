// EdgeTX stores a Play Track filename in a LEN_FUNCTION_NAME buffer, which is 8
// on every radio variant (radio/src/dataconstants.h — COLORLCD, LCD_W==212 and
// b&w all define it as 8). The old value here was 6, which silently truncated
// legitimate names: SYSTEM sounds like `thralert` and `inactiv` were unreachable.
export const MAX_FILENAME_LENGTH = 8

export function sanitizeFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, MAX_FILENAME_LENGTH)
}

export function ensureWavExtension(filename: string): string {
  return filename.toLowerCase().endsWith('.wav') ? filename : `${filename}.wav`
}
