import { describe, expect, it, vi } from 'vitest'
import { runConversion } from '../useAudioConversion'

/** An in-memory stand-in for ffmpeg.wasm's filesystem and exec. */
function fakeFfmpeg(exitCode: number) {
  const files = new Map<string, Uint8Array>()
  return {
    files,
    writeFile: vi.fn(async (name: string, data: Uint8Array | string) => {
      files.set(name, data as Uint8Array)
      return true
    }),
    exec: vi.fn(async (args: string[]) => {
      if (exitCode === 0) files.set(args[args.length - 1], new Uint8Array([1, 2, 3]))
      return exitCode
    }),
    readFile: vi.fn(async (name: string) => {
      const data = files.get(name)
      if (!data) throw new Error('ErrnoError: FS error')
      return data
    }),
    deleteFile: vi.fn(async (name: string) => {
      if (!files.delete(name)) throw new Error('ErrnoError: FS error')
      return true
    }),
  }
}

describe('runConversion', () => {
  it('returns the converted wav and leaves nothing behind', async () => {
    const ffmpeg = fakeFfmpeg(0)
    const blob = await runConversion(ffmpeg, new Uint8Array([9]), 'in.mp3', 'armed.wav', {})
    expect(blob.type).toBe('audio/wav')
    expect(blob.size).toBe(3)
    expect(ffmpeg.files.size).toBe(0)
  })

  it('reports a failed run plainly instead of a filesystem error', async () => {
    const ffmpeg = fakeFfmpeg(1)
    await expect(
      runConversion(ffmpeg, new Uint8Array([9]), 'in.mp3', 'armed.wav', {}),
    ).rejects.toThrow("Couldn't convert that file")
    expect(ffmpeg.readFile).not.toHaveBeenCalled()
  })

  it('deletes the input even when the run fails', async () => {
    const ffmpeg = fakeFfmpeg(1)
    await runConversion(ffmpeg, new Uint8Array([9]), 'in.mp3', 'armed.wav', {}).catch(() => {})
    expect(ffmpeg.files.size).toBe(0)
  })

  it('passes the trim window to ffmpeg', async () => {
    const ffmpeg = fakeFfmpeg(0)
    await runConversion(ffmpeg, new Uint8Array([9]), 'in.mp3', 'armed.wav', {
      trimStartSeconds: 0.5,
      trimEndSeconds: 2,
    })
    const args = ffmpeg.exec.mock.calls[0][0]
    expect(args.slice(0, 4)).toEqual(['-ss', '0.500', '-to', '2.000'])
  })
})
