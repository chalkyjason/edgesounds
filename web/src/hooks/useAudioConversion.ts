import { useCallback, useState } from 'react'
import { fetchFile } from '@ffmpeg/util'
import { useFFmpeg } from './useFFmpeg'
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

      if (!isLoaded) setStatus({ state: 'loading-engine' })
      const ffmpeg = await load()

      setStatus({ state: 'converting', progress: 0 })

      const onProgress = ({ progress }: { progress: number }) => {
        setStatus({ state: 'converting', progress: Math.max(0, Math.min(1, progress)) })
      }
      ffmpeg.on('progress', onProgress)

      const inputName = `input_${Date.now()}.${getExt(file.name) || 'bin'}`
      const outputName = ensureWavExtension(options.filename)

      try {
        await ffmpeg.writeFile(inputName, await fetchFile(file))

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

        // Run ffmpeg.wasm command (in-browser, sandboxed — not Node child_process)
        const runFfmpeg = ffmpeg.exec.bind(ffmpeg)
        await runFfmpeg(args)

        const data = await ffmpeg.readFile(outputName)
        const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data))
        const blob = new Blob([new Uint8Array(bytes)], { type: 'audio/wav' })

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

        try {
          await ffmpeg.deleteFile(inputName)
          await ffmpeg.deleteFile(outputName)
        } catch {
          /* ignore */
        }

        return result
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Conversion failed'
        setStatus({ state: 'error', message })
        track('convert_error', { message })
        throw e
      } finally {
        ffmpeg.off('progress', onProgress)
      }
    },
    [isLoaded, load]
  )

  const reset = useCallback(() => setStatus({ state: 'idle' }), [])

  return { convert, status, reset, isEngineLoading: isLoading }
}

function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i + 1).toLowerCase()
}
