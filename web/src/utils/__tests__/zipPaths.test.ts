import { describe, expect, it } from 'vitest'
import { zipPaths } from '../zipPaths'

describe('zipPaths', () => {
  it('leaves distinct names at the top level', () => {
    expect(zipPaths(['armed.wav', 'dsarmd.wav'])).toEqual(['armed.wav', 'dsarmd.wav'])
  })

  it('keeps every copy of a repeated name, newest at the top level', () => {
    expect(zipPaths(['armed.wav', 'boom.wav', 'armed.wav', 'armed.wav'])).toEqual([
      'armed.wav',
      'boom.wav',
      'copy-2/armed.wav',
      'copy-3/armed.wav',
    ])
  })

  it('treats names differing only in case as the same file, as an SD card does', () => {
    expect(zipPaths(['armed.wav', 'ARMED.wav'])).toEqual(['armed.wav', 'copy-2/ARMED.wav'])
  })
})
