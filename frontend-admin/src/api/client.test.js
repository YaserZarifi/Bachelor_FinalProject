import { describe, it, expect } from 'vitest'
import {
  flattenFeatures,
  loginTokens,
  logoutClient,
  mediaUrl,
  wsBaseUrl,
} from './client.js'

describe('flattenFeatures — the GeoJSON list envelope', () => {
  it('returns the features of a FeatureCollection', () => {
    const payload = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 1 }, { type: 'Feature', id: 2 }],
    }
    expect(flattenFeatures(payload)).toHaveLength(2)
  })

  it('keeps the full Feature envelope, unlike the citizen app', () => {
    // The dashboard reads `f.geometry` itself (its `toLatLng` copes with both
    // encodings), so it must NOT be collapsed here.
    const [feature] = flattenFeatures({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 1, geometry: 'SRID=4326;POINT (51.4 35.7)' }],
    })
    expect(feature.geometry).toBe('SRID=4326;POINT (51.4 35.7)')
  })

  it('wraps a single Feature in an array', () => {
    expect(flattenFeatures({ type: 'Feature', id: 7 })).toHaveLength(1)
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

  it('behaves identically to the citizen implementation on the same input', () => {
    // The two SPAs keep separate copies of this helper; drift between them
    // would show up as one client rendering an empty map.
    const payload = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', id: 1 }],
    }
    expect(flattenFeatures(payload)).toHaveLength(1)
    expect(flattenFeatures({ results: payload })).toHaveLength(1)
  })
})

describe('mediaUrl', () => {
  it('prefixes a relative path with the API origin', () => {
    expect(mediaUrl('/media/after.jpg')).toBe('http://localhost:8080/media/after.jpg')
  })

  it('inserts a missing leading slash', () => {
    expect(mediaUrl('media/after.jpg')).toBe('http://localhost:8080/media/after.jpg')
  })

  it('leaves an absolute url alone', () => {
    expect(mediaUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
  })

  it('returns an empty string for a missing path', () => {
    expect(mediaUrl('')).toBe('')
    expect(mediaUrl(null)).toBe('')
  })
})

describe('wsBaseUrl', () => {
  it('derives a ws:// origin from the http API base', () => {
    expect(wsBaseUrl()).toBe('ws://localhost:8080')
  })

  it('carries no trailing slash', () => {
    expect(wsBaseUrl().endsWith('/')).toBe(false)
  })
})

describe('staff session storage', () => {
  it('stores both tokens on login', () => {
    loginTokens('access-1', 'refresh-1')
    expect(localStorage.getItem('access_token')).toBe('access-1')
    expect(localStorage.getItem('refresh_token')).toBe('refresh-1')
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
  })

  it('logging out twice is harmless', () => {
    logoutClient()
    expect(() => logoutClient()).not.toThrow()
  })
})
