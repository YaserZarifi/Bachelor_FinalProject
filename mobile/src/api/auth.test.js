import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import * as SecureStore from 'expo-secure-store'
import { api, getAccessToken, getRefreshToken } from './client.js'
import { fetchMe, login, register } from './auth.js'
import { registerPushToken, unregisterPushToken } from './push.js'

/**
 * The phone's auth and push-registration calls. Requests run through a stub
 * adapter, so these verify the *contract with the backend* — endpoints, bodies
 * and what gets persisted — without any network.
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

beforeEach(() => {
  SecureStore.__reset()
  responses = []
  stubAdapter()
})

describe('login', () => {
  it('posts the credentials to the token endpoint', async () => {
    const post = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { access: 'a', refresh: 'r' } })

    await login('ali', 'secret-pass')
    expect(post.mock.calls[0][0]).toBe('http://localhost:8080/api/auth/token/')
    expect(post.mock.calls[0][1]).toEqual({ username: 'ali', password: 'secret-pass' })
  })

  it('persists both tokens in SecureStore', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'a', refresh: 'r' } })

    await login('ali', 'secret-pass')
    expect(await getAccessToken()).toBe('a')
    expect(await getRefreshToken()).toBe('r')
  })

  it('returns the token pair to the caller', async () => {
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'a', refresh: 'r' } })
    expect(await login('ali', 'secret-pass')).toEqual({ access: 'a', refresh: 'r' })
  })

  it('propagates a rejected sign-in and stores nothing', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('401'))
    await expect(login('ali', 'wrong')).rejects.toThrow()
    expect(await getAccessToken()).toBeNull()
  })
})

describe('register', () => {
  it('creates the account then signs straight in', async () => {
    const post = vi
      .spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { access: 'a', refresh: 'r' } })

    await register('ali', 'ali@example.com', 'secret-pass')
    expect(post.mock.calls[0][0]).toBe('http://localhost:8080/api/auth/register/')
    expect(post.mock.calls[1][0]).toBe('http://localhost:8080/api/auth/token/')
  })

  it('sends the username, email and password', async () => {
    const post = vi
      .spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { access: 'a', refresh: 'r' } })

    await register('ali', 'ali@example.com', 'secret-pass')
    expect(post.mock.calls[0][1]).toEqual({
      username: 'ali',
      email: 'ali@example.com',
      password: 'secret-pass',
    })
  })

  it('leaves the citizen signed in afterwards', async () => {
    vi.spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { access: 'a', refresh: 'r' } })

    await register('ali', 'ali@example.com', 'secret-pass')
    expect(await getAccessToken()).toBe('a')
  })

  it('does not attempt a sign-in when registration is rejected', async () => {
    const post = vi.spyOn(axios, 'post').mockRejectedValue(new Error('username taken'))
    await expect(register('taken', 'a@b.com', 'secret-pass')).rejects.toThrow()
    expect(post).toHaveBeenCalledTimes(1)
  })
})

describe('fetchMe — session probe', () => {
  it('verifies the session with an authenticated call', async () => {
    responses.push({ status: 200, data: { type: 'FeatureCollection', features: [] } })
    expect(await fetchMe()).toEqual({ type: 'FeatureCollection', features: [] })
  })

  it('propagates a rejected session', async () => {
    responses.push({ status: 401 })
    await expect(fetchMe()).rejects.toBeTruthy()
  })
})

describe('push token registration', () => {
  it('registers a signed-in device with just its token', async () => {
    const seen = []
    const inner = api.defaults.adapter
    api.defaults.adapter = async (config) => {
      seen.push(config)
      return inner(config)
    }
    responses.push({ status: 200, data: { registered: true, subscribed_report: null } })

    const result = await registerPushToken('ExponentPushToken[abc]', 'android')
    expect(seen[0].url).toBe('push/register/')
    expect(JSON.parse(seen[0].data)).toEqual({
      expo_token: 'ExponentPushToken[abc]',
      platform: 'android',
    })
    expect(result.registered).toBe(true)
  })

  it('binds an anonymous device to one report using its guest token', async () => {
    const seen = []
    const inner = api.defaults.adapter
    api.defaults.adapter = async (config) => {
      seen.push(config)
      return inner(config)
    }
    responses.push({ status: 200, data: { registered: true, subscribed_report: 7 } })

    await registerPushToken('ExponentPushToken[abc]', 'ios', {
      reportId: 7,
      guestToken: 'tok-7',
    })
    expect(JSON.parse(seen[0].data)).toMatchObject({ report_id: 7, guest_token: 'tok-7' })
  })

  it('omits the report binding when only one half is supplied', async () => {
    const seen = []
    const inner = api.defaults.adapter
    api.defaults.adapter = async (config) => {
      seen.push(config)
      return inner(config)
    }
    responses.push({ status: 200, data: { registered: true } })

    await registerPushToken('ExponentPushToken[abc]', 'ios', { reportId: 7 })
    expect(JSON.parse(seen[0].data).report_id).toBeUndefined()
  })

  it('unregisters a device by token', async () => {
    const seen = []
    const inner = api.defaults.adapter
    api.defaults.adapter = async (config) => {
      seen.push(config)
      return inner(config)
    }
    responses.push({ status: 200, data: { unregistered: true } })

    const result = await unregisterPushToken('ExponentPushToken[abc]')
    expect(seen[0].url).toBe('push/unregister/')
    expect(JSON.parse(seen[0].data)).toEqual({ expo_token: 'ExponentPushToken[abc]' })
    expect(result.unregistered).toBe(true)
  })
})
