import { isNativeApp } from './platform'

export type SaveOutcome = 'saved' | 'cancelled'

/**
 * Raw bytes per call across the native bridge. A multiple of 3, so every
 * chunk but the last encodes to base64 with no padding.
 */
export const CHUNK_BYTES = 768 * 1024

const EXPORT_DIR = 'exports'
const SHARE_BUSY_RETRIES = 3
const SHARE_BUSY_RETRY_MS = 250

// Saves run one at a time in the app. Each one clears EXPORT_DIR before it
// writes, so two overlapping saves would delete each other's file.
let queue: Promise<unknown> = Promise.resolve()

/**
 * Hand the user a file: a browser download on the web, the share sheet in the
 * iPhone app.
 *
 * `source` is the file's bytes, or a URL to fetch them from -- a static path
 * or a `blob:` URL. Resolves 'cancelled' only in the app, when the share
 * sheet is dismissed.
 */
export async function saveFile(filename: string, source: Blob | string): Promise<SaveOutcome> {
  if (!isNativeApp()) {
    downloadInBrowser(filename, source)
    return 'saved'
  }
  const run = queue.then(() => shareOnDevice(filename, source))
  queue = run.catch(() => undefined)
  return run
}

function downloadInBrowser(filename: string, source: Blob | string): void {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  if (typeof source !== 'string') URL.revokeObjectURL(url)
}

async function shareOnDevice(filename: string, source: Blob | string): Promise<SaveOutcome> {
  // The name is used as a path segment, and the share sheet shows it as-is.
  if (!/^[^./\\][^/\\]*$/.test(filename)) throw new Error(`Cannot save a file named "${filename}"`)

  const bytes = await readBytes(filename, source)
  if (bytes.length === 0) throw new Error(`${filename} is empty`)

  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const directory = Directory.Cache
  const path = `${EXPORT_DIR}/${filename}`

  // Clear the previous export now rather than this one after sharing: the
  // app receiving the file may still be reading it when the sheet closes.
  await Filesystem.rmdir({ path: EXPORT_DIR, directory, recursive: true }).catch(() => undefined)

  // Written under its real name, because "Save to Files" keeps the on-disk
  // name and EdgeTX triggers on exact filenames.
  const { uri } = await Filesystem.writeFile({
    path,
    directory,
    recursive: true,
    data: toBase64(bytes.subarray(0, CHUNK_BYTES)),
  })
  for (let offset = CHUNK_BYTES; offset < bytes.length; offset += CHUNK_BYTES) {
    await Filesystem.appendFile({
      path,
      directory,
      data: toBase64(bytes.subarray(offset, offset + CHUNK_BYTES)),
    })
  }

  // The previous sheet's completion can fire while its dismissal is still
  // animating, and the Share plugin refuses to present over it. That window
  // is a few hundred milliseconds, so wait it out rather than fail the save.
  for (let attempt = 0; ; attempt += 1) {
    try {
      await Share.share({ url: uri })
      return 'saved'
    } catch (error) {
      if (isShareCancel(error)) return 'cancelled'
      if (!isShareBusy(error) || attempt >= SHARE_BUSY_RETRIES) throw error
      await new Promise((resolve) => setTimeout(resolve, SHARE_BUSY_RETRY_MS))
    }
  }
}

async function readBytes(filename: string, source: Blob | string): Promise<Uint8Array> {
  if (typeof source !== 'string') return new Uint8Array(await source.arrayBuffer())
  let response: Response
  try {
    response = await fetch(source)
  } catch {
    throw new Error(`Could not load ${filename}`)
  }
  // Capacitor's asset handler serves bundled audio through its range-request
  // path, which arrives here as status 0 with the full body; a missing file
  // throws above instead. So status 0 is accepted, and an empty body is
  // caught by the caller's size check.
  if (!response.ok && response.status !== 0) throw new Error(`Could not load ${filename}`)
  return new Uint8Array(await response.arrayBuffer())
}

/** The Share plugin rejects with exactly this message when the sheet is dismissed. */
function isShareCancel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /share cancell?ed/i.test(message)
}

/** ...and with this one when another sheet is still on screen. */
function isShareBusy(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /sharing is in progress/i.test(message)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  // Spread in slices: one call with every byte overflows the argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}
