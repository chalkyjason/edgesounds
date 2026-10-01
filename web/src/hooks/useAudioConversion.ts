import { useCallback, useState } from 'react'
import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { useFFmpeg } from './useFFmpeg'
import { convertWithWebAudio } from '../lib/audio/webAudio'
import { isNativeApp } from '../platform/platform'
import type { ConversionOptions, ConversionResult, ConversionStatus } from '../types'
import { ensureWavExtension } from '../utils/sanitizeFilename'
import { track } from '../utils/analytics'

const SAMPLE_RATE = 32000
const CHANNELS = 1
const BIT_DEPTH = 16

export function useAudioConversion() {
  const { load, isLoaded, isLoading } = useFFmpeg()
  const [status, setStatus] = useState<ConversionStatus>({ state: 'idle' })

  const convert = useCallback(
    async (file: File, options: ConversionOptions): Promise<ConversionResult> => {
      track('convert_start')
      const outputName = ensureWavExtension(options.filename)

      const withFfmpeg = async (): Promise<Blob> => {
        if (!isLoaded) setStatus({ state: 'loading-engine' })
        const ffmpeg = await load()
        setStatus({ state: 'converting', progress: 0 })
        const onProgress = ({ progress }: { progress: number }) => {
          setStatus({ state: 'converting', progress: Math.max(0, Math.min(1, progress)) })
        }
        ffmpeg.on('progress', onProgress)
        try {
          const inputName = `input_${Date.now()}.${getExt(file.name) || 'bin'}`
          return await runConversion(ffmpeg, await fetchFile(file), inputName, outputName, options)
        } finally {
          ffmpeg.off('progress', onProgress)
        }
      }

      // The app ships without ffmpeg (GPL, and 31 MB): the platform decodes.
      const withWebAudio = (): Promise<Blob> => {
        setStatus({ state: 'converting', progress: 0 })
        return convertWithWebAudio(file, {
          sampleRate: SAMPLE_RATE,
          startSeconds: options.trimStartSeconds,
          endSeconds: options.trimEndSeconds,
        })
      }

      try {
        const blob = await (isNativeApp() ? withWebAudio() : withFfmpeg())

        const duration =
          (options.trimEndSeconds ?? 0) > (options.trimStartSeconds ?? 0)
            ? (options.trimEndSeconds! - (options.trimStartSeconds ?? 0))
            : 0

        const result: ConversionResult = {
          blob,
          filename: outputName,
          sizeBytes: blob.size,
          durationSeconds: duration,
          sampleRate: SAMPLE_RATE,
          channels: CHANNELS,
          bitDepth: BIT_DEPTH,
        }

        setStatus({ state: 'done', result })
        track('convert_complete', { sizeBytes: blob.size })

        return result
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Conversion failed'
        setStatus({ state: 'error', message })
        track('convert_error', { message })
        throw e
      }
    },
    [isLoaded, load]
  )

  const reset = useCallback(() => setStatus({ state: 'idle' }), [])

  return { convert, status, reset, isEngineLoading: isLoading }
}

type FFmpegFs = Pick<FFmpeg, 'writeFile' | 'exec' | 'readFile' | 'deleteFile'>

/**
 * Convert `input` to an EdgeTX .wav in ffmpeg's in-memory filesystem. Both
 * files are deleted afterwards whether or not it worked, so a failed run
 * doesn't leave its input behind to pile up across retries.
 */
export async function runConversion(
  ffmpeg: FFmpegFs,
  input: Uint8Array,
  inputName: string,
  outputName: string,
  options: Pick<ConversionOptions, 'trimStartSeconds' | 'trimEndSeconds'>,
): Promise<Blob> {
  const args: string[] = []
  if (typeof options.trimStartSeconds === 'number' && options.trimStartSeconds > 0) {
    args.push('-ss', options.trimStartSeconds.toFixed(3))
  }
  if (
    typeof options.trimEndSeconds === 'number' &&
    options.trimEndSeconds > (options.trimStartSeconds ?? 0)
  ) {
    args.push('-to', options.trimEndSeconds.toFixed(3))
  }
  args.push(
    '-i', inputName,
    '-ar', String(SAMPLE_RATE),
    '-ac', String(CHANNELS),
    '-sample_fmt', 's16',
    '-c:a', 'pcm_s16le',
    '-y',
    outputName
  )

  try {
    await ffmpeg.writeFile(inputName, input)
    // Run ffmpeg.wasm command (in-browser, sandboxed — not Node child_process)
    const runFfmpeg = ffmpeg.exec.bind(ffmpeg)
    const exitCode = await runFfmpeg(args)
    if (exitCode !== 0) {
      throw new Error("Couldn't convert that file — it may be damaged or not an audio file.")
    }
    const data = await ffmpeg.readFile(outputName)
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
    return new Blob([new Uint8Array(bytes)], { type: 'audio/wav' })
  } finally {
    for (const name of [inputName, outputName]) {
      await ffmpeg.deleteFile(name).catch(() => undefined)
    }
  }
}

function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i + 1).toLowerCase()
}
