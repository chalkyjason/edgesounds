import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNativeApp } from '../platform'
import { CHUNK_BYTES, saveFile } from '../saveFile'

vi.mock('../platform', () => ({ isNativeApp: vi.fn() }))
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: { rmdir: vi.fn(), writeFile: vi.fn(), appendFile: vi.fn() },
}))
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }))

const URI = 'file:///cache/exports/the-file'

/** Deterministic, non-repeating-at-chunk-size bytes, so a misplaced chunk shows. */
function pattern(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length))
  for (let i = 0; i < length; i += 1) bytes[i] = (i * 31 + (i >> 8)) & 0xff
  return bytes
}

/** What the native side would have on disk: each call's base64 decoded, in order. */
function bytesOnDisk(): Uint8Array {
  const calls = [
    ...vi.mocked(Filesystem.writeFile).mock.calls,
    ...vi.mocked(Filesystem.appendFile).mock.calls,
  ]
  const parts = calls.map(([options]) => Buffer.from(options.data as string, 'base64'))
  return new Uint8Array(Buffer.concat(parts))
}

/** Buffer.equals, because toEqual on megabytes of typed array takes seconds. */
function expectSameBytes(actual: Uint8Array, expected: Uint8Array): void {
  expect(actual.length).toBe(expected.length)
  expect(Buffer.from(actual).equals(Buffer.from(expected))).toBe(true)
}

beforeEach(() => {
  vi.mocked(Filesystem.rmdir).mockResolvedValue(undefined)
  vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: URI })
  vi.mocked(Filesystem.appendFile).mockResolvedValue(undefined)
  vi.mocked(Share.share).mockResolvedValue({})
})

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

describe('saveFile in the app', () => {
  beforeEach(() => vi.mocked(isNativeApp).mockReturnValue(true))

  it('writes the exact bytes under the exact filename and shares that file', async () => {
    const bytes = pattern(1000)
    await expect(saveFile('armed.wav', new Blob([bytes]))).resolves.toBe('saved')

    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1)
    expect(Filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'exports/armed.wav', directory: 'CACHE', recursive: true }),
    )
    expect(Filesystem.appendFile).not.toHaveBeenCalled()
    expectSameBytes(bytesOnDisk(), bytes)
    expect(Share.share).toHaveBeenCalledWith({ url: URI })
  })

  it('splits a large file into chunks that reassemble exactly', async () => {
    const bytes = pattern(CHUNK_BYTES * 2 + 1)
    await saveFile('my-edgesounds.zip', new Blob([bytes]))

    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1)
    expect(Filesystem.appendFile).toHaveBeenCalledTimes(2)
    for (const [options] of vi.mocked(Filesystem.appendFile).mock.calls) {
      expect(options).toEqual(
        expect.objectContaining({ path: 'exports/my-edgesounds.zip', directory: 'CACHE' }),
      )
    }
    expectSameBytes(bytesOnDisk(), bytes)
  })

  it('does not append when the file is exactly one chunk', async () => {
    const bytes = pattern(CHUNK_BYTES)
    await saveFile('exact.zip', new Blob([bytes]))
    expect(Filesystem.appendFile).not.toHaveBeenCalled()
    expectSameBytes(bytesOnDisk(), bytes)
  })

  it('clears the previous export before writing', async () => {
    await saveFile('armed.wav', new Blob([pattern(10)]))
    expect(Filesystem.rmdir).toHaveBeenCalledWith({
      path: 'exports',
      directory: 'CACHE',
      recursive: true,
    })
    const cleared = vi.mocked(Filesystem.rmdir).mock.invocationCallOrder[0]
    const written = vi.mocked(Filesystem.writeFile).mock.invocationCallOrder[0]
    expect(cleared).toBeLessThan(written)
  })

  it('carries on when there is no previous export to clear', async () => {
    vi.mocked(Filesystem.rmdir).mockRejectedValue(new Error('Folder does not exist'))
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).resolves.toBe('saved')
  })

  it('fetches a URL source and saves what came back', async () => {
    const bytes = pattern(300)
    const fetchMock = vi.fn(async () => new Response(bytes))
    vi.stubGlobal('fetch', fetchMock)

    await saveFile('armyjay_full.mcm', '/osd/fonts/armyjay_full.mcm')

    expect(fetchMock).toHaveBeenCalledWith('/osd/fonts/armyjay_full.mcm')
    expectSameBytes(bytesOnDisk(), bytes)
  })

  it("accepts the status-0 response Capacitor's asset handler gives bundled audio", async () => {
    // The capacitor:// scheme handler serves audio and video through its
    // range-request path, which reaches fetch() as status 0 with ok=false and
    // the full body. A missing file throws instead, so status 0 is not a 404.
    const bytes = pattern(300)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 0, arrayBuffer: async () => bytes.buffer })),
    )

    await expect(saveFile('armed.wav', '/sounds/callouts/armed.wav')).resolves.toBe('saved')
    expectSameBytes(bytesOnDisk(), bytes)
  })

  it('names the file when a URL source cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })))
    await expect(saveFile('armed.wav', '/sounds/callouts/armed.wav')).rejects.toThrow(
      'Could not load armed.wav',
    )

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Load failed'))))
    await expect(saveFile('armed.wav', '/sounds/callouts/armed.wav')).rejects.toThrow(
      'Could not load armed.wav',
    )
    expect(Filesystem.writeFile).not.toHaveBeenCalled()
  })

  it('reports a dismissed share sheet as cancelled, not as an error', async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'))
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).resolves.toBe('cancelled')
  })

  it('retries when the previous sheet is still animating away', async () => {
    // UIKit can report the first sheet complete while its dismissal is still
    // running; the Share plugin then rejects the next call with this message.
    vi.mocked(Share.share)
      .mockRejectedValueOnce(new Error("Can't share while sharing is in progress"))
      .mockRejectedValueOnce(new Error("Can't share while sharing is in progress"))
      .mockResolvedValueOnce({})
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).resolves.toBe('saved')
    expect(Share.share).toHaveBeenCalledTimes(3)
    // One write; the retries only re-present the sheet.
    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1)
  })

  it('gives up on a sheet that never frees up', async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error("Can't share while sharing is in progress"))
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).rejects.toThrow(
      'sharing is in progress',
    )
    expect(Share.share).toHaveBeenCalledTimes(4)
  })

  it('rejects when sharing fails for any other reason', async () => {
    vi.mocked(Share.share).mockRejectedValue(new Error('Error sharing item'))
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).rejects.toThrow(
      'Error sharing item',
    )
  })

  it('rejects when the write fails', async () => {
    vi.mocked(Filesystem.writeFile).mockRejectedValue(new Error('No space left on device'))
    await expect(saveFile('armed.wav', new Blob([pattern(10)]))).rejects.toThrow(
      'No space left on device',
    )
    expect(Share.share).not.toHaveBeenCalled()
  })

  it('refuses an empty file rather than sharing zero bytes', async () => {
    await expect(saveFile('armed.wav', new Blob([]))).rejects.toThrow('armed.wav is empty')
    expect(Filesystem.writeFile).not.toHaveBeenCalled()
  })

  it.each(['../escape.wav', 'a/b.wav', 'a\\b.wav', '.hidden', ''])(
    'refuses the filename %j',
    async (name) => {
      await expect(saveFile(name, new Blob([pattern(10)]))).rejects.toThrow('Cannot save a file named')
      expect(Filesystem.rmdir).not.toHaveBeenCalled()
      expect(Filesystem.writeFile).not.toHaveBeenCalled()
    },
  )

  it('runs overlapping saves one after the other', async () => {
    let dismissFirstSheet!: () => void
    vi.mocked(Share.share).mockImplementationOnce(
      () => new Promise((resolve) => (dismissFirstSheet = () => resolve({}))),
    )

    const first = saveFile('first.wav', new Blob([pattern(10)]))
    const second = saveFile('second.wav', new Blob([pattern(10)]))

    await vi.waitFor(() => expect(Share.share).toHaveBeenCalledTimes(1))
    // The second save must not have cleared or written anything yet.
    expect(Filesystem.rmdir).toHaveBeenCalledTimes(1)
    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1)

    dismissFirstSheet()
    await expect(first).resolves.toBe('saved')
    await expect(second).resolves.toBe('saved')
    expect(vi.mocked(Filesystem.writeFile).mock.calls.map(([o]) => o.path)).toEqual([
      'exports/first.wav',
      'exports/second.wav',
    ])
  })

  it('still runs the next save after one has failed', async () => {
    vi.mocked(Share.share).mockRejectedValueOnce(new Error('Error sharing item'))
    await expect(saveFile('first.wav', new Blob([pattern(10)]))).rejects.toThrow()
    await expect(saveFile('second.wav', new Blob([pattern(10)]))).resolves.toBe('saved')
  })
})

describe('saveFile in a browser', () => {
  let anchor: { href: string; download: string; click: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.mocked(isNativeApp).mockReturnValue(false)
    anchor = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) })
  })

  it('clicks a download link to a URL source, untouched', async () => {
    await expect(saveFile('armed.wav', '/sounds/callouts/armed.wav')).resolves.toBe('saved')
    expect(anchor.href).toBe('/sounds/callouts/armed.wav')
    expect(anchor.download).toBe('armed.wav')
    expect(anchor.click).toHaveBeenCalledTimes(1)
  })

  it('clicks a download link to an object URL for a Blob, then revokes it', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    await saveFile('my-edgesounds.zip', new Blob([pattern(10)]))
    expect(anchor.href).toMatch(/^blob:/)
    expect(anchor.download).toBe('my-edgesounds.zip')
    expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith(anchor.href)
    revoke.mockRestore()
  })

  it('never touches the native plugins', async () => {
    await saveFile('armed.wav', new Blob([pattern(10)]))
    expect(Filesystem.writeFile).not.toHaveBeenCalled()
    expect(Share.share).not.toHaveBeenCalled()
  })
})
