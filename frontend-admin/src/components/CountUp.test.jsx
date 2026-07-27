import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import CountUp from './CountUp.jsx'

/**
 * The animated KPI counters on the dashboard. Two things must hold: the final
 * number is exact (a statistic that stops one short is worse than no
 * animation), and it is rendered in Persian digits like the rest of the UI.
 */

/** Drive requestAnimationFrame deterministically. */
function withFakeRaf(run) {
  let now = 0
  const callbacks = []
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    callbacks.push(cb)
    return callbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  const advance = (ms) => {
    now += ms
    const pending = callbacks.splice(0, callbacks.length)
    act(() => pending.forEach((cb) => cb(now)))
  }
  try {
    return run(advance)
  } finally {
    vi.unstubAllGlobals()
  }
}

describe('CountUp', () => {
  it('starts at zero', () => {
    withFakeRaf(() => {
      render(<CountUp value={100} />)
      expect(screen.getByText('۰')).toBeInTheDocument()
    })
  })

  it('reaches exactly the target value', () => {
    withFakeRaf((advance) => {
      render(<CountUp value={42} duration={1000} />)
      advance(0)
      advance(1000)
      expect(screen.getByText('۴۲')).toBeInTheDocument()
    })
  })

  it('renders the number in Persian digits', () => {
    withFakeRaf((advance) => {
      render(<CountUp value={7} duration={1000} />)
      advance(0)
      advance(1000)
      expect(screen.getByText('۷')).toBeInTheDocument()
    })
  })

  it('groups thousands the Persian way', () => {
    withFakeRaf((advance) => {
      render(<CountUp value={1234} duration={1000} />)
      advance(0)
      advance(1000)
      expect(screen.getByText('۱٬۲۳۴')).toBeInTheDocument()
    })
  })

  it('animates part-way at the mid-point rather than jumping', () => {
    withFakeRaf((advance) => {
      const { container } = render(<CountUp value={1000} duration={1000} />)
      advance(0)
      advance(500)
      const shown = Number(container.textContent.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, ''))
      expect(shown).toBeGreaterThan(0)
      expect(shown).toBeLessThan(1000)
    })
  })

  it('handles a zero value', () => {
    withFakeRaf((advance) => {
      render(<CountUp value={0} />)
      advance(0)
      advance(1000)
      expect(screen.getByText('۰')).toBeInTheDocument()
    })
  })

  it('treats a missing value as zero', () => {
    withFakeRaf((advance) => {
      render(<CountUp />)
      advance(0)
      advance(1000)
      expect(screen.getByText('۰')).toBeInTheDocument()
    })
  })

  it('treats a non-numeric value as zero rather than showing NaN', () => {
    withFakeRaf((advance) => {
      const { container } = render(<CountUp value="many" />)
      advance(0)
      advance(1000)
      expect(container.textContent).not.toContain('NaN')
    })
  })

  it('re-animates when the value changes after a refresh', () => {
    withFakeRaf((advance) => {
      const { rerender } = render(<CountUp value={10} duration={1000} />)
      advance(0)
      advance(1000)
      expect(screen.getByText('۱۰')).toBeInTheDocument()

      rerender(<CountUp value={20} duration={1000} />)
      advance(0)
      advance(1000)
      expect(screen.getByText('۲۰')).toBeInTheDocument()
    })
  })

  it('stops the animation frame loop on unmount', () => {
    withFakeRaf(() => {
      const cancel = vi.fn()
      vi.stubGlobal('cancelAnimationFrame', cancel)
      const { unmount } = render(<CountUp value={10} />)
      unmount()
      expect(cancel).toHaveBeenCalled()
    })
  })
})
