import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getAccessToken, clearTokens } from '../api/client';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

/** Decode the JWT payload (no verification — just to read username/exp). */
function decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const json = decodeBase64(part);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function decodeBase64(b64) {
  // React Native lacks atob in some runtimes; implement a tiny decoder.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = b64.replace(/-/g, '+').replace(/_/g, '/');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const ch of str) {
    const val = chars.indexOf(ch);
    if (val === -1 || ch === '=') continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  try {
    return decodeURIComponent(escape(output));
  } catch {
    return output;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { username }
  const [loading, setLoading] = useState(true);

  const refreshFromStorage = useCallback(async () => {
    const token = await getAccessToken();
    if (token) {
      const payload = decodeJwt(token);
      // Backend embeds `username` (+ is_staff) in the access token.
      const username =
        payload?.username ||
        (payload?.user_id != null ? `کاربر #${payload.user_id}` : 'حساب من');
      setUser({ username, isStaff: !!payload?.is_staff });
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshFromStorage();
  }, [refreshFromStorage]);

  const signIn = useCallback(async (username, password) => {
    await authApi.login(username, password);
    await refreshFromStorage();
  }, [refreshFromStorage]);

  const signUp = useCallback(async (username, email, password) => {
    await authApi.register(username, email, password);
    await refreshFromStorage();
  }, [refreshFromStorage]);

  const signOut = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, loading, signIn, signUp, signOut, refreshFromStorage }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
