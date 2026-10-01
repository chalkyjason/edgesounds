import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isNativeApp } from '../../platform/platform'
import { Home } from '../Home'
import { Landing } from '../Landing'

vi.mock('../../platform/platform', () => ({ isNativeApp: vi.fn() }))
vi.mock('../../hooks/useLibrary', () => ({ useLibrary: () => ({ state: 'loading' }) }))

beforeEach(() => vi.mocked(isNativeApp).mockReset())

const render = (page: ReactElement) => renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>)

describe.each([
  ['Landing', <Landing />],
  ['Home', <Home />],
])('%s', (_name, page) => {
  // App Review reads "runs in your browser" as a wrapped website (guideline 4.2).
  it('never mentions a browser in the app', () => {
    vi.mocked(isNativeApp).mockReturnValue(true)
    const html = render(page)
    expect(html).not.toMatch(/browser|the tab\b/i)
    expect(html).toContain('on your phone')
  })

  it('keeps the browser wording on the site', () => {
    vi.mocked(isNativeApp).mockReturnValue(false)
    expect(render(page)).toContain('in your browser')
  })
})
