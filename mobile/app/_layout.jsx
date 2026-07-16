import React, { useEffect, useRef } from 'react';
import { LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  Vazirmatn_300Light,
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_600SemiBold,
  Vazirmatn_700Bold,
  Vazirmatn_800ExtraBold,
  Vazirmatn_900Black,
} from '@expo-google-fonts/vazirmatn';

import { AuthProvider } from '../src/context/AuthContext';
import { FeedbackProvider, useFeedback } from '../src/context/FeedbackContext';
import {
  ensureAndroidChannel,
  configureForegroundHandler,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  getLastNotificationResponse,
} from '../src/notifications/registerPush';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Remote push isn't supported in Expo Go (SDK 53+) — the app degrades gracefully
// to live WebSocket updates + in-app toasts. Hide the expected dev noise.
LogBox.ignoreLogs([
  'expo-notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'Android Push notifications (remote notifications)',
  'No "projectId" found',
]);

/**
 * Bridges OS notifications into the app: foreground arrivals become in-app
 * toasts (never native banners), and taps deep-link to the report. Lives inside
 * FeedbackProvider so it can use the in-app toast.
 */
function NotificationBridge() {
  const router = useRouter();
  const { toast } = useFeedback();
  const responded = useRef(false);

  useEffect(() => {
    configureForegroundHandler();
    ensureAndroidChannel();

    const goToReport = (response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.report_id) router.push(`/report/${data.report_id}`);
    };

    // Cold start from a notification tap.
    getLastNotificationResponse().then((resp) => {
      if (resp && !responded.current) {
        responded.current = true;
        setTimeout(() => goToReport(resp), 400);
      }
    });

    // Tap while running.
    const tapSub = addNotificationResponseListener(goToReport);

    // Foreground arrival → show the app's own toast instead of an OS banner.
    const recvSub = addNotificationReceivedListener((notification) => {
      const content = notification?.request?.content;
      const message = content?.body || content?.title || 'به‌روزرسانی جدید';
      toast(message, 'info');
    });

    return () => {
      tapSub?.remove();
      recvSub?.remove();
    };
  }, [router, toast]);

  return null;
}

export default function RootLayout() {
  // Load fonts, but DO NOT gate rendering on them — if a font asset errors,
  // gating would leave the app frozen on the splash forever.
  const [fontsLoaded, fontError] = useFonts({
    Vazir_300: Vazirmatn_300Light,
    Vazir_400: Vazirmatn_400Regular,
    Vazir_500: Vazirmatn_500Medium,
    Vazir_600: Vazirmatn_600SemiBold,
    Vazir_700: Vazirmatn_700Bold,
    Vazir_800: Vazirmatn_800ExtraBold,
    Vazir_900: Vazirmatn_900Black,
  });

  // Hide the splash on mount no matter what (with a hard fallback timeout).
  useEffect(() => {
    const hide = () => SplashScreen.hideAsync().catch(() => {});
    if (fontsLoaded || fontError) hide();
    const t = setTimeout(hide, 1500);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <AuthProvider>
        <FeedbackProvider>
          <NotificationBridge />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.ink },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="report/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="report/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="auth/login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="auth/register" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
        </FeedbackProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
