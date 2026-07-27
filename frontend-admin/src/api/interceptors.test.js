import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { api, loginTokens } from './client.js'

/**
 * The dashboard's session plumbing. A staff member typically leaves the
 * dashboard open all day, so the access token expires under them; the refresh
 * must be silent, single-flight, and must fall back to the login page only
 * when the refresh token itself is dead.
 */

let responses

function stubAdapter() {
  api.defaults.adapter = async (config) => {
    const next = responses.shift()
    if (!next) throw new Error('no stubbed response left')
    if (next.status >= 400) {
      const error = new Error(`Request failed with status ${next.status}`)
      error.config = config
      error.response = { status: next.status, data: next.data ?? {} }
      throw error
    }
    return { data: next.data ?? {}, status: next.status, statusText: 'OK', headers: {}, config }
  }
}

function recordingAdapter(seen) {
  const inner = api.defaults.adapter
  api.defaults.adapter = async (config) => {
    seen.push(config)
    return inner(config)
  }
}

/** Spy for the redirect the client performs on a dead session. */
let assign

beforeEach(() => {
  responses = []
  stubAdapter()
  // jsdom's `window.location` is non-configurable, so the whole object is
  // swapped rather than spying on `assign` in place.
  assign = vi.fn()
  vi.stubGlobal('location', {
    assign,
    pathname: '/dashboard',
    href: 'http://localhost:3002/dashboard',
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request interceptor', () => {
  it('attaches the bearer token when a staff session exists', async () => {
    const seen = []
    recordingAdapter(seen)
    loginTokens('staff-access')
    responses.push({ status: 200 })

    await api.get('reports/')
    expect(seen[0].headers.Authorization).toBe('Bearer staff-access')
  })

  it('sends no Authorization header before login', async () => {
    const seen = []
    recordingAdapter(seen)
    responses.push({ status: 200 })

    await api.get('reports/')
    expect(seen[0].headers.Authorization).toBeUndefined()
  })
})

describe('silent refresh on 401', () => {
  it('refreshes and replays the original request', async () => {
    loginTokens('expired', 'refresh-1')
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'fresh' } })
    responses.push({ status: 401 }, { status: 200, data: { ok: true } })

    const response = await api.get('reports/')
    expect(post).toHaveBeenCalledTimes(1)
    expect(response.data).toEqual({ ok: true })
  })

  it('stores the refreshed access token', async () => {
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'fresh' } })
    responses.push({ status: 401 }, { status: 200 })

    await api.get('reports/')
    expect(localStorage.getItem('access_token')).toBe('fresh')
  })

  it('replays with the refreshed token attached', async () => {
    const seen = []
    recordingAdapter(seen)
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'fresh' } })
    responses.push({ status: 401 }, { status: 200 })

    await api.get('reports/')
    expect(seen[1].headers.Authorization).toBe('Bearer fresh')
  })

  it('retries only once, so a dead session cannot loop', async () => {
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'fresh' } })
    responses.push({ status: 401 }, { status: 401 })

    await expect(api.get('reports/')).rejects.toMatchObject({ response: { status: 401 } })
  })

  it('does not refresh without a stored refresh token', async () => {
    loginTokens('expired')
    const post = vi.spyOn(axios, 'post')
    responses.push({ status: 401 })

    await expect(api.get('reports/')).rejects.toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('does not refresh a failed login attempt', async () => {
    loginTokens('expired', 'refresh-1')
    const post = vi.spyOn(axios, 'post')
    responses.push({ status: 401 })

    await expect(api.post('auth/token/', {})).rejects.toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('clears the session when the refresh token is dead', async () => {
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh expired'))
    responses.push({ status: 401 })

    await expect(api.get('reports/')).rejects.toBeTruthy()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('redirects a dead session to the login page', async () => {
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh expired'))
    responses.push({ status: 401 })

    await expect(api.get('reports/')).rejects.toBeTruthy()
    expect(assign).toHaveBeenCalledWith('/login')
  })

  it('passes a non-401 error straight through', async () => {
    loginTokens('staff-access', 'refresh-1')
    const post = vi.spyOn(axios, 'post')
    responses.push({ status: 500 })

    await expect(api.get('reports/')).rejects.toMatchObject({ response: { status: 500 } })
    expect(post).not.toHaveBeenCalled()
  })

  it('passes a 403 through — a non-staff account is not a stale token', async () => {
    loginTokens('staff-access', 'refresh-1')
    const post = vi.spyOn(axios, 'post')
    responses.push({ status: 403 })

    await expect(api.get('reports/')).rejects.toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('leaves a successful response untouched', async () => {
    responses.push({ status: 200, data: { type: 'FeatureCollection', features: [] } })
    expect((await api.get('reports/')).data.type).toBe('FeatureCollection')
  })
})
