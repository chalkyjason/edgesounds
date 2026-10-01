/**
 * Paths for a ZIP of saved sounds, given their filenames newest first.
 *
 * EdgeTX plays sounds by exact filename, so a duplicate can't be renamed:
 * the newest copy of each name sits at the top level, ready to drop into
 * /SOUNDS/<lang>/, and older copies go in copy-2/, copy-3/ and so on rather
 * than overwriting it in the archive.
 */
export function zipPaths(filenames: string[]): string[] {
  const seen = new Map<string, number>()
  return filenames.map((name) => {
    const key = name.toLowerCase()
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    return count === 1 ? name : `copy-${count}/${name}`
  })
}
