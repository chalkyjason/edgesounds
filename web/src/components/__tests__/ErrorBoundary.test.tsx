import { describe, expect, it } from 'vitest'
import { ErrorBoundary } from '../ErrorBoundary'

const crashed = { error: new Error('boom'), resetKey: '/osd' }

describe('ErrorBoundary', () => {
  it('clears a caught error when the reset key changes', () => {
    expect(ErrorBoundary.getDerivedStateFromProps({ children: null, resetKey: '/sounds' }, crashed)).toEqual({
      error: null,
      resetKey: '/sounds',
    })
  })

  it('keeps showing the error while the reset key is unchanged', () => {
    expect(ErrorBoundary.getDerivedStateFromProps({ children: null, resetKey: '/osd' }, crashed)).toBeNull()
  })
})
