import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isNativeApp } from '../../platform/platform'
import { DropZone } from '../DropZone'
import { Footer } from '../Footer'

vi.mock('../../platform/platform', () => ({ isNativeApp: vi.fn() }))

beforeEach(() => vi.mocked(isNativeApp).mockReset())

describe('Footer', () => {
  it('links to Buy Me a Coffee and the source in a browser', () => {
    vi.mocked(isNativeApp).mockReturnValue(false)
    const html = renderToStaticMarkup(<Footer />)
    expect(html).toContain('buymeacoffee.com')
    expect(html).toContain('github.com/chalkyjason/edgesounds')
  })

  it('drops the donation link in the app but keeps the source link', () => {
    vi.mocked(isNativeApp).mockReturnValue(true)
    const html = renderToStaticMarkup(<Footer />)
    expect(html).not.toContain('buymeacoffee.com')
    expect(html).not.toContain('Buy me a coffee')
    expect(html).toContain('github.com/chalkyjason/edgesounds')
  })
})

describe('DropZone', () => {
  const render = () => renderToStaticMarkup(<DropZone onFile={() => {}} />)

  it('talks about dropping and clicking in a browser', () => {
    vi.mocked(isNativeApp).mockReturnValue(false)
    expect(render()).toContain('Drop an audio file or click to browse')
  })

  it('talks about choosing a file in the app', () => {
    vi.mocked(isNativeApp).mockReturnValue(true)
    const html = render()
    expect(html).toContain('Choose an audio file')
    expect(html).not.toContain('Drop an audio file')
  })
})
