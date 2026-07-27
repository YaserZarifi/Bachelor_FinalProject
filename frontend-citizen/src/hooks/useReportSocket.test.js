import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { loginTokens } from '../api/client.js'
import { useReportSocket } from './useReportSocket.js'

/**
 * Live report status over WebSocket, with exponential-backoff reconnect.
 *
 * The socket authenticates with the JWT when the citizen is signed in, and with
 * the one-report guest token otherwise — mirroring the backend consumer.
 */

let sockets

class FakeWebSocket {
  static OPEN = 1
  constructor(url) {
    this.url = url
    this.readyState = 0
    this.onopen = null
    this.onmessage = null
    this.onclose = null
    this.onerror = null
    sockets.push(this)
  }
  close() {
    this.readyState = 3
    this.onclose?.({})
  }
  open() {
    this.readyState = 1
    this.onopen?.({})
  }
  receive(data) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }
  receiveRaw(data) {
    this.onmessage?.({ data })
  }
}

beforeEach(() => {
  sockets = []
  vi.stubGlobal('WebSocket', FakeWebSocket)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('connecting', () => {
  it('does not open a socket without a report id', () => {
    renderHook(() => useReportSocket(null, 'tok', vi.fn()))
    expect(sockets).toHaveLength(0)
  })

  it('connects to the report channel', () => {
    renderHook(() => useReportSocket(12, 'tok', vi.fn()))
    expect(sockets[0].url).toContain('/ws/reports/12/')
  })

  it('uses the ws:// origin derived from the API base', () => {
    renderHook(() => useReportSocket(12, 'tok', vi.fn()))
    expect(sockets[0].url.startsWith('ws://localhost:8080')).toBe(true)
  })

  it('authenticates with the guest token when signed out', () => {
    renderHook(() => useReportSocket(12, 'guest-token-abc', vi.fn()))
    expect(sockets[0].url).toContain('guest_token=guest-token-abc')
    expect(sockets[0].url).not.toContain('access=')
  })

  it('prefers the JWT when the citizen is signed in', () => {
    loginTokens('jwt-access-token')
    renderHook(() => useReportSocket(12, 'guest-token-abc', vi.fn()))
    expect(sockets[0].url).toContain('access=jwt-access-token')
    expect(sockets[0].url).not.toContain('guest_token=')
  })

  it('reports "live" once the socket opens', async () => {
    const { result } = renderHook(() => useReportSocket(12, 'tok', vi.fn()))
    expect(result.current).toBe(false)
    act(() => sockets[0].open())
    await waitFor(() => expect(result.current).toBe(true))
  })
})

describe('receiving updates', () => {
  it('forwards a parsed status event to the callback', async () => {
    const onEvent = vi.fn()
    renderHook(() => useReportSocket(12, 'tok', onEvent))
    act(() => sockets[0].open())
    act(() => sockets[0].receive({ event: 'report.updated', status: 'RESOLVED' }))
    expect(onEvent).toHaveBeenCalledWith({ event: 'report.updated', status: 'RESOLVED' })
  })

  it('forwards the initial subscription confirmation', () => {
    const onEvent = vi.fn()
    renderHook(() => useReportSocket(12, 'tok', onEvent))
    act(() => sockets[0].receive({ event: 'subscribed', report_id: 12 }))
    expect(onEvent).toHaveBeenCalledWith({ event: 'subscribed', report_id: 12 })
  })

  it('ignores a malformed frame instead of crashing the page', () => {
    const onEvent = vi.fn()
    renderHook(() => useReportSocket(12, 'tok', onEvent))
    expect(() => act(() => sockets[0].receiveRaw('<<not json>>'))).not.toThrow()
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('always calls the latest callback, not a stale closure', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ cb }) => useReportSocket(12, 'tok', cb), {
      initialProps: { cb: first },
    })
    rerender({ cb: second })
    act(() => sockets[0].receive({ event: 'report.updated' }))
    expect(second).toHaveBeenCalled()
    expect(first).not.toHaveBeenCalled()
  })
})

describe('reconnecting', () => {
  it('marks the hook as not live when the socket drops', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useReportSocket(12, 'tok', vi.fn()))
    act(() => sockets[0].open())
    act(() => sockets[0].close())
    expect(result.current).toBe(false)
    vi.useRealTimers()
  })

  it('retries after a backoff delay', () => {
    vi.useFakeTimers()
    renderHook(() => useReportSocket(12, 'tok', vi.fn()))
    act(() => sockets[0].open())
    act(() => sockets[0].close())
    expect(sockets).toHaveLength(1)
    act(() => vi.advanceTimersByTime(2000))
    expect(sockets).toHaveLength(2)
    vi.useRealTimers()
  })

  it('backs off further on repeated failures', () => {
    vi.useFakeTimers()
    renderHook(() => useReportSocket(12, 'tok', vi.fn()))
    act(() => sockets[0].close())
    act(() => vi.advanceTimersByTime(2000))
    act(() => sockets[1].close())
    // Second attempt waits 4s, so 2s is not yet enough.
    act(() => vi.advanceTimersByTime(2000))
    expect(sockets).toHaveLength(2)
    act(() => vi.advanceTimersByTime(2000))
    expect(sockets).toHaveLength(3)
    vi.useRealTimers()
  })

  it('stops reconnecting once the component unmounts', () => {
    vi.useFakeTimers()
    const { unmount } = renderHook(() => useReportSocket(12, 'tok', vi.fn()))
    unmount()
    act(() => vi.advanceTimersByTime(60000))
    expect(sockets).toHaveLength(1)
    vi.useRealTimers()
  })

  it('opens a fresh socket when the report changes', () => {
    const { rerender } = renderHook(({ id }) => useReportSocket(id, 'tok', vi.fn()), {
      initialProps: { id: 12 },
    })
    rerender({ id: 13 })
    expect(sockets).toHaveLength(2)
    expect(sockets[1].url).toContain('/ws/reports/13/')
  })
})
