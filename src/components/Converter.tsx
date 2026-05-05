import { Download, RefreshCw, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAudioConversion } from '../hooks/useAudioConversion'
import { useToast } from '../hooks/useToast'
import { TRIGGER_PRESETS } from '../utils/triggerPresets'
import {
  formatBytes,
  formatDuration,
  readAudioMetadata,
} from '../utils/validateAudio'
import { sanitizeFilename } from '../utils/sanitizeFilename'
import { DropZone } from './DropZone'
import { FilenameInput } from './FilenameInput'
import { ConversionProgress } from './ConversionProgress'
import { TrimSlider } from './TrimSlider'

export function Converter() {
  const { convert, status, reset } = useAudioConversion()
  const { notify } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [duration, setDuration] = useState<number>(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [filename, setFilename] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFile = async (f: File) => {
    setFile(f)
    reset()
    try {
      const { duration: d } = await readAudioMetadata(f)
      const safeDuration = Number.isFinite(d) ? d : 0
      setDuration(safeDuration)
      setStart(0)
      setEnd(Math.min(safeDuration, 3))
    } catch {
      setDuration(0)
      setStart(0)
      setEnd(0)
    }
    if (!filename) {
      const baseName = f.name.replace(/\.[^/.]+$/, '')
      setFilename(sanitizeFilename(baseName))
    }
  }

  const handleConvert = async () => {
    if (!file) return
    if (!filename) {
      notify('Set an EdgeTX filename first.', 'error')
      return
    }
    try {
      await convert(file, {
        filename,
        trimStartSeconds: start > 0 ? start : undefined,
        trimEndSeconds: end > start ? end : undefined,
      })
      notify('Conversion complete', 'success')
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Conversion failed'
      notify(message, 'error')
    }
  }

  const downloadUrl = useMemo(() => {
    if (status.state !== 'done') return null
    return URL.createObjectURL(status.result.blob)
  }, [status])

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl)
    }
  }, [downloadUrl])

  const handleReset = () => {
    setFile(null)
    setDuration(0)
    setStart(0)
    setEnd(0)
    reset()
  }

  return (
    <div className="space-y-6">
      {!file && <DropZone onFile={handleFile} />}

      {file && (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-100">{file.name}</div>
                <div className="mt-1 font-mono text-xs text-zinc-500">
                  {formatBytes(file.size)} · {formatDuration(duration)}
                </div>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Convert another
              </button>
            </div>
            {previewUrl && (
              <audio
                src={previewUrl}
                controls
                className="mt-3 w-full accent-accent"
                preload="metadata"
              />
            )}
          </div>

          {duration > 0 && (
            <TrimSlider
              duration={duration}
              start={start}
              end={end}
              onChangeStart={setStart}
              onChangeEnd={setEnd}
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <FilenameInput value={filename} onChange={setFilename} />
            <div>
              <label className="mb-1 block text-sm text-zinc-300">Trigger preset</label>
              <select
                value={TRIGGER_PRESETS.find((p) => p.filename === filename)?.id ?? ''}
                onChange={(e) => {
                  const preset = TRIGGER_PRESETS.find((p) => p.id === e.target.value)
                  if (preset) setFilename(preset.filename)
                }}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-accent"
              >
                <option value="">— Custom —</option>
                {TRIGGER_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.filename})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                Auto-fills the EdgeTX-expected filename for that trigger.
              </p>
            </div>
          </div>

          <ConversionProgress status={status} />

          {status.state !== 'done' ? (
            <button
              onClick={handleConvert}
              disabled={
                !filename ||
                status.state === 'loading-engine' ||
                status.state === 'converting'
              }
              className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2.5 font-medium text-zinc-950 transition-colors hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Wand2 className="h-4 w-4" />
              Convert to EdgeTX .wav
            </button>
          ) : (
            <DownloadResult
              status={status}
              downloadUrl={downloadUrl}
              onAnother={handleReset}
            />
          )}
        </div>
      )}
    </div>
  )
}

function DownloadResult({
  status,
  downloadUrl,
  onAnother,
}: {
  status: { state: 'done'; result: import('../types').ConversionResult }
  downloadUrl: string | null
  onAnother: () => void
}) {
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-accent">Ready to download</div>
          <div className="mt-1 font-mono text-xs text-zinc-400">
            {status.result.filename} · {formatBytes(status.result.sizeBytes)} ·{' '}
            {status.result.sampleRate / 1000} kHz · mono · {status.result.bitDepth}-bit PCM
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAnother}
            className="flex items-center gap-1 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            <RefreshCw className="h-4 w-4" /> Another
          </button>
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={status.result.filename}
              className="flex items-center gap-1 rounded-md bg-accent px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-accent-dim"
            >
              <Download className="h-4 w-4" /> Download .wav
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
