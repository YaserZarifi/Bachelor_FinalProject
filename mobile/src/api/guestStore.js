import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Anonymous reports are tracked locally by their guest_access_token so a
 * not-logged-in citizen can still follow their reports' live status.
 */
const KEY = 'guest_reports';

export async function getGuestReports() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function rememberGuestReport(entry) {
  const list = await getGuestReports();
  const without = list.filter((r) => r.id !== entry.id);
  without.unshift({ ...entry, savedAt: new Date().toISOString() });
  await AsyncStorage.setItem(KEY, JSON.stringify(without.slice(0, 100)));
}

export async function updateGuestStatus(id, status) {
  const list = await getGuestReports();
  const next = list.map((r) => (r.id === id ? { ...r, status } : r));
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function getGuestToken(id) {
  const list = await getGuestReports();
  return list.find((r) => r.id === id)?.token || null;
}
