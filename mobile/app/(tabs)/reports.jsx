import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuroraBackground } from '../../src/components/ui/AuroraBackground';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { Button } from '../../src/components/ui/Button';
import { ReportCard } from '../../src/components/ReportCard';
import { useAuth } from '../../src/context/AuthContext';
import { fetchMyReports, fetchReport } from '../../src/api/reports';
import { getGuestReports } from '../../src/api/guestStore';
import { colors, fonts } from '../../src/theme';

export default function Reports() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = [];
      if (isAuthenticated) {
        const mine = await fetchMyReports();
        out.push(...mine);
      }
      // Merge anonymous (guest) reports tracked locally.
      const guests = await getGuestReports();
      const knownIds = new Set(out.map((r) => r.id));
      for (const g of guests) {
        if (knownIds.has(g.id)) continue;
        try {
          const full = await fetchReport(g.id, g.token);
          out.push({ ...full, __guestToken: g.token });
        } catch {
          out.push({
            id: g.id,
            description: g.description,
            status: g.status || 'SUBMITTED',
            created_at: g.savedAt,
            __guestToken: g.token,
          });
        }
      }
      out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
      setItems(out);
    } catch (e) {
      setError('دریافت گزارش‌ها ناموفق بود. اتصال شبکه را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <AuroraBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>گزارش‌های من</Text>
          <Pressable style={styles.refresh} onPress={load}>
            <Ionicons name="refresh" size={18} color={colors.text} />
          </Pressable>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand[300]} />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 55).duration(380)}>
              <ReportCard report={item} onPress={() => router.push(`/report/${item.id}`)} />
            </Animated.View>
          )}
          ListHeaderComponent={
            error && items.length > 0 ? (
              <View style={styles.errBanner}>
                <Ionicons name="cloud-offline-outline" size={16} color={colors.rose} />
                <Text style={styles.errText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <GlassCard style={styles.empty}>
                <Ionicons name="documents-outline" size={42} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>هنوز گزارشی ثبت نکرده‌اید</Text>
                <Text style={styles.emptyText}>
                  {error || 'اولین گزارش خود را ثبت کنید تا روند رسیدگی را اینجا دنبال کنید.'}
                </Text>
                <Button title="ثبت گزارش جدید" onPress={() => router.push('/report/new')} style={{ marginTop: 16 }} />
                {!isAuthenticated && (
                  <Button
                    title="ورود به حساب"
                    variant="ghost"
                    onPress={() => router.push('/auth/login')}
                    style={{ marginTop: 10 }}
                  />
                )}
              </GlassCard>
            ) : null
          }
        />
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8,
  },
  title: { color: colors.text, fontFamily: fonts.black, fontSize: 24 },
  refresh: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  list: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 140 },
  errBanner: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    borderWidth: 1, borderColor: colors.roseSoft, backgroundColor: colors.roseSoft,
  },
  errText: { color: colors.rose, fontFamily: fonts.semibold, fontSize: 12, textAlign: 'right', flex: 1 },
  empty: { alignItems: 'center', paddingVertical: 34, marginTop: 20 },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, marginTop: 14 },
  emptyText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 21, paddingHorizontal: 10 },
});
