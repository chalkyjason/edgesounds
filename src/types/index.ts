export interface SoundEntry {
  id: string
  filename: string
  displayName: string
  trigger?: string
  duration?: number
  tags: string[]
  path: string
  credit?: string
  license?: string
}

export interface Category {
  id: string
  name: string
  description: string
  sounds: SoundEntry[]
}

export interface Library {
  categories: Category[]
}

export interface ConversionResult {
  blob: Blob
  filename: string
  sizeBytes: number
  durationSeconds: number
  sampleRate: number
  channels: number
  bitDepth: number
}

export interface ConversionOptions {
  filename: string
  trimStartSeconds?: number
  trimEndSeconds?: number
}

export type ConversionStatus =
  | { state: 'idle' }
  | { state: 'loading-engine' }
  | { state: 'converting'; progress: number }
  | { state: 'done'; result: ConversionResult }
  | { state: 'error'; message: string }

export interface TriggerPreset {
  id: string
  filename: string
  label: string
  description: string
}
