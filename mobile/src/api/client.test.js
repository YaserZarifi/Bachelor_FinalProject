import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as SecureStore from 'expo-secure-store'
import {
  API_BASE,
  API_ROOT,
  clearTokens,
  flattenFeature,
  flattenFeatures,
  getAccessToken,
  getRefreshToken,
  mediaUrl,
  pingServer,
  setTokens,
  wsBaseUrl,
} from './client.js'

beforeEach(() => {
  SecureStore.__reset()
})

describe('base URLs', () => {
  it('defaults to localhost when no LAN IP is configured', () => {
    expect(API_BASE).toBe('http://localhost:8080')
  })

  it('appends /api for the REST root', () => {
    expect(API_ROOT).toBe('http://localhost:8080/api')
  })

  it('derives a ws:// origin', () => {
    expect(wsBaseUrl()).toBe('ws://localhost:8080')
  })

  it('carries no trailing slash', () => {
    expect(API_BASE.endsWith('/')).toBe(false)
    expect(wsBaseUrl().endsWith('/')).toBe(false)
  })
})

describe('flattenFeature — mobile collapses the envelope', () => {
  const feature = {
    type: 'Feature',
    id: 42,
    geometry: { type: 'Point', coordinates: [51.389, 35.6892] },
    properties: { status: 'SUBMITTED', description: 'چاله' },
  }

  it('lifts the id out of the envelope', () => {
    expect(flattenFeature(feature).id).toBe(42)
  })

  it('reads longitude then latitude from the coordinate pair', () => {
    const flat = flattenFeature(feature)
    expect(flat.lng).toBe(51.389)
    expect(flat.lat).toBe(35.6892)
  })

  it('spreads the properties onto the result', () => {
    expect(flattenFeature(feature).status).toBe('SUBMITTED')
  })

  it('falls back to an id inside properties', () => {
    expect(flattenFeature({ type: 'Feature', properties: { id: 9 } }).id).toBe(9)
  })

  it('surfaces the guest token from either position', () => {
    expect(
      flattenFeature({
        type: 'Feature',
        id: 1,
        properties: { guest_access_token: 'tok-a' },
      }).guest_access_token,
    ).toBe('tok-a')
  })

  it('reports a null guest token when the report is not anonymous', () => {
    expect(flattenFeature({ type: 'Feature', id: 1, properties: {} }).guest_access_token).toBeNull()
  })

  it('returns a non-Feature unchanged', () => {
    const flat = { id: 1 }
    expect(flattenFeature(flat)).toBe(flat)
  })

  it('returns null/undefined unchanged', () => {
    expect(flattenFeature(null)).toBeNull()
    expect(flattenFeature(undefined)).toBeUndefined()
  })

  it('⚠️ cannot read the EWKT geometry the API actually returns', () => {
    // Same gap as the citizen web app: the backend emits
    // "SRID=4326;POINT (lng lat)" because `rest_framework_gis` is not in
    // INSTALLED_APPS, so lat/lng arrive undefined on this client too.
    const flat = flattenFeature({
      type: 'Feature',
      id: 1,
      geometry: 'SRID=4326;POINT (51.389 35.6892)',
      properties: {},
    })
    expect(flat.lat).toBeUndefined()
    expect(flat.lng).toBeUndefined()
  })
})

describe('flattenFeatures', () => {
  it('flattens every feature of a collection', () => {
    const list = flattenFeatures({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 1,
          geometry: { type: 'Point', coordinates: [51, 35] },
          properties: { status: 'SUBMITTED' },
        },
      ],
    })
    expect(list[0]).toMatchObject({ id: 1, lng: 51, lat: 35, status: 'SUBMITTED' })
  })

  it('flattens a lone Feature into a one-item list', () => {
    expect(flattenFeatures({ type: 'Feature', id: 3, properties: {} })).toHaveLength(1)
  })

  it('passes a plain array through', () => {
    expect(flattenFeatures([{ id: 1 }])).toEqual([{ id: 1 }])
  })

  it('returns an empty array for null and unknown shapes', () => {
    expect(flattenFeatures(null)).toEqual([])
    expect(flattenFeatures({ type: 'Nope' })).toEqual([])
  })

  it('⚠️ does not unwrap a DRF-paginated response, unlike the web clients', () => {
    // The web helpers read `payload.results` first; this one does not. Pinned
    // so the divergence is visible if pagination is ever switched on.
    expect(
      flattenFeatures({ results: { type: 'FeatureCollection', features: [{}] } }),
    ).toEqual([])
  })
})

describe('mediaUrl', () => {
  it('prefixes a relative path', () => {
    expect(mediaUrl('/media/a.jpg')).toBe('http://localhost:8080/media/a.jpg')
  })

  it('inserts a missing leading slash', () => {
    expect(mediaUrl('media/a.jpg')).toBe('http://localhost:8080/media/a.jpg')
  })

  it('leaves an absolute url alone', () => {
    expect(mediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
  })

  it('returns null for a missing path, so <Image> can be skipped', () => {
    expect(mediaUrl('')).toBeNull()
    expect(mediaUrl(null)).toBeNull()
  })
})

describe('token storage (SecureStore)', () => {
  it('starts with no tokens', async () => {
    expect(await getAccessToken()).toBeNull()
    expect(await getRefreshToken()).toBeNull()
  })

  it('stores an access/refresh pair', async () => {
    await setTokens('access-1', 'refresh-1')
    expect(await getAccessToken()).toBe('access-1')
    expect(await getRefreshToken()).toBe('refresh-1')
  })

  it('stores an access token on its own', async () => {
    await setTokens('access-only', null)
    expect(await getAccessToken()).toBe('access-only')
    expect(await getRefreshToken()).toBeNull()
  })

  it('clears both tokens on sign-out', async () => {
    await setTokens('access-1', 'refresh-1')
    await clearTokens()
    expect(await getAccessToken()).toBeNull()
    expect(await getRefreshToken()).toBeNull()
  })

  it('clearing twice is harmless', async () => {
    await clearTokens()
    await expect(clearTokens()).resolves.not.toThrow()
  })
})

describe('pingServer — true reachability, not just internet', () => {
  it('reports true on a 2xx health response', async () => {
    const axios = (await import('axios')).default
    vi.spyOn(axios, 'get').mockResolvedValue({ status: 200 })
    expect(await pingServer()).toBe(true)
  })

  it('hits the unauthenticated health endpoint', async () => {
    const axios = (await import('axios')).default
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ status: 200 })
    await pingServer()
    expect(get.mock.calls[0][0]).toBe('http://localhost:8080/api/health/')
  })

  it('honours the caller-supplied timeout', async () => {
    const axios = (await import('axios')).default
    const get = vi.spyOn(axios, 'get').mockResolvedValue({ status: 200 })
    await pingServer(1500)
    expect(get.mock.calls[0][1]).toMatchObject({ timeout: 1500 })
  })

  it('reports false when the server is unreachable', async () => {
    const axios = (await import('axios')).default
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('ECONNREFUSED'))
    expect(await pingServer()).toBe(false)
  })

  it('reports false on a non-2xx response', async () => {
    const axios = (await import('axios')).default
    vi.spyOn(axios, 'get').mockResolvedValue({ status: 502 })
    expect(await pingServer()).toBe(false)
  })
})
