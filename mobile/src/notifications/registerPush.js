import { Platform } from 'react-native';
import { colors } from '../theme';

/**
 * expo-notifications is loaded LAZILY (require inside functions) on purpose.
 * In Expo Go (SDK 53+) merely importing it prints a "remote push not supported"
 * error via an import-time side effect. Because ES `import` runs before any
 * module body, a static import would fire that before LogBox.ignoreLogs (set in
 * app/_layout.jsx) takes effect. Lazy-loading defers it to runtime, after the
 * ignore list is registered, so the demo stays clean. A development build has
 * full push support and is unaffected.
 */
function getNotifications() {
  return require('expo-notifications');
}

let _handlerConfigured = false;

/**
 * Foreground behaviour: SUPPRESS the OS banner/sound while the app is open —
 * شهریاور renders its own in-app toast instead (see FeedbackProvider). The OS
 * only handles notifications while the app is backgrounded/closed.
 */
export function configureForegroundHandler() {
  if (_handlerConfigured) return;
  _handlerConfigured = true;
  const Notifications = getNotifications();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Ensure the Android notification channel used for status updates exists. */
export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  const Notifications = getNotifications();
  await Notifications.setNotificationChannelAsync('status-updates', {
    name: 'به‌روزرسانی وضعیت گزارش',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.brand[600],
    sound: 'default',
  });
}

/** Ask for permission and return the Expo push token (or null). */
export async function getExpoPushToken() {
  const Notifications = getNotifications();
  const Device = require('expo-device');
  const Constants = require('expo-constants').default;

  await ensureAndroidChannel();

  if (!Device.isDevice) return null; // push tokens require a physical device

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenData.data;
  } catch {
    return null; // not supported in Expo Go — use a development build
  }
}

/** Fire a local notification immediately (foreground fallback). */
export async function presentLocal(title, body, data = {}) {
  try {
    const Notifications = getNotifications();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: 'default' },
      trigger: null,
    });
  } catch {
    /* notifications unavailable — ignore */
  }
}

/** Subscribe to notification taps. Returns a subscription with .remove(). */
export function addNotificationResponseListener(cb) {
  const Notifications = getNotifications();
  return Notifications.addNotificationResponseReceivedListener(cb);
}

/** Subscribe to notifications received while the app is in the foreground. */
export function addNotificationReceivedListener(cb) {
  const Notifications = getNotifications();
  return Notifications.addNotificationReceivedListener(cb);
}

/** The notification that cold-started the app (if any). */
export async function getLastNotificationResponse() {
  const Notifications = getNotifications();
  return Notifications.getLastNotificationResponseAsync();
}
