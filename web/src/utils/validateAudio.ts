export const ACCEPTED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
]

export const ACCEPTED_EXTENSIONS = ['mp3', 'm4a', 'wav', 'ogg', 'flac']

export function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot + 1).toLowerCase()
}

export function isAcceptedAudioFile(file: File): boolean {
  if (file.type && ACCEPTED_MIME_TYPES.includes(file.type)) return true
  return ACCEPTED_EXTENSIONS.includes(getFileExtension(file.name))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(1)
  return `${m}:${s.padStart(4, '0')}`
}

export async function readAudioMetadata(
  file: File
): Promise<{ duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.src = url
    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration
      URL.revokeObjectURL(url)
      resolve({ duration })
    })
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read audio metadata'))
    })
  })
}
