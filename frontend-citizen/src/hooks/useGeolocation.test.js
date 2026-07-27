import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { GOOD_ACCURACY_M, MAX_ACCURACY_M, useGeolocation } from './useGeolocation.js'

/**
 * The anti-VPN location gate.
 *
 * `navigator.geolocation` is not "GPS": with no GNSS chip and no Wi-Fi to
 * trilaterate against, the browser falls back to IP geolocation — which behind
 * a VPN reports the exit node's city. The defence is to reject *coarse* fixes
 * rather than try to detect the VPN, because a VPN can never move a real
 * GNSS/Wi-Fi fix — it can only poison the IP guess.
 */

let watchers

function position(accuracy, { lat = 35.6892, lng = 51.389 } = {}) {
  return {
    coords: { latitude: lat, longitude: lng, accuracy },
    timestamp: Date.UTC(2026, 6, 27, 10, 0, 0),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  watchers = []
  navigator.geolocation = {
    watchPosition: vi.fn((onSuccess, onError) => {
      watchers.push({ onSuccess, onError })
      return watchers.length
    }),
    clearWatch: vi.fn(),
  }
})

afterEach(() => {
  // Unmount first: the hook's cleanup calls `clearWatch`, so the stub has to
  // still be in place when React runs the unmount effect.
  cleanup()
  vi.useRealTimers()
  delete navigator.geolocation
})

/** Feed a position into the most recent watch. */
function emit(pos) {
  act(() => watchers.at(-1).onSuccess(pos))
}

function emitError(code = 1) {
  act(() => watchers.at(-1).onError({ code, PERMISSION_DENIED: 1 }))
}

describe('accuracy thresholds', () => {
  it('resolves immediately at GNSS grade', () => {
    expect(GOOD_ACCURACY_M).toBe(50)
  })

  it('never accepts anything coarser than the hard ceiling', () => {
    expect(MAX_ACCURACY_M).toBe(200)
  })

  it('matches the backend gate (MAX_REPORT_GPS_ACCURACY_M = 200)', () => {
    // Client and server must agree, or a capture the browser allows would be
    // rejected on submit.
    expect(MAX_ACCURACY_M).toBe(200)
  })
})

describe('acquiring a fix', () => {
  it('resolves as soon as a GNSS-grade fix arrives', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request()
    })
    emit(position(8))
    await expect(promise).resolves.toMatchObject({ accuracy: 8, lat: 35.6892, lng: 51.389 })
  })

  it('returns an ISO timestamp with the fix', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request()
    })
    emit(position(8))
    const fix = await promise
    expect(fix.at).toBe('2026-07-27T10:00:00.000Z')
  })

  it('exposes the accepted fix on the hook', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request()
    })
    emit(position(8))
    await promise
    expect(result.current.coords.accuracy).toBe(8)
  })

  it('keeps refining while fixes stay coarse, then settles at timeout', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request()
    })
    emit(position(900)) // an IP-scale first guess
    emit(position(120)) // Wi-Fi trilateration refines it
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    await expect(promise).resolves.toMatchObject({ accuracy: 120 })
  })

  it('keeps only the sharpest fix seen', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request()
    })
    emit(position(150))
    emit(position(120))
    emit(position(400)) // a later, worse fix must not overwrite the best
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    await expect(promise).resolves.toMatchObject({ accuracy: 120 })
  })

  it('reports refinement progress while acquiring', () => {
    const { result } = renderHook(() => useGeolocation())
    act(() => {
      result.current.request()
    })
    emit(position(900))
    expect(result.current.progress).toBe(900)
    emit(position(120))
    expect(result.current.progress).toBe(120)
  })
})

describe('rejecting IP-derived fixes', () => {
  it('rejects a kilometre-scale fix even though one arrived', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      // The catch is attached synchronously so the rejection is never
      // momentarily unhandled while the fake timers run.
      promise = result.current.request().catch((e) => e)
    })
    emit(position(45000)) // the hallmark of a VPN exit node
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    expect(await promise).toBeInstanceOf(Error)
  })

  it('explains VPNs in the Persian error message', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request().catch((e) => e)
    })
    emit(position(45000))
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    await promise
    expect(result.current.error).toContain('VPN')
  })

  it('accepts a fix exactly at the ceiling', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request()
    })
    emit(position(200))
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    await expect(promise).resolves.toMatchObject({ accuracy: 200 })
  })

  it('rejects a fix just past the ceiling', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request().catch((e) => e)
    })
    emit(position(201))
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    const outcome = await promise
    expect(outcome).toBeInstanceOf(Error)
  })
})

describe('failure paths', () => {
  it('rejects when the device has no geolocation at all', async () => {
    delete navigator.geolocation
    const { result } = renderHook(() => useGeolocation())
    let promise
    await act(async () => {
      promise = result.current.request().catch((e) => e)
    })
    expect(await promise).toBeInstanceOf(Error)
    expect(result.current.error).toContain('پشتیبانی نمی‌کند')
  })

  it('rejects with a permission message when access is denied', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request().catch((e) => e)
    })
    emitError(1)
    await promise
    expect(result.current.error).toContain('رد شد')
  })

  it('rejects when nothing at all arrives before the timeout', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request().catch((e) => e)
    })
    await act(async () => {
      vi.advanceTimersByTime(20000)
    })
    await promise
    expect(result.current.error).toContain('طول کشید')
  })

  it('ignores a late watch error once a usable fix exists', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request()
    })
    emit(position(10))
    emitError(2) // arrives after the fix was already accepted
    await expect(promise).resolves.toMatchObject({ accuracy: 10 })
  })
})

describe('resource cleanup', () => {
  it('clears the watch once a fix is accepted', async () => {
    const { result } = renderHook(() => useGeolocation())
    let promise
    act(() => {
      promise = result.current.request()
    })
    emit(position(8))
    await promise
    expect(navigator.geolocation.clearWatch).toHaveBeenCalled()
  })

  it('clears the watch when the component unmounts', () => {
    const { result, unmount } = renderHook(() => useGeolocation())
    act(() => {
      result.current.request()
    })
    unmount()
    expect(navigator.geolocation.clearWatch).toHaveBeenCalled()
  })

  it('does not resolve twice if fixes keep arriving', async () => {
    const { result } = renderHook(() => useGeolocation())
    const resolved = vi.fn()
    act(() => {
      result.current.request().then(resolved)
    })
    emit(position(8))
    await act(async () => {})
    emit(position(5))
    await act(async () => {})
    expect(resolved).toHaveBeenCalledTimes(1)
  })
})
