import { useEffect, useState } from 'react'
import { MAX_FILENAME_LENGTH, sanitizeFilename } from '../utils/sanitizeFilename'

export function FilenameInput({
  value,
  onChange,
  placeholder = 'armed',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    if (value.length === MAX_FILENAME_LENGTH) {
      setWarning(`Maxed out at ${MAX_FILENAME_LENGTH} chars — EdgeTX won't accept longer.`)
    } else {
      setWarning(null)
    }
  }, [value])

  const handleChange = (raw: string) => {
    const cleaned = sanitizeFilename(raw)
    if (cleaned !== raw) {
      setWarning('Stripped invalid chars (lowercase a–z, 0–9, _ only).')
    }
    onChange(cleaned)
  }

  return (
    <div>
      <label className="mb-1 block text-sm text-zinc-300">EdgeTX filename</label>
      <div className="flex items-center overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 focus-within:border-accent">
        <input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          maxLength={MAX_FILENAME_LENGTH}
          className="flex-1 bg-transparent px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
        <span className="border-l border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-500">
          .wav
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs">
        <span className={warning ? 'text-amber-400' : 'text-zinc-500'}>
          {warning ?? `Max ${MAX_FILENAME_LENGTH} chars · a-z, 0-9, _`}
        </span>
        <span className="font-mono text-zinc-500">
          {value.length}/{MAX_FILENAME_LENGTH}
        </span>
      </div>
    </div>
  )
}
