import { api } from './client';

/** Register/refresh this device's Expo push token with the backend. */
export async function registerPushToken(expoToken, platform, opts = {}) {
  const body = { expo_token: expoToken, platform };
  if (opts.reportId && opts.guestToken) {
    body.report_id = opts.reportId;
    body.guest_token = opts.guestToken;
  }
  const res = await api.post('push/register/', body);
  return res.data;
}

export async function unregisterPushToken(expoToken) {
  const res = await api.post('push/unregister/', { expo_token: expoToken });
  return res.data;
}
