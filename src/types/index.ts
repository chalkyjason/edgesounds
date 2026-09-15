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

/**
 * `system` — EdgeTX plays these itself when the event fires. The filename is fixed
 *   by the firmware and the file belongs in /SOUNDS/<lang>/SYSTEM/.
 * `track` — an ordinary sound you bind yourself via a Play Track Special Function.
 *   The name is your choice (<= MAX_FILENAME_LENGTH) and it lives in /SOUNDS/<lang>/.
 */
export type TriggerKind = 'system' | 'track'

export interface TriggerPreset {
  id: string
  filename: string
  label: string
  description: string
  kind: TriggerKind
}
