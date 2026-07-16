import axios from 'axios'

const API =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, '') || 'http://localhost:8080'
const API_ROOT = `${API}/api`

export const api = axios.create({ baseURL: API_ROOT })

// ── Auth token storage ─────────────────────────────────────────────
export function getAccessToken() {
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}
function getRefreshToken() {
  try {
    return localStorage.getItem('refresh_token')
  } catch {
    return null
  }
}

export function loginTokens(access, refresh) {
  localStorage.setItem('access_token', access)
  if (refresh) localStorage.setItem('refresh_token', refresh)
  emitAuthChange()
}

export function logoutClient() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  emitAuthChange()
}

/** Lightweight cross-component auth signal (Navbar, guards, pages). */
export function emitAuthChange() {
  try {
    window.dispatchEvent(new Event('auth-changed'))
  } catch {
    /* SSR / no window */
  }
}

export function isAuthenticated() {
  return !!getAccessToken()
}

/** Decode a JWT payload without verifying (for display only). */
export function decodeJwt(token) {
  if (!token) return null
  try {
    const part = token.split('.')[1]
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return null
  }
}

/** Best-effort display name from the access token. */
export function currentUsername() {
  const payload = decodeJwt(getAccessToken())
  if (!payload) return null
  return payload.username || (payload.user_id ? `کاربر #${payload.user_id}` : null)
}

// ── Request interceptor: attach bearer ──────────────────────────────
api.interceptors.request.use((config) => {
  const t = getAccessToken()
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

// ── Response interceptor: single-flight refresh on 401 ──────────────
let refreshing = null
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const refresh = getRefreshToken()
    if (
      status === 401 &&
      refresh &&
      original &&
      !original._retried &&
      !original.url?.includes('auth/token')
    ) {
      original._retried = true
      try {
        refreshing =
          refreshing ||
          axios.post(`${API_ROOT}/auth/token/refresh/`, { refresh })
        const { data } = await refreshing
        refreshing = null
        if (data?.access) {
          localStorage.setItem('access_token', data.access)
          if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        }
      } catch {
        refreshing = null
        logoutClient()
      }
    }
    return Promise.reject(error)
  },
)

/** Build an absolute media URL from a possibly-relative path returned by the API. */
export function mediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${API}${path.startsWith('/') ? '' : '/'}${path}`
}

export function wsBaseUrl() {
  const raw = import.meta.env.VITE_WS_BASE || API.replace(/^http/, 'ws')
  return raw.replace(/\/$/, '')
}

/** Parse GeoJSON Feature or FeatureCollection from DRF GIS list responses. */
export function flattenFeatures(payload) {
  if (!payload) return []
  // Tolerate a DRF-paginated wrapper as well as a bare FeatureCollection.
  const body = payload.results ?? payload
  if (body.type === 'FeatureCollection' && Array.isArray(body.features)) {
    return body.features
  }
  if (body.type === 'Feature') return [body]
  if (Array.isArray(body)) return body
  return []
}

/** Flatten a single GeoJSON Feature into `{...properties, id, lng, lat, guest_access_token}`. */
export function flattenFeature(feature) {
  if (!feature) return null
  if (feature.type !== 'Feature') return feature
  const coords = feature.geometry?.coordinates || []
  return {
    id: feature.id,
    lng: coords[0],
    lat: coords[1],
    ...feature.properties,
  }
}

/** Fetch a single report, optionally with a guest token (for anonymous reporters). */
export async function fetchReport(id, guestToken) {
  const config = guestToken ? { params: { guest_token: guestToken } } : {}
  const { data } = await api.get(`reports/${id}/`, config)
  return flattenFeature(data)
}

// ── Guest report tracking (persist guest tokens locally) ────────────
const GUEST_KEY = 'guest_reports'

export function saveGuestReport(entry) {
  try {
    const list = getGuestReports().filter((r) => r.id !== entry.id)
    list.unshift({ savedAt: Date.now(), ...entry })
    localStorage.setItem(GUEST_KEY, JSON.stringify(list.slice(0, 100)))
    emitAuthChange()
  } catch {
    /* storage unavailable */
  }
}

export function getGuestReports() {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) || '[]')
  } catch {
    return []
  }
}
