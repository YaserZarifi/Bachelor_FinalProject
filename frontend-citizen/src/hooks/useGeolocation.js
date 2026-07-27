import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * On-demand *satellite/radio-grade* device geolocation.
 *
 * ⚠️ Why this is more than a `getCurrentPosition` call:
 *
 * `navigator.geolocation` is not "GPS". On a device with no GNSS chip (most
 * laptops/desktops) the browser asks a network location service to guess where
 * it is. That service prefers nearby Wi-Fi BSSIDs, but when it has none it
 * falls back to **IP geolocation** — and behind a VPN the IP belongs to the exit
 * node, so the browser confidently reports a city the user has never been to.
 * A VPN can never move a real GNSS/Wi-Fi fix; it can only poison the IP guess.
 *
 * So the defence is to *refuse IP-derived fixes* rather than to try to detect
 * the VPN. The tell is the accuracy radius the provider reports alongside the
 * coordinate:
 *
 *   GNSS               3 – 30 m
 *   Wi-Fi trilateration 20 – 150 m
 *   cell towers        500 – 3000 m
 *   IP / VPN exit node 5000 – 100000 m   ← always rejected
 *
 * We therefore `watchPosition` instead of taking the first answer: browsers
 * routinely emit a coarse cached/network fix first and refine to a real GNSS
 * fix a few seconds later. We keep the best fix seen, resolve as soon as it is
 * GNSS-grade, and reject outright if nothing better than {@link MAX_ACCURACY_M}
 * ever arrives.
 */

/** Resolve immediately at or below this radius — this is a real GNSS fix. */
export const GOOD_ACCURACY_M = 50
/** Hard ceiling. Anything coarser is a network/IP guess and is never accepted. */
export const MAX_ACCURACY_M = 200
/** How long to keep refining before settling for the best fix seen so far. */
const ACQUIRE_TIMEOUT_MS = 20000

export function useGeolocation() {
  const [coords, setCoords] = useState(null) // { lat, lng, accuracy, at }
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null) // best accuracy seen, in metres
  const watchRef = useRef(null)
  const timerRef = useRef(null)

  const cleanup = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Never leave a watch running behind an unmounted component.
  useEffect(() => cleanup, [cleanup])

  const request = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const msg = 'دستگاه شما از موقعیت‌یابی پشتیبانی نمی‌کند.'
        setError(msg)
        reject(new Error(msg))
        return
      }

      cleanup()
      setLoading(true)
      setError('')
      setProgress(null)

      let best = null
      let settled = false

      const finish = (fn, payload) => {
        if (settled) return
        settled = true
        cleanup()
        setLoading(false)
        fn(payload)
      }

      const fail = (msg) => {
        setError(msg)
        finish(reject, new Error(msg))
      }

      const accept = (fix) => {
        setCoords(fix)
        finish(resolve, fix)
      }

      watchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const acc = pos.coords.accuracy
          // Keep only the sharpest fix this session has produced.
          if (best && best.accuracy <= acc) return
          best = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: acc,
            at: new Date(pos.timestamp).toISOString(),
          }
          setProgress(acc)
          if (acc <= GOOD_ACCURACY_M) accept(best)
        },
        (err) => {
          // A watch error is only fatal while we have nothing usable yet; a
          // late failure after a good fix is harmless and the timeout handles it.
          if (best) return
          fail(
            err.code === err.PERMISSION_DENIED
              ? 'دسترسی به موقعیت مکانی رد شد. برای ثبت گزارش معتبر، اجازهٔ دسترسی لازم است.'
              : 'دریافت موقعیت مکانی ناموفق بود. لطفاً GPS دستگاه را روشن کنید و دوباره تلاش کنید.',
          )
        },
        { enableHighAccuracy: true, timeout: ACQUIRE_TIMEOUT_MS, maximumAge: 0 },
      )

      timerRef.current = setTimeout(() => {
        if (best && best.accuracy <= MAX_ACCURACY_M) {
          accept(best)
        } else if (best) {
          // A fix arrived, but it is kilometre-scale — the hallmark of an
          // IP-derived guess, which behind a VPN points at the exit node.
          fail(
            `موقعیت دریافت‌شده دقیق نیست (خطای ±${Math.round(best.accuracy).toLocaleString('fa-IR')} متر) ` +
              'و احتمالاً از روی آدرس اینترنتی (IP) تخمین زده شده است، نه GPS واقعی. ' +
              'اگر VPN روشن است آن را خاموش کنید، سرویس موقعیت‌مکانی دستگاه را فعال کنید، ' +
              'یا برای ثبت گزارش از تلفن همراه استفاده کنید.',
          )
        } else {
          fail('دریافت موقعیت طول کشید. لطفاً در فضای باز و با GPS روشن دوباره تلاش کنید.')
        }
      }, ACQUIRE_TIMEOUT_MS)
    })
  }, [cleanup])

  return { coords, error, loading, progress, request }
}
