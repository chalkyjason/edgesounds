import { downmix, encodeWav, trimWindow } from './wav'

export interface WebAudioConversion {
  sampleRate: number
  startSeconds?: number
  endSeconds?: number
}

/**
 * Convert an audio file to a mono 16-bit WAV with the platform's own decoder.
 *
 * Decoding through an OfflineAudioContext at the target rate makes the
 * engine resample as it decodes, so there is no resampler of our own. This
 * is what the iPhone app uses instead of ffmpeg: it keeps a GPL binary out
 * of the App Store build and takes ~31 MB off it.
 */
export async function convertWithWebAudio(file: Blob, options: WebAudioConversion): Promise<Blob> {
  const context = new OfflineAudioContext(1, 1, options.sampleRate)
  let decoded: AudioBuffer
  try {
    decoded = await context.decodeAudioData(await file.arrayBuffer())
  } catch {
    throw new Error("Couldn't read that file. MP3, M4A, WAV and FLAC all work on iPhone.")
  }
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i))
  const { from, to } = trimWindow(decoded.length, decoded.sampleRate, options.startSeconds, options.endSeconds)
  if (to <= from) throw new Error('The trimmed clip is empty.')
  return new Blob([encodeWav(downmix(channels, from, to), decoded.sampleRate)], { type: 'audio/wav' })
}
