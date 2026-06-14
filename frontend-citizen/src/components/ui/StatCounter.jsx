import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

/**
 * Counts up to `value` once scrolled into view. `suffix` for things like "+".
 */
export function StatCounter({ value = 0, duration = 1400, suffix = '', className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return undefined
    let raf
    let start
    const from = 0
    const to = Number(value) || 0
    function tick(now) {
      if (start === undefined) start = now
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString('fa-IR')}
      {suffix}
    </span>
  )
}
