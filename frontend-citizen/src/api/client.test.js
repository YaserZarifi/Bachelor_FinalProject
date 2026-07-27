import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  currentUsername,
  decodeJwt,
  flattenFeature,
  flattenFeatures,
  getAccessToken,
  getGuestReports,
  isAuthenticated,
  loginTokens,
  logoutClient,
  mediaUrl,
  saveGuestReport,
  wsBaseUrl,
} from './client.js'

/**
 * Build an unsigned JWT with the given payload (display-only decoding).
 * The payload is UTF-8 encoded before base64url, exactly as a real JWT library
 * does — `btoa` alone cannot represent Persian claims.
 */
function fakeJwt(payload) {
  const b64 = (o) =>
    Buffer.from(JSON.stringify(o), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.signature`
}

describe('flattenFeatures — the GeoJSON list envelope', () => {
  it('returns the features of a FeatureCollection', () => {
    const payload = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 1 }, { type: 'Feature', id: 2 }],
    }
    expect(flattenFeatures(payload)).toHaveLength(2)
  })

  it('wraps a single Feature in an array', () => {
    expect(flattenFeatures({ type: 'Feature', id: 7 })).toEqual([
      { type: 'Feature', id: 7 },
    ])
  })

  it('unwraps a DRF-paginated response', () => {
    const payload = {
      count: 1,
      results: { type: 'FeatureCollection', features: [{ type: 'Feature', id: 3 }] },
    }
    expect(flattenFeatures(payload)).toHaveLength(1)
  })

  it('passes a plain array straight through', () => {
    expect(flattenFeatures([{ id: 1 }])).toEqual([{ id: 1 }])
  })

  it('returns an empty array for null, undefined and unknown shapes', () => {
    expect(flattenFeatures(null)).toEqual([])
    expect(flattenFeatures(undefined)).toEqual([])
    expect(flattenFeatures({ type: 'Nonsense' })).toEqual([])
  })

  it('returns an empty array for a FeatureCollection with no features array', () => {
    expect(flattenFeatures({ type: 'FeatureCollection' })).toEqual([])
  })
})

describe('flattenFeature — collapsing one Feature for the UI', () => {
  const feature = {
    type: 'Feature',
    id: 42,
    geometry: { type: 'Point', coordinates: [51.389, 35.6892] },
    properties: { status: 'SUBMITTED', description: 'چاله' },
  }

  it('lifts the id out of the envelope', () => {
    expect(flattenFeature(feature).id).toBe(42)
  })

  it('reads longitude from coordinate 0 and latitude from coordinate 1', () => {
    const flat = flattenFeature(feature)
    expect(flat.lng).toBe(51.389)
    expect(flat.lat).toBe(35.6892)
  })

  it('spreads the properties onto the result', () => {
    expect(flattenFeature(feature).status).toBe('SUBMITTED')
    expect(flattenFeature(feature).description).toBe('چاله')
  })

  it('returns null for a missing feature', () => {
    expect(flattenFeature(null)).toBeNull()
  })

  it('returns an already-flat object unchanged', () => {
    const flat = { id: 1, status: 'CLOSED' }
    expect(flattenFeature(flat)).toBe(flat)
  })

  it('leaves lat/lng undefined when the geometry is absent', () => {
    const flat = flattenFeature({ type: 'Feature', id: 1, properties: {} })
    expect(flat.lng).toBeUndefined()
    expect(flat.lat).toBeUndefined()
  })

  it('⚠️ cannot read coordinates from the EWKT string the API actually sends', () => {
    // The backend emits `"SRID=4326;POINT (51.389 35.6892)"` because
    // `rest_framework_gis` is missing from INSTALLED_APPS. This helper only
    // understands the GeoJSON object form, so lat/lng come out undefined.
    // Pinned as a regression test: once the backend is fixed, or this helper
    // learns to parse WKT, this expectation must be updated.
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

describe('mediaUrl', () => {
  it('prefixes a relative path with the API origin', () => {
    expect(mediaUrl('/media/a.jpg')).toBe('http://localhost:8080/media/a.jpg')
  })

  it('inserts a missing leading slash', () => {
    expect(mediaUrl('media/a.jpg')).toBe('http://localhost:8080/media/a.jpg')
  })

  it('leaves an absolute http url alone', () => {
    expect(mediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
  })

  it('returns an empty string for a missing path', () => {
    expect(mediaUrl('')).toBe('')
    expect(mediaUrl(null)).toBe('')
    expect(mediaUrl(undefined)).toBe('')
  })
})

describe('wsBaseUrl', () => {
  it('derives a ws:// origin from the http API base', () => {
    expect(wsBaseUrl()).toBe('ws://localhost:8080')
  })

  it('carries no trailing slash, so paths can be appended directly', () => {
    expect(wsBaseUrl().endsWith('/')).toBe(false)
  })
})

describe('decodeJwt', () => {
  it('decodes the payload of a well-formed token', () => {
    expect(decodeJwt(fakeJwt({ username: 'ali', is_staff: false }))).toEqual({
      username: 'ali',
      is_staff: false,
    })
  })

  it('decodes non-ASCII claims', () => {
    expect(decodeJwt(fakeJwt({ username: 'کاربر' })).username).toBe('کاربر')
  })

  it('returns null for a malformed token', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull()
  })

  it('returns null for an empty token', () => {
    expect(decodeJwt('')).toBeNull()
    expect(decodeJwt(null)).toBeNull()
  })

  it('never throws on hostile input', () => {
    expect(() => decodeJwt('a.b.c')).not.toThrow()
  })
})

describe('token storage and the auth signal', () => {
  it('reports "not authenticated" with no token', () => {
    expect(isAuthenticated()).toBe(false)
    expect(getAccessToken()).toBeNull()
  })

  it('stores both tokens on login', () => {
    loginTokens('access-1', 'refresh-1')
    expect(localStorage.getItem('access_token')).toBe('access-1')
    expect(localStorage.getItem('refresh_token')).toBe('refresh-1')
    expect(isAuthenticated()).toBe(true)
  })

  it('accepts an access token without a refresh token', () => {
    loginTokens('access-only')
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('clears both tokens on logout', () => {
    loginTokens('access-1', 'refresh-1')
    logoutClient()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(isAuthenticated()).toBe(false)
  })

  it('emits auth-changed on login so the navbar re-renders', () => {
    const listener = vi.fn()
    window.addEventListener('auth-changed', listener)
    loginTokens('access-1')
    expect(listener).toHaveBeenCalled()
    window.removeEventListener('auth-changed', listener)
  })

  it('emits auth-changed on logout', () => {
    const listener = vi.fn()
    window.addEventListener('auth-changed', listener)
    logoutClient()
    expect(listener).toHaveBeenCalled()
    window.removeEventListener('auth-changed', listener)
  })
})

describe('currentUsername', () => {
  it('reads the username claim from the stored token', () => {
    loginTokens(fakeJwt({ username: 'ali' }))
    expect(currentUsername()).toBe('ali')
  })

  it('falls back to a Persian "user #id" label', () => {
    loginTokens(fakeJwt({ user_id: 12 }))
    expect(currentUsername()).toBe('کاربر #12')
  })

  it('returns null when nobody is signed in', () => {
    expect(currentUsername()).toBeNull()
  })

  it('returns null for a token with neither claim', () => {
    loginTokens(fakeJwt({ exp: 1 }))
    expect(currentUsername()).toBeNull()
  })
})

describe('guest report tracking', () => {
  beforeEach(() => localStorage.removeItem('guest_reports'))

  it('starts empty', () => {
    expect(getGuestReports()).toEqual([])
  })

  it('remembers a filed report and its token', () => {
    saveGuestReport({ id: 1, token: 'tok-1', description: 'چاله' })
    const [entry] = getGuestReports()
    expect(entry.id).toBe(1)
    expect(entry.token).toBe('tok-1')
  })

  it('stamps each entry with a save time', () => {
    saveGuestReport({ id: 1, token: 'tok-1' })
    expect(typeof getGuestReports()[0].savedAt).toBe('number')
  })

  it('puts the newest report first', () => {
    saveGuestReport({ id: 1, token: 'a' })
    saveGuestReport({ id: 2, token: 'b' })
    expect(getGuestReports().map((r) => r.id)).toEqual([2, 1])
  })

  it('replaces rather than duplicates an existing report', () => {
    saveGuestReport({ id: 1, token: 'old' })
    saveGuestReport({ id: 1, token: 'new' })
    const list = getGuestReports()
    expect(list).toHaveLength(1)
    expect(list[0].token).toBe('new')
  })

  it('keeps at most 100 reports', () => {
    for (let i = 0; i < 105; i += 1) saveGuestReport({ id: i, token: `t${i}` })
    expect(getGuestReports()).toHaveLength(100)
  })

  it('survives corrupt storage without throwing', () => {
    localStorage.setItem('guest_reports', 'not json')
    expect(getGuestReports()).toEqual([])
  })
})
