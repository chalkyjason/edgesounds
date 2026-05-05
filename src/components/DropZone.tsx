import { Upload } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { ACCEPTED_EXTENSIONS, isAcceptedAudioFile } from '../utils/validateAudio'

export function DropZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void
  disabled?: boolean
}) {
  const [isOver, setIsOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      if (!isAcceptedAudioFile(file)) {
        setError(`Unsupported format. Use ${ACCEPTED_EXTENSIONS.join(', ')}.`)
        return
      }
      setError(null)
      onFile(file)
    },
    [onFile]
  )

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsOver(true)
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsOver(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={[
          'flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          isOver
            ? 'border-accent bg-accent/5 text-accent'
            : 'border-zinc-700 bg-zinc-900/40 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
          disabled && 'pointer-events-none opacity-50',
        ].filter(Boolean).join(' ')}
      >
        <Upload className="h-8 w-8" />
        <div>
          <div className="text-sm font-medium">Drop an audio file or click to browse</div>
          <div className="mt-1 text-xs text-zinc-500">
            {ACCEPTED_EXTENSIONS.join(' · ')}
          </div>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',')}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}
