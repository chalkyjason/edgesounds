import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prepareIos } from '../prepare-ios.mjs'

let root
let dist
let out

const write = (rel, content = 'x') => {
  const file = join(dist, rel)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
}

const entry = (id, path, license) => ({ id, path, ...(license ? { license } : {}) })

const writeLibrary = (categories) => write('library.json', JSON.stringify({ categories }))

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prepare-ios-'))
  dist = join(root, 'dist')
  out = join(root, 'dist-ios')
  write('index.html', '<!doctype html>')
  write('assets/app.js', 'console.log(1)')
  write('osd/fonts/armyjay_full.mcm', 'MAX7456')
  write('ffmpeg/ffmpeg-core.wasm', 'wasm')
  write('ffmpeg/ffmpeg-core.js', 'core')
  for (const name of ['_headers', '_redirects', 'sitemap.xml', 'robots.txt', 'og.png']) write(name)
  write('sounds/callouts/armed.wav', 'RIFF-armed')
  write('sounds/callouts/nolic.wav', 'RIFF-nolic')
  write('sounds/movies/quote.wav', 'RIFF-quote')
  write('sounds/.DS_Store', 'junk')
  writeLibrary([
    {
      id: 'callouts',
      sounds: [
        entry('armed', '/sounds/callouts/armed.wav', 'generated-original'),
        entry('nolic', '/sounds/callouts/nolic.wav'),
      ],
    },
    { id: 'movies', sounds: [entry('quote', '/sounds/movies/quote.wav', 'fair-use-personal')] },
  ])
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('prepareIos', () => {
  it('ships only the sounds the trimmed library lists', () => {
    expect(prepareIos(dist, out)).toEqual({ kept: 1, removed: 3 })
    expect(readdirSync(join(out, 'sounds'), { recursive: true }).sort()).toEqual([
      'callouts',
      join('callouts', 'armed.wav'),
    ])
    expect(readFileSync(join(out, 'sounds/callouts/armed.wav'), 'utf8')).toBe('RIFF-armed')
  })

  it('rewrites library.json to match', () => {
    prepareIos(dist, out)
    const library = JSON.parse(readFileSync(join(out, 'library.json'), 'utf8'))
    expect(library.categories.map((c) => c.id)).toEqual(['callouts'])
    expect(library.categories[0].sounds.map((s) => s.id)).toEqual(['armed'])
  })

  it('drops the files that only mean something to a web host', () => {
    prepareIos(dist, out)
    for (const name of ['_headers', '_redirects', 'sitemap.xml', 'robots.txt', 'og.png']) {
      expect(existsSync(join(out, name))).toBe(false)
    }
  })

  it('leaves ffmpeg out of the app', () => {
    prepareIos(dist, out)
    expect(existsSync(join(out, 'ffmpeg'))).toBe(false)
    expect(existsSync(join(dist, 'ffmpeg/ffmpeg-core.wasm'))).toBe(true)
  })

  it('keeps the rest of the site', () => {
    prepareIos(dist, out)
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toBe('<!doctype html>')
    expect(existsSync(join(out, 'assets/app.js'))).toBe(true)
    expect(existsSync(join(out, 'osd/fonts/armyjay_full.mcm'))).toBe(true)
  })

  it('leaves dist/ untouched', () => {
    prepareIos(dist, out)
    expect(existsSync(join(dist, 'sounds/movies/quote.wav'))).toBe(true)
    expect(existsSync(join(dist, '_headers'))).toBe(true)
    expect(JSON.parse(readFileSync(join(dist, 'library.json'), 'utf8')).categories).toHaveLength(2)
  })

  it('wipes a previous dist-ios/ rather than merging into it', () => {
    mkdirSync(join(out, 'sounds/movies'), { recursive: true })
    writeFileSync(join(out, 'sounds/movies/old-clip.wav'), 'stale')
    writeFileSync(join(out, 'stale.txt'), 'stale')
    prepareIos(dist, out)
    expect(existsSync(join(out, 'sounds/movies'))).toBe(false)
    expect(existsSync(join(out, 'stale.txt'))).toBe(false)
  })

  it('fails when a kept sound has no file', () => {
    rmSync(join(dist, 'sounds/callouts/armed.wav'))
    expect(() => prepareIos(dist, out)).toThrow('armed: /sounds/callouts/armed.wav is missing from the build')
  })

  it('fails when a sound path points outside sounds/', () => {
    writeLibrary([
      { id: 'callouts', sounds: [entry('sneaky', '/sounds/../index.html', 'generated-original')] },
    ])
    expect(() => prepareIos(dist, out)).toThrow('sneaky: path /sounds/../index.html is outside sounds/')
  })

  it('fails with a pointer to the fix when the site has not been built', () => {
    rmSync(join(dist, 'index.html'))
    expect(() => prepareIos(dist, out)).toThrow('run "npm run build" first')
  })
})
