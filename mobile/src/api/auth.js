import { api, API_ROOT, setTokens } from './client';
import axios from 'axios';

export async function login(username, password) {
  const res = await axios.post(`${API_ROOT}/auth/token/`, { username, password });
  const { access, refresh } = res.data;
  await setTokens(access, refresh);
  return res.data;
}

export async function register(username, email, password) {
  await axios.post(`${API_ROOT}/auth/register/`, { username, email, password });
  // Immediately log in to obtain tokens.
  return login(username, password);
}

export async function fetchMe() {
  // The backend has no /me endpoint; reuse a cheap authed call to verify session.
  // We derive identity from the stored token instead (see AuthContext).
  const res = await api.get('reports/');
  return res.data;
}
