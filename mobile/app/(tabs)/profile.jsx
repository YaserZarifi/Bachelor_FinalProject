import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { AuroraBackground } from '../../src/components/ui/AuroraBackground';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { Button } from '../../src/components/ui/Button';
import { useAuth } from '../../src/context/AuthContext';
import { getStoredPushToken } from '../../src/notifications/pushManager';
import { colors, fonts, shadow } from '../../src/theme';

function Row({ icon, label, value, onPress, danger }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && onPress && { opacity: 0.7 }]}>
      <View style={styles.rowRight}>
        <View style={[styles.rowIcon, danger && { backgroundColor: colors.roseSoft }]}>
          <Ionicons name={icon} size={18} color={danger ? colors.rose : colors.brand[300]} />
        </View>
        <Text style={[styles.rowLabel, danger && { color: colors.rose }]}>{label}</Text>
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : onPress ? (
        <Ionicons name="chevron-back" size={18} color={colors.textFaint} />
      ) : null}
    </Pressable>
  );
}

export default function Profile() {
  const router = useRouter();
  const { isAuthenticated, user, signOut } = useAuth();
  const [pushOn, setPushOn] = useState(false);

  useEffect(() => {
    getStoredPushToken().then((t) => setPushOn(!!t));
  }, []);

  const confirmSignOut = () => {
    Alert.alert('خروج از حساب', 'آیا مطمئن هستید؟', [
      { text: 'انصراف', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <AuroraBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>پروفایل</Text>

          <GlassCard style={styles.identity}>
            <LinearGradient
              colors={[colors.brand[300], colors.brand[500]]}
              style={[styles.avatar, shadow.glow]}
            >
              <Ionicons name={isAuthenticated ? 'person' : 'person-outline'} size={32} color={colors.onBrand} />
            </LinearGradient>
            <Text style={styles.name}>{isAuthenticated ? user?.username : 'کاربر مهمان'}</Text>
            <Text style={styles.role}>
              {isAuthenticated ? 'حساب تأییدشده' : 'بدون ورود — گزارش‌ها روی این دستگاه دنبال می‌شوند'}
            </Text>
            {!isAuthenticated && (
              <Button title="ورود / ثبت‌نام" onPress={() => router.push('/auth/login')} style={{ marginTop: 16, width: '100%' }} />
            )}
          </GlassCard>

          <Text style={styles.section}>تنظیمات</Text>
          <GlassCard padded={false} style={styles.group}>
            <Row
              icon="notifications"
              label="اعلان تغییر وضعیت"
              value={pushOn ? 'فعال' : 'غیرفعال'}
              onPress={() => Linking.openSettings?.()}
            />
            <View style={styles.divider} />
            <Row icon="documents" label="گزارش‌های من" onPress={() => router.push('/(tabs)/reports')} />
          </GlassCard>

          <Text style={styles.section}>درباره</Text>
          <GlassCard padded={false} style={styles.group}>
            <Row icon="shield-checkmark" label="حریم خصوصی و امنیت" onPress={() => {}} />
            <View style={styles.divider} />
            <Row icon="information-circle" label="نسخهٔ برنامه" value={Constants.expoConfig?.version || '1.0.0'} />
          </GlassCard>

          {isAuthenticated && (
            <GlassCard padded={false} style={[styles.group, { marginTop: 18 }]}>
              <Row icon="log-out" label="خروج از حساب" onPress={confirmSignOut} danger />
            </GlassCard>
          )}

          <Text style={styles.footer}>شهریاور — سامانهٔ گزارش شهروندی</Text>
          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 18, paddingTop: 10 },
  title: { color: colors.text, fontFamily: fonts.black, fontSize: 24, textAlign: 'right' },
  identity: { alignItems: 'center', paddingVertical: 24, marginTop: 16 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontFamily: fonts.black, fontSize: 20, marginTop: 14 },
  role: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginTop: 6, textAlign: 'center', paddingHorizontal: 16 },
  section: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, textAlign: 'right', marginTop: 24, marginBottom: 12 },
  group: { overflow: 'hidden' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 15 },
  rowRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand[500] + '22' },
  rowLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  rowValue: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  footer: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 28 },
});
