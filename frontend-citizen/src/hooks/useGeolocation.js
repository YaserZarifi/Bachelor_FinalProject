import { useCallback, useState } from 'react'

/**
 * On-demand high-accuracy device geolocation.
 *
 * Unlike picking a point on a map, this reads the real device GPS, which is the
 * basis of the platform's anti-fraud guarantee: the reported location is the
 * device's actual position at capture time, not a value the user can freely set.
 */
export function useGeolocation() {
  const [coords, setCoords] = useState(null) // { lat, lng, accuracy, at }
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const request = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        const msg = 'دستگاه شما از موقعیت‌یابی پشتیبانی نمی‌کند.'
        setError(msg)
        reject(new Error(msg))
        return
      }
      setLoading(true)
      setError('')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const value = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            at: new Date(pos.timestamp).toISOString(),
          }
          setCoords(value)
          setLoading(false)
          resolve(value)
        },
        (err) => {
          const msg =
            err.code === err.PERMISSION_DENIED
              ? 'دسترسی به موقعیت مکانی رد شد. برای ثبت گزارش معتبر، اجازهٔ دسترسی لازم است.'
              : 'دریافت موقعیت مکانی ناموفق بود. لطفاً دوباره تلاش کنید.'
          setError(msg)
          setLoading(false)
          reject(new Error(msg))
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      )
    })
  }, [])

  return { coords, error, loading, request }
}
