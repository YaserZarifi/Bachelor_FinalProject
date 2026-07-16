import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from './ui/GlassCard';
import { StatusBadge } from './StatusBadge';
import { mediaUrl } from '../api/client';
import { colors, fonts, radius } from '../theme';

function faDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('fa-IR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function ReportCard({ report, onPress }) {
  const img = mediaUrl(report.image_before);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <GlassCard padded={false} style={styles.card}>
        <View style={styles.row}>
          {img ? (
            <Image source={{ uri: img }} style={styles.thumb} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty]}>
              <Ionicons name="image-outline" size={26} color={colors.textFaint} />
            </View>
          )}
          <View style={styles.body}>
            <View style={styles.topRow}>
              <StatusBadge status={report.status} size="sm" />
              {report.is_urgent ? (
                <View style={styles.urgent}>
                  <Ionicons name="warning" size={12} color={colors.rose} />
                  <Text style={styles.urgentText}>فوری</Text>
                </View>
              ) : null}
            </View>
            <Text numberOfLines={2} style={styles.desc}>
              {report.description || 'بدون توضیح'}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>#{report.id}</Text>
              {report.category_name ? (
                <Text style={styles.meta}>• {report.category_name}</Text>
              ) : null}
              <Text style={styles.meta}>• {faDate(report.created_at)}</Text>
            </View>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: 'row-reverse', padding: 12, gap: 12 },
  thumb: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.surface },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  desc: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, textAlign: 'right', marginTop: 6, lineHeight: 21 },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  meta: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 11 },
  urgent: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  urgentText: { color: colors.rose, fontFamily: fonts.bold, fontSize: 11 },
});
