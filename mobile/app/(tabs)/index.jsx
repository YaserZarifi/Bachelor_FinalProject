import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';

import { AuroraBackground } from '../../src/components/ui/AuroraBackground';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { Button } from '../../src/components/ui/Button';
import { BrandLockup } from '../../src/components/Brand';
import { StatusBadge } from '../../src/components/StatusBadge';
import { useAuth } from '../../src/context/AuthContext';
import { initPush } from '../../src/notifications/pushManager';
import { syncQueue, getPendingCount } from '../../src/api/offline';
import { getGuestReports } from '../../src/api/guestStore';
import { fetchMyReports } from '../../src/api/reports';
import { colors, fonts, radius, shadow } from '../../src/theme';

const STEPS = [
  { icon: 'camera', title: 'ثبت تصویر زنده', text: 'عکس معتبر و ضدجعل با دوربین' },
  { icon: 'location', title: 'قفل موقعیت', text: 'موقعیت دقیق از GPS دستگاه' },
  { icon: 'send', title: 'ارسال گزارش', text: 'توضیح کوتاه و ارسال سریع' },
  { icon: 'notifications', title: 'پیگیری زنده', text: 'اعلان هنگام تغییر وضعیت' },
];

const EMERGENCY = [
  { label: 'پلیس', number: '110', icon: 'shield-checkmark', color: colors.aurora.sky },
  { label: 'آتش‌نشانی', number: '125', icon: 'flame', color: colors.rose },
  { label: 'اورژانس', number: '115', icon: 'medkit', color: colors.emerald },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const [latest, setLatest] = useState(null);
  const [pending, setPending] = useState(0);

  // Register for push + flush offline queue once on entry / connectivity.
  useEffect(() => {
    initPush({ authenticated: isAuthenticated });
  }, [isAuthenticated]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      if (s.isConnected) syncQueue().then(refresh);
    });
    return unsub;
  }, []);

  const refresh = useCallback(async () => {
    setPending(await getPendingCount());
    let newest = null;
    try {
      if (isAuthenticated) {
        const mine = await fetchMyReports();
        newest = mine?.[0] || null;
      }
    } catch {
      /* offline */
    }
    if (!newest) {
      const guests = await getGuestReports();
      newest = guests?.[0] ? { ...guests[0], description: guests[0].description } : null;
    }
    setLatest(newest);
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <AuroraBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <BrandLockup />
            <Pressable style={styles.bell} onPress={() => router.push('/(tabs)/reports')}>
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.greeting}>
            {isAuthenticated ? `سلام${user?.username ? '، ' + user.username : ''} 👋` : 'سلام شهروند گرامی 👋'}
          </Text>
          <Text style={styles.sub}>چه مشکلی را امروز گزارش می‌کنی؟</Text>

          {/* Hero CTA */}
          <Animated.View entering={FadeInDown.duration(500).springify()}>
            <Pressable onPress={() => router.push('/report/new')}>
              <LinearGradient
                colors={['#1a2540', colors.ink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.hero, shadow.card]}
              >
                <View style={styles.heroGlow} />
                <View style={styles.heroBadge}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.civic[400]} />
                  <Text style={styles.heroBadgeText}>ثبت امن و ضدجعل</Text>
                </View>
                <Text style={styles.heroTitle}>ثبت گزارش جدید</Text>
                <Text style={styles.heroText}>در کمتر از یک دقیقه، تصویر و موقعیت را ثبت کن.</Text>
                <View style={styles.heroBtn}>
                  <Ionicons name="add-circle" size={20} color={colors.onBrand} />
                  <Text style={styles.heroBtnText}>شروع کن</Text>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {pending > 0 && (
            <GlassCard style={styles.pendingCard}>
              <View style={styles.pendingRow}>
                <Ionicons name="cloud-upload-outline" size={20} color={colors.amber} />
                <Text style={styles.pendingText}>
                  {pending.toLocaleString('fa-IR')} گزارش در صف ارسال (آفلاین)
                </Text>
              </View>
            </GlassCard>
          )}

          {/* Latest report mini-status */}
          {latest && (
            <Animated.View entering={FadeIn.duration(400)}>
            <Pressable onPress={() => router.push(`/report/${latest.id}`)}>
              <GlassCard style={{ marginTop: 14 }}>
                <Text style={styles.cardLabel}>آخرین گزارش شما</Text>
                <View style={styles.latestRow}>
                  <StatusBadge status={latest.status} size="sm" />
                  <Text style={styles.latestId}>#{latest.id}</Text>
                </View>
                <Text numberOfLines={1} style={styles.latestDesc}>{latest.description || 'بدون توضیح'}</Text>
              </GlassCard>
            </Pressable>
            </Animated.View>
          )}

          {/* Steps */}
          <Text style={styles.section}>در چهار گام ساده</Text>
          <View style={styles.stepsGrid}>
            {STEPS.map((s, i) => (
              <Animated.View key={s.title} entering={FadeInDown.delay(i * 70).duration(400)} style={styles.step}>
                <GlassCard>
                  <View style={styles.stepIcon}>
                    <Ionicons name={s.icon} size={20} color={colors.brand[300]} />
                  </View>
                  <Text style={styles.stepNum}>{(i + 1).toLocaleString('fa-IR')}</Text>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepText}>{s.text}</Text>
                </GlassCard>
              </Animated.View>
            ))}
          </View>

          {/* Emergency */}
          <Text style={styles.section}>تماس‌های اضطراری</Text>
          <View style={styles.emergencyRow}>
            {EMERGENCY.map((e) => (
              <Pressable key={e.number} style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${e.number}`)}>
                <GlassCard style={styles.emCard}>
                  <View style={[styles.emIcon, { backgroundColor: e.color + '22' }]}>
                    <Ionicons name={e.icon} size={22} color={e.color} />
                  </View>
                  <Text style={styles.emLabel}>{e.label}</Text>
                  <Text style={styles.emNumber}>{e.number.toLocaleString('fa-IR')}</Text>
                </GlassCard>
              </Pressable>
            ))}
          </View>

          {!isAuthenticated && (
            <GlassCard style={{ marginTop: 18 }}>
              <Text style={styles.cardLabel}>حساب کاربری</Text>
              <Text style={styles.loginHint}>
                با ورود به حساب، همهٔ گزارش‌هایت را در یک‌جا دنبال کن و اعلان‌ها را روی همهٔ دستگاه‌ها داشته باش.
              </Text>
              <Button title="ورود / ثبت‌نام" variant="glass" onPress={() => router.push('/auth/login')} style={{ marginTop: 12 }} />
            </GlassCard>
          )}

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 6 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  bell: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  greeting: { color: colors.text, fontFamily: fonts.black, fontSize: 24, textAlign: 'right', marginTop: 20 },
  sub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15, textAlign: 'right', marginTop: 4 },
  hero: { borderRadius: radius['2xl'], padding: 22, marginTop: 18, overflow: 'hidden' },
  heroGlow: { position: 'absolute', top: -50, left: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(242,162,13,0.22)' },
  heroBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },
  heroBadgeText: { color: '#fff', fontFamily: fonts.bold, fontSize: 11 },
  heroTitle: { color: '#fff', fontFamily: fonts.black, fontSize: 26, textAlign: 'right', marginTop: 14 },
  heroText: { color: 'rgba(255,255,255,0.9)', fontFamily: fonts.regular, fontSize: 14, textAlign: 'right', marginTop: 6 },
  heroBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: colors.brand[400], paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, marginTop: 16,
  },
  heroBtnText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: 14 },
  pendingCard: { marginTop: 14, borderColor: colors.amber + '55' },
  pendingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  pendingText: { color: colors.amber, fontFamily: fonts.semibold, fontSize: 13, textAlign: 'right' },
  cardLabel: { color: colors.textFaint, fontFamily: fonts.semibold, fontSize: 12, textAlign: 'right', marginBottom: 8 },
  latestRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  latestId: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 13 },
  latestDesc: { color: colors.text, fontFamily: fonts.medium, fontSize: 14, textAlign: 'right', marginTop: 8 },
  section: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, textAlign: 'right', marginTop: 28, marginBottom: 14 },
  stepsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  step: { width: '47%', flexGrow: 1 },
  stepIcon: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brand[500] + '22',
  },
  stepNum: { position: 'absolute', top: 12, left: 16, color: 'rgba(255,255,255,0.08)', fontFamily: fonts.black, fontSize: 40 },
  stepTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, textAlign: 'right', marginTop: 12 },
  stepText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'right', marginTop: 4, lineHeight: 19 },
  emergencyRow: { flexDirection: 'row-reverse', gap: 10 },
  emCard: { alignItems: 'center', paddingVertical: 16 },
  emIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  emLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, marginTop: 8 },
  emNumber: { color: colors.text, fontFamily: fonts.black, fontSize: 18, marginTop: 2 },
  loginHint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, textAlign: 'right', lineHeight: 21 },
});
