export const MAX_FILENAME_LENGTH = 6

export function sanitizeFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, MAX_FILENAME_LENGTH)
}

export function isValidFilename(input: string): boolean {
  if (!input) return false
  if (input.length > MAX_FILENAME_LENGTH) return false
  return /^[a-z0-9_]+$/.test(input)
}

export function ensureWavExtension(filename: string): string {
  return filename.toLowerCase().endsWith('.wav') ? filename : `${filename}.wav`
}
