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
import {
  ensureAndroidChannel,
  configureForegroundHandler,
  addNotificationResponseListener,
  getLastNotificationResponse,
} from '../src/notifications/registerPush';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Remote push isn't supported in Expo Go (SDK 53+) — the app degrades gracefully
// to live WebSocket updates + local notifications. Hide the expected dev noise.
LogBox.ignoreLogs([
  'expo-notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
  'Android Push notifications (remote notifications)',
  'No "projectId" found',
]);

export default function RootLayout() {
  const router = useRouter();
  // Load fonts, but DO NOT gate rendering on them — if a font asset errors,
  // gating would leave the app frozen on the splash forever. Unloaded custom
  // fonts simply fall back to the system font until they're ready.
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

  // Notification channel + tap routing
  const responded = useRef(false);
  useEffect(() => {
    configureForegroundHandler();
    ensureAndroidChannel();

    const goToReport = (response) => {
      const data = response?.notification?.request?.content?.data;
      if (data?.report_id) {
        router.push(`/report/${data.report_id}`);
      }
    };

    // Cold start from a notification tap
    getLastNotificationResponse().then((resp) => {
      if (resp && !responded.current) {
        responded.current = true;
        setTimeout(() => goToReport(resp), 400);
      }
    });

    const sub = addNotificationResponseListener(goToReport);
    return () => sub?.remove();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.ink }}>
      <AuthProvider>
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
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
