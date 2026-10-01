import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../hooks/useToast'
import { SplashMaker } from '../SplashMaker'

vi.mock('../../../platform/platform', () => ({ isNativeApp: () => true }))

describe('SplashMaker in the app', () => {
  it("neither offers nor mentions Betaflight's default font", () => {
    // It is GPL-3.0, so the app doesn't ship it.
    const html = renderToStaticMarkup(
      <ToastProvider>
        <MemoryRouter initialEntries={['/osd/splash']}>
          <SplashMaker />
        </MemoryRouter>
      </ToastProvider>,
    )
    expect(html).toContain('one of the Army Jay variants.')
    expect(html).not.toMatch(/Betaflight&#x27;s default font|betaflight_default|GPL/)
  })
})
