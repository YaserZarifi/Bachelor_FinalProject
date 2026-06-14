import { useEffect, useState } from 'react'

/** Animated count-up to `value`, re-running whenever the value changes. */
export default function CountUp({ value = 0, duration = 1000 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf
    let start
    const to = Number(value) || 0
    const from = 0
    function tick(now) {
      if (start === undefined) start = now
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(from + (to - from) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{n.toLocaleString('fa-IR')}</>
}
