import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../hooks/useToast'
import { SplashMaker } from '../SplashMaker'

vi.mock('../../../platform/platform', () => ({ isNativeApp: () => false }))

describe('SplashMaker', () => {
  // Server-rendered, so no effects run: this is the page before any fetch
  // lands -- the shape of it, not its behaviour.
  const html = renderToStaticMarkup(
    <ToastProvider>
      <MemoryRouter initialEntries={['/osd/splash']}>
        <SplashMaker />
      </MemoryRouter>
    </ToastProvider>,
  )

  it('offers the three tools and starts on text', () => {
    expect(html).toContain('Start screen')
    for (const tab of ['Text', 'Image', 'Paint']) expect(html).toMatch(new RegExp(`role="tab"[^>]*>${tab}<`))
    expect(html).toMatch(/aria-selected="true"[^>]*>Text</)
  })

  it('renders both inputs of the text template with the width readout', () => {
    expect(html).toContain('id="splash-big"')
    expect(html).toContain('id="splash-small"')
    expect(html).toContain('0 of 288 px')
  })

  it('shows the export panel with nothing to export yet', () => {
    expect(html).toContain('The start screen is empty')
    expect(html).toContain("Betaflight&#x27;s default font")
    expect(html).not.toContain('download=')
  })
})
