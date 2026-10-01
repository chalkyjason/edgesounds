import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FilenameInput } from '../FilenameInput'
import { LogoUpload } from '../osd/LogoUpload'
import { Toaster } from '../Toaster'
import { TrimSlider } from '../TrimSlider'
import { useToast } from '../../hooks/useToast'

vi.mock('../../hooks/useToast', () => ({ useToast: vi.fn() }))

/** Every <label for=x> must point at an element with id=x. */
function expectLabelsBound(html: string, count: number) {
  const fors = [...html.matchAll(/<label for="([^"]+)"/g)].map((m) => m[1])
  expect(fors).toHaveLength(count)
  for (const id of fors) expect(html).toContain(`id="${id}"`)
}

describe('accessibility', () => {
  it('opens the boot splash picker from a focusable button', () => {
    const html = renderToStaticMarkup(<LogoUpload onApply={() => {}} />)
    expect(html).toMatch(/<button type="button"[^>]*>.*Choose an image<\/button>/)
    expect(html).not.toMatch(/<label[^>]*>.*Choose an image/)
  })

  it('announces toasts through a live region', () => {
    vi.mocked(useToast).mockReturnValue({
      toasts: [{ id: 1, kind: 'success', message: 'Conversion complete' }],
      notify: vi.fn(),
      dismiss: vi.fn(),
    } as unknown as ReturnType<typeof useToast>)
    const html = renderToStaticMarkup(<Toaster />)
    expect(html).toMatch(/role="status" aria-live="polite"/)
    expect(html).toContain('Conversion complete')
  })

  it('binds the filename label to its input', () => {
    expectLabelsBound(renderToStaticMarkup(<FilenameInput value="armed" onChange={() => {}} />), 1)
  })

  it('labels both trim sliders and reads their positions as times', () => {
    const html = renderToStaticMarkup(
      <TrimSlider duration={5} start={0.5} end={2} onChangeStart={() => {}} onChangeEnd={() => {}} />,
    )
    expectLabelsBound(html, 2)
    expect(html.match(/aria-valuetext="/g)).toHaveLength(2)
  })
})
