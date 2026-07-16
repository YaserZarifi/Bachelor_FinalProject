import { useEffect, useRef, useState } from 'react'
import { wsBaseUrl, getAccessToken } from '../api/client.js'

/**
 * Live report status over WebSocket, with exponential-backoff reconnect so a
 * transient drop doesn't silently stop updates. Authenticates with the JWT if
 * present, otherwise the guest token.
 */
export function useReportSocket(reportId, guestToken, onEvent) {
  const [live, setLive] = useState(false)
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  })

  useEffect(() => {
    if (!reportId) return undefined
    let ws
    let closed = false
    let attempt = 0
    let timer

    function connect() {
      const qs = new URLSearchParams()
      const access = getAccessToken()
      if (access) qs.set('access', access)
      else if (guestToken) qs.set('guest_token', guestToken)
      try {
        ws = new WebSocket(`${wsBaseUrl()}/ws/reports/${reportId}/?${qs.toString()}`)
      } catch {
        return
      }
      ws.onopen = () => {
        attempt = 0
        setLive(true)
      }
      ws.onmessage = (ev) => {
        try {
          onEventRef.current?.(JSON.parse(ev.data))
        } catch {
          /* ignore malformed frame */
        }
      }
      ws.onclose = () => {
        setLive(false)
        if (closed) return
        attempt += 1
        const delay = Math.min(1000 * 2 ** attempt, 15000)
        timer = setTimeout(connect, delay)
      }
      ws.onerror = () => ws && ws.close()
    }

    connect()
    return () => {
      closed = true
      clearTimeout(timer)
      ws?.close()
    }
  }, [reportId, guestToken])

  return live
}
