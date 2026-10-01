/**
 * The pieces of an EdgeTX conversion that need no audio engine: picking the
 * trim window, folding to mono, and writing 16-bit PCM WAV. The iPhone app
 * uses these with Web Audio's decoder in place of ffmpeg.
 */

/**
 * The span of samples to keep, matching ffmpeg's `-ss start -to end`: no
 * start means the beginning, and an end at or before the start means the
 * end of the clip.
 */
export function trimWindow(
  totalSamples: number,
  sampleRate: number,
  startSeconds?: number,
  endSeconds?: number,
): { from: number; to: number } {
  const start = startSeconds && startSeconds > 0 ? startSeconds : 0
  const from = Math.min(totalSamples, Math.round(start * sampleRate))
  const to =
    typeof endSeconds === 'number' && endSeconds > start
      ? Math.min(totalSamples, Math.round(endSeconds * sampleRate))
      : totalSamples
  return { from, to: Math.max(from, to) }
}

/** Average the channels over [from, to), as ffmpeg's `-ac 1` does. */
export function downmix(channels: Float32Array[], from: number, to: number): Float32Array {
  const out = new Float32Array(to - from)
  if (channels.length === 0) return out
  for (const channel of channels) {
    for (let i = from; i < to; i += 1) out[i - from] += channel[i]
  }
  if (channels.length > 1) {
    for (let i = 0; i < out.length; i += 1) out[i] /= channels.length
  }
  return out
}

/** A mono, 16-bit PCM WAV file: the 44-byte RIFF header, then the samples. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true)
  }
  return new Uint8Array(buffer)
}
