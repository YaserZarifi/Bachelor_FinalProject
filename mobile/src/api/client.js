import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

/**
 * Backend base URL.
 * - In Expo Go on a physical device, `localhost` points at the phone, not your
 *   PC. Set EXPO_PUBLIC_API_BASE to your machine's LAN IP, e.g.
 *   EXPO_PUBLIC_API_BASE=http://192.168.1.20:8080
 */
export const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE || 'http://localhost:8080'
).replace(/\/$/, '');

export const API_ROOT = `${API_BASE}/api`;

const ACCESS_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

// ── Token storage (SecureStore) ──────────────────────────────────────────────
export async function getAccessToken() {
  try {
    return await SecureStore.getItemAsync(ACCESS_KEY);
  } catch {
    return null;
  }
}
export async function getRefreshToken() {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}
export async function setTokens(access, refresh) {
  if (access) await SecureStore.setItemAsync(ACCESS_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}
export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
}

// ── Axios instance ───────────────────────────────────────────────────────────
export const api = axios.create({ baseURL: API_ROOT, timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Refresh the access token once on 401, then replay the request.
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (status === 401 && original && !original._retried) {
      original._retried = true;
      try {
        if (!refreshing) refreshing = doRefresh();
        const newAccess = await refreshing;
        refreshing = null;
        if (newAccess) {
          original.headers.Authorization = `Bearer ${newAccess}`;
          return api(original);
        }
      } catch {
        refreshing = null;
      }
    }
    return Promise.reject(error);
  }
);

async function doRefresh() {
  const refresh = await getRefreshToken();
  if (!refresh) return null;
  const res = await axios.post(`${API_ROOT}/auth/token/refresh/`, { refresh });
  const access = res.data?.access;
  if (access) await SecureStore.setItemAsync(ACCESS_KEY, access);
  return access;
}

// ── GeoJSON helpers (mirror frontend-citizen api/client.js) ──────────────────
export function flattenFeatures(payload) {
  if (!payload) return [];
  if (payload.type === 'FeatureCollection' && Array.isArray(payload.features)) {
    return payload.features.map(flattenFeature);
  }
  if (payload.type === 'Feature') return [flattenFeature(payload)];
  if (Array.isArray(payload)) return payload;
  return [];
}

/** Collapse a GeoJSON Feature into a flat object with lat/lng. */
export function flattenFeature(f) {
  if (!f || f.type !== 'Feature') return f;
  const coords = f.geometry?.coordinates || [];
  return {
    ...f.properties,
    id: f.id ?? f.properties?.id,
    lng: coords[0],
    lat: coords[1],
    guest_access_token:
      f.properties?.guest_access_token ?? f.guest_access_token ?? null,
  };
}

export function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function wsBaseUrl() {
  const raw = process.env.EXPO_PUBLIC_WS_BASE || API_BASE.replace(/^http/, 'ws');
  return raw.replace(/\/$/, '');
}
