import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../hooks/useToast'
import { useVariants } from '../../../hooks/useVariants'
import { FontEditor } from '../FontEditor'

vi.mock('../../../platform/platform', () => ({ isNativeApp: () => false }))
vi.mock('../../../hooks/useVariants', () => ({ useVariants: vi.fn() }))

const render = (variant: string) =>
  renderToStaticMarkup(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/osd/fonts/${variant}/edit`]}>
        <Routes>
          <Route path="/osd/fonts/:variant/edit" element={<FontEditor />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )

describe('FontEditor', () => {
  it('names an unknown font and links back to the list', () => {
    vi.mocked(useVariants).mockReturnValue({ state: 'loaded', variants: [] })
    const html = render('nope')
    expect(html).toContain('No such font: nope')
    expect(html).toContain('href="/osd"')
    expect(html).not.toContain('No font specified')
  })

  it("shows why the font list couldn't load", () => {
    vi.mocked(useVariants).mockReturnValue({ state: 'error', message: 'Failed to fetch variants: 500' })
    expect(render('armyjay_full')).toContain('Failed to fetch variants: 500')
  })
})
