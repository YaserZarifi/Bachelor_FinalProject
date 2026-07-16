import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExpoPushToken } from './registerPush';
import { registerPushToken } from '../api/push';

const TOKEN_KEY = 'expo_push_token';

export async function getStoredPushToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

/**
 * Obtain (or reuse) the Expo push token and register it with the backend.
 * For signed-in users this is enough to receive all their report updates.
 * Returns the token (or null on simulator / denied permission).
 */
export async function initPush({ authenticated } = {}) {
  let token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = await getExpoPushToken();
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  }
  if (token && authenticated) {
    try {
      await registerPushToken(token, Platform.OS);
    } catch {
      /* backend offline — will retry next launch */
    }
  }
  return token;
}

/** Bind the current device to a single guest report (anonymous tracking). */
export async function subscribeGuestReport(reportId, guestToken) {
  const token = await getStoredPushToken();
  if (!token) return;
  try {
    await registerPushToken(token, Platform.OS, { reportId, guestToken });
  } catch {
    /* non-fatal */
  }
}
