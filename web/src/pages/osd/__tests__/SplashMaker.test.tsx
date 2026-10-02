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

  it('opens on the layers, with paint as the other tool', () => {
    expect(html).toContain('Start screen')
    for (const tab of ['Layers', 'Paint']) expect(html).toMatch(new RegExp(`role="tab"[^>]*>.*?${tab}</button>`))
    expect(html).toMatch(/aria-selected="true"[^>]*>.*?Layers</)
  })

  it('starts empty, offering shapes, text, an image and the starters', () => {
    expect(html).toContain('No layers yet')
    for (const label of ['Shape', 'Text', 'Image', 'Starters']) expect(html).toContain(label)
    expect(html).toContain('Tap a layer to select it')
  })

  it('shows the export panel with nothing to export yet', () => {
    expect(html).toContain('The start screen is empty')
    expect(html).toContain("Betaflight&#x27;s default font")
    expect(html).not.toContain('download=')
  })
})
