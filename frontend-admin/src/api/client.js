import axios from 'axios'

const API =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, '') || 'http://localhost:8080'
export const api = axios.create({ baseURL: `${API}/api` })

api.interceptors.request.use((config) => {
  const t = localStorage.getItem('access_token')
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

export function loginTokens(access, refresh) {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
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

export function flattenFeatures(payload) {
  if (!payload) return []
  if (payload.type === 'FeatureCollection' && Array.isArray(payload.features)) {
    return payload.features
  }
  if (payload.type === 'Feature') return [payload]
  return []
}
