import { describe, expect, it } from 'vitest'
import { downmix, encodeWav, trimWindow } from '../wav'

describe('trimWindow', () => {
  it('keeps everything with no trim', () => {
    expect(trimWindow(64000, 32000)).toEqual({ from: 0, to: 64000 })
  })

  it('cuts at the start and end seconds', () => {
    expect(trimWindow(96000, 32000, 0.5, 2)).toEqual({ from: 16000, to: 64000 })
  })

  it('runs to the end when the end is not after the start, as ffmpeg -to does', () => {
    expect(trimWindow(96000, 32000, 1, 1)).toEqual({ from: 32000, to: 96000 })
    expect(trimWindow(96000, 32000, 1, undefined)).toEqual({ from: 32000, to: 96000 })
  })

  it('never reaches past the clip', () => {
    expect(trimWindow(32000, 32000, 0, 5)).toEqual({ from: 0, to: 32000 })
    expect(trimWindow(32000, 32000, 4, 5)).toEqual({ from: 32000, to: 32000 })
  })
})

describe('downmix', () => {
  it('averages stereo to mono', () => {
    const left = Float32Array.from([1, 0.5, 0])
    const right = Float32Array.from([0, 0.5, -1])
    expect(Array.from(downmix([left, right], 0, 3))).toEqual([0.5, 0.5, -0.5])
  })

  it('passes mono through over the window', () => {
    expect(Array.from(downmix([Float32Array.from([0.1, 0.2, 0.3, 0.4])], 1, 3))).toEqual([
      Math.fround(0.2),
      Math.fround(0.3),
    ])
  })
})

describe('encodeWav', () => {
  const wav = encodeWav(Float32Array.from([0, 1, -1, 2, -2, 0.5]), 32000)
  const view = new DataView(wav.buffer)
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...wav.subarray(offset, offset + length))

  it('writes the header EdgeTX expects: PCM, mono, 32 kHz, 16-bit', () => {
    expect(ascii(0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(wav.length - 8)
    expect(ascii(8, 8)).toBe('WAVEfmt ')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(32000)
    expect(view.getUint32(28, true)).toBe(64000)
    expect(view.getUint16(32, true)).toBe(2)
    expect(view.getUint16(34, true)).toBe(16)
    expect(ascii(36, 4)).toBe('data')
    expect(view.getUint32(40, true)).toBe(12)
    expect(wav.length).toBe(44 + 12)
  })

  it('scales to full range and clips anything louder', () => {
    const samples = Array.from({ length: 6 }, (_, i) => view.getInt16(44 + i * 2, true))
    expect(samples).toEqual([0, 32767, -32768, 32767, -32768, 16384])
  })
})
