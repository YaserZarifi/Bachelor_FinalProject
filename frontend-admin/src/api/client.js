import axios from 'axios'

const API =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, '') || 'http://localhost:8080'
const API_ROOT = `${API}/api`
export const api = axios.create({ baseURL: API_ROOT })

function getAccess() {
  try {
    return localStorage.getItem('access_token')
  } catch {
    return null
  }
}

api.interceptors.request.use((config) => {
  const t = getAccess()
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

// Single-flight refresh on 401 so an expired staff session recovers silently.
let refreshing = null
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    let refresh
    try {
      refresh = localStorage.getItem('refresh_token')
    } catch {
      refresh = null
    }
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
          refreshing || axios.post(`${API_ROOT}/auth/token/refresh/`, { refresh })
        const { data } = await refreshing
        refreshing = null
        if (data?.access) {
          localStorage.setItem('access_token', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        }
      } catch {
        refreshing = null
        logoutClient()
        if (!window.location.pathname.includes('/login')) {
          window.location.assign('/login')
        }
      }
    }
    return Promise.reject(error)
  },
)

export function loginTokens(access, refresh) {
  localStorage.setItem('access_token', access)
  if (refresh) localStorage.setItem('refresh_token', refresh)
}

export function logoutClient() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export function mediaUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `${API}${path.startsWith('/') ? '' : '/'}${path}`
}

export function wsBaseUrl() {
  const raw = import.meta.env.VITE_WS_BASE || API.replace(/^http/, 'ws')
  return raw.replace(/\/$/, '')
}

export function flattenFeatures(payload) {
  if (!payload) return []
  const body = payload.results ?? payload
  if (body.type === 'FeatureCollection' && Array.isArray(body.features)) {
    return body.features
  }
  if (body.type === 'Feature') return [body]
  if (Array.isArray(body)) return body
  return []
}
