import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { AuroraBackground } from '../../src/components/ui/AuroraBackground';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { Button } from '../../src/components/ui/Button';
import { StatusBadge } from '../../src/components/StatusBadge';
import { StatusTimeline } from '../../src/components/StatusTimeline';
import { Chip } from '../../src/components/ui/Chip';
import { Toast } from '../../src/components/ui/Toast';
import { fetchReport } from '../../src/api/reports';
import { mediaUrl } from '../../src/api/client';
import { getGuestToken, updateGuestStatus } from '../../src/api/guestStore';
import { useReportSocket } from '../../src/hooks/useReportSocket';
import { STATUS_LABEL } from '../../src/constants/status';
import { colors, fonts, radius } from '../../src/theme';

export default function ReportDetail() {
  const { id } = useLocalSearchParams();
  const reportId = Number(id);
  const router = useRouter();

  const [report, setReport] = useState(null);
  const [guestToken, setGuestToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getGuestToken(reportId);
      setGuestToken(token);
      const data = await fetchReport(reportId, token);
      setReport(data);
    } catch (e) {
      setError('دریافت گزارش ناموفق بود. ممکن است دسترسی نداشته باشید.');
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => { load(); }, [load]);

  // Live updates: refresh on each status change, notify the user in-app.
  const onSocketUpdate = useCallback(
    async (data) => {
      // Only overwrite is_urgent when the frame actually carries it, so a
      // status-only event can't wipe a previously-true urgent flag.
      setReport((prev) =>
        prev
          ? { ...prev, status: data.status, is_urgent: data.is_urgent ?? prev.is_urgent }
          : prev
      );
      await updateGuestStatus(reportId, data.status);
      const label = STATUS_LABEL[data.status] || data.status;
      // In-app toast only (no OS banner while the screen is open).
      setToast(`وضعیت به‌روز شد: ${label}`);
    },
    [reportId]
  );

  const { live } = useReportSocket(reportId, guestToken, onSocketUpdate);

  if (loading) {
    return (
      <AuroraBackground>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator color={colors.brand[300]} />
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  if (error || !report) {
    return (
      <AuroraBackground>
        <SafeAreaView style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textFaint} />
          <Text style={styles.errText}>{error || 'گزارش یافت نشد.'}</Text>
          <Button title="بازگشت" variant="ghost" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </SafeAreaView>
      </AuroraBackground>
    );
  }

  const before = mediaUrl(report.image_before);
  const after = mediaUrl(report.image_after);

  return (
    <AuroraBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>گزارش #{reportId}</Text>
          <View style={styles.liveWrap}>
            {live && (
              <>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>زنده</Text>
              </>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {before && (
            <Image source={{ uri: before }} style={styles.hero} contentFit="cover" transition={250} />
          )}

          <View style={styles.statusRow}>
            <StatusBadge status={report.status} />
            {report.is_urgent ? <Chip label="فوری" color={colors.rose} icon={<Ionicons name="warning" size={12} color={colors.rose} />} /> : null}
          </View>

          <GlassCard style={{ marginTop: 14 }}>
            <Text style={styles.cardLabel}>توضیحات</Text>
            <Text style={styles.desc}>{report.description || 'بدون توضیح'}</Text>
            <View style={styles.metaGrid}>
              {report.category_name ? <Meta icon="pricetag" label="دسته" value={report.category_name} /> : null}
              {report.gps_accuracy != null ? <Meta icon="locate" label="دقت موقعیت" value={`${Math.round(report.gps_accuracy)} متر`} /> : null}
              <Meta icon="calendar" label="تاریخ ثبت" value={faDate(report.created_at)} />
            </View>
          </GlassCard>

          {report.nlp_sentiment ? (
            <GlassCard style={{ marginTop: 14 }}>
              <Text style={styles.cardLabel}>تحلیل هوشمند</Text>
              <View style={styles.metaGrid}>
                <Meta icon="sparkles" label="احساس متن" value={report.nlp_sentiment} />
              </View>
            </GlassCard>
          ) : null}

          <GlassCard style={{ marginTop: 14 }}>
            <Text style={styles.cardLabel}>روند رسیدگی</Text>
            <StatusTimeline status={report.status} />
          </GlassCard>

          {after && (
            <GlassCard style={{ marginTop: 14 }}>
              <Text style={styles.cardLabel}>تصویر پس از رسیدگی</Text>
              <Image source={{ uri: after }} style={styles.afterImg} contentFit="cover" transition={250} />
            </GlassCard>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {toast && (
          <Toast
            message={toast}
            iconName="checkmark-circle"
            iconColor={colors.civic[400]}
            onHide={() => setToast(null)}
          />
        )}
      </SafeAreaView>
    </AuroraBackground>
  );
}

function Meta({ icon, label, value }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={15} color={colors.brand[300]} />
      <Text style={styles.metaLabel}>{label}:</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function faDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '—';
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14, textAlign: 'center', marginTop: 12 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  headerTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  liveWrap: { width: 56, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', gap: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.emerald },
  liveText: { color: colors.emerald, fontFamily: fonts.bold, fontSize: 12 },
  scroll: { paddingHorizontal: 16, paddingTop: 6 },
  hero: { width: '100%', height: 230, borderRadius: radius.xl, backgroundColor: colors.surface },
  statusRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 16 },
  cardLabel: { color: colors.textFaint, fontFamily: fonts.semibold, fontSize: 12, textAlign: 'right', marginBottom: 10 },
  desc: { color: colors.text, fontFamily: fonts.medium, fontSize: 15, textAlign: 'right', lineHeight: 25 },
  metaGrid: { marginTop: 14, gap: 10 },
  meta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  metaLabel: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 13 },
  metaValue: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13 },
  afterImg: { width: '100%', height: 200, borderRadius: radius.lg, marginTop: 4 },
});
