import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../hooks/useToast'
import { isNativeApp } from '../../platform/platform'
import { SaveLink } from '../SaveLink'

vi.mock('../../platform/platform', () => ({ isNativeApp: vi.fn() }))

const render = () =>
  renderToStaticMarkup(
    <ToastProvider>
      <SaveLink href="/sounds/callouts/armed.wav" filename="armed.wav" className="btn">
        WAV
      </SaveLink>
    </ToastProvider>,
  )

describe('SaveLink', () => {
  beforeEach(() => vi.mocked(isNativeApp).mockReset())

  it('is the plain download anchor in a browser', () => {
    vi.mocked(isNativeApp).mockReturnValue(false)
    expect(render()).toBe(
      '<a href="/sounds/callouts/armed.wav" download="armed.wav" class="btn">WAV</a>',
    )
  })

  it('is a button with no href in the app', () => {
    vi.mocked(isNativeApp).mockReturnValue(true)
    expect(render()).toBe('<button type="button" class="btn">WAV</button>')
  })
})
