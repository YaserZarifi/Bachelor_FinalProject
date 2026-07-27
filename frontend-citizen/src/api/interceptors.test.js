import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { api, loginTokens } from './client.js'

/**
 * The axios interceptors — the session plumbing every authenticated screen
 * depends on.
 *
 * A 12-hour access token *will* expire while a citizen has the app open. The
 * response interceptor must refresh it and replay the original request once,
 * exactly once, without bouncing the user to the login page.
 *
 * Requests are driven through a stub adapter so no network is involved; the
 * refresh call goes through `axios.post` directly and is spied on.
 */

/** Queue of responses/errors the stub adapter will produce, in order. */
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
    return {
      data: next.data ?? {},
      status: next.status,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
}

/** Record what the adapter actually saw, for header assertions. */
function recordingAdapter(seen) {
  const inner = api.defaults.adapter
  api.defaults.adapter = async (config) => {
    seen.push(config)
    return inner(config)
  }
}

beforeEach(() => {
  responses = []
  stubAdapter()
})

describe('request interceptor', () => {
  it('attaches the bearer token when signed in', async () => {
    const seen = []
    recordingAdapter(seen)
    loginTokens('access-1')
    responses.push({ status: 200 })

    await api.get('reports/')
    expect(seen[0].headers.Authorization).toBe('Bearer access-1')
  })

  it('sends no Authorization header when signed out', async () => {
    const seen = []
    recordingAdapter(seen)
    responses.push({ status: 200 })

    await api.get('reports/')
    expect(seen[0].headers.Authorization).toBeUndefined()
  })

  it('picks up a token stored after the client was created', async () => {
    const seen = []
    recordingAdapter(seen)
    responses.push({ status: 200 }, { status: 200 })

    await api.get('reports/')
    loginTokens('late-token')
    await api.get('reports/')
    expect(seen[1].headers.Authorization).toBe('Bearer late-token')
  })
})

describe('response interceptor — silent refresh on 401', () => {
  it('refreshes and replays the original request', async () => {
    loginTokens('expired', 'refresh-1')
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'fresh' } })
    responses.push({ status: 401 }, { status: 200, data: { ok: true } })

    const response = await api.get('reports/')
    expect(post).toHaveBeenCalledTimes(1)
    expect(response.data).toEqual({ ok: true })
  })

  it('calls the documented refresh endpoint with the stored refresh token', async () => {
    loginTokens('expired', 'refresh-1')
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'fresh' } })
    responses.push({ status: 401 }, { status: 200 })

    await api.get('reports/')
    expect(post.mock.calls[0][0]).toBe('http://localhost:8080/api/auth/token/refresh/')
    expect(post.mock.calls[0][1]).toEqual({ refresh: 'refresh-1' })
  })

  it('stores the new access token', async () => {
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'fresh' } })
    responses.push({ status: 401 }, { status: 200 })

    await api.get('reports/')
    expect(localStorage.getItem('access_token')).toBe('fresh')
  })

  it('stores a rotated refresh token when the server sends one', async () => {
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { access: 'fresh', refresh: 'refresh-2' },
    })
    responses.push({ status: 401 }, { status: 200 })

    await api.get('reports/')
    expect(localStorage.getItem('refresh_token')).toBe('refresh-2')
  })

  it('replays the request with the refreshed token', async () => {
    const seen = []
    recordingAdapter(seen)
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'fresh' } })
    responses.push({ status: 401 }, { status: 200 })

    await api.get('reports/')
    expect(seen[1].headers.Authorization).toBe('Bearer fresh')
  })

  it('retries only once, so an expired refresh cannot loop', async () => {
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'fresh' } })
    responses.push({ status: 401 }, { status: 401 })

    await expect(api.get('reports/')).rejects.toMatchObject({
      response: { status: 401 },
    })
  })

  it('does not attempt a refresh when there is no refresh token', async () => {
    loginTokens('expired')
    const post = vi.spyOn(axios, 'post')
    responses.push({ status: 401 })

    await expect(api.get('reports/')).rejects.toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('does not try to refresh a failing login request', async () => {
    // Otherwise a wrong password would trigger a pointless refresh round-trip.
    loginTokens('expired', 'refresh-1')
    const post = vi.spyOn(axios, 'post')
    responses.push({ status: 401 })

    await expect(api.post('auth/token/', {})).rejects.toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('signs the user out when the refresh itself fails', async () => {
    loginTokens('expired', 'refresh-1')
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh expired'))
    responses.push({ status: 401 })

    await expect(api.get('reports/')).rejects.toBeTruthy()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('passes a non-401 error straight through', async () => {
    loginTokens('access-1', 'refresh-1')
    const post = vi.spyOn(axios, 'post')
    responses.push({ status: 500 })

    await expect(api.get('reports/')).rejects.toMatchObject({
      response: { status: 500 },
    })
    expect(post).not.toHaveBeenCalled()
  })

  it('passes a 403 straight through — that is a permission problem, not a stale token', async () => {
    loginTokens('access-1', 'refresh-1')
    const post = vi.spyOn(axios, 'post')
    responses.push({ status: 403 })

    await expect(api.get('reports/')).rejects.toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('leaves a successful response untouched', async () => {
    responses.push({ status: 200, data: { type: 'FeatureCollection', features: [] } })
    const response = await api.get('reports/')
    expect(response.data.type).toBe('FeatureCollection')
  })
})
