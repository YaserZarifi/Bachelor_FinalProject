import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { GlassCard } from './ui/GlassCard';
import { useFeedback } from '../context/FeedbackContext';
import {
  subscribeQueue,
  subscribeSyncing,
  subscribeServer,
  checkServer,
  syncQueue,
  removePending,
} from '../api/offline';
import { colors, fonts, radius } from '../theme';

/** "چند لحظه پیش" / "۳ دقیقه پیش" / "۲ ساعت پیش" / "۱ روز پیش" */
function relativeTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'همین الان';
  if (min < 60) return `${min.toLocaleString('fa-IR')} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr.toLocaleString('fa-IR')} ساعت پیش`;
  const day = Math.floor(hr / 24);
  return `${day.toLocaleString('fa-IR')} روز پیش`;
}

/**
 * Live "outbox" for reports captured while offline. Shows each queued report,
 * a real-time connection indicator, and lets the citizen delete an item or send
 * the queue now. Auto-flushes the moment connectivity returns.
 *
 * Renders nothing when the queue is empty. Call `onSynced` after a successful
 * flush so the parent can refresh its own data (e.g. the latest-report card).
 */
export function PendingQueue({ onSynced, style }) {
  const { alert, toast } = useFeedback();
  const [items, setItems] = useState([]);
  const [syncing, setSyncing] = useState(false);
  // 'checking' | 'online' | 'server-down' | 'no-network' — real API reachability.
  const [server, setServer] = useState('checking');

  useEffect(() => subscribeQueue(setItems), []);
  useEffect(() => subscribeSyncing(setSyncing), []);

  // Only probe the server (and auto-flush on reconnect) while there's something
  // queued. The controller in offline.js runs one shared poller across screens.
  const hasItems = items.length > 0;
  useEffect(() => {
    if (!hasItems) return undefined;
    return subscribeServer(setServer);
  }, [hasItems]);

  // Bridge auto-sync (triggered by the controller when the server returns) to the
  // parent: refresh its data on the falling edge of `syncing`.
  const prevSyncing = useRef(false);
  useEffect(() => {
    if (prevSyncing.current && !syncing) onSynced?.();
    prevSyncing.current = syncing;
  }, [syncing, onSynced]);

  const sendNow = useCallback(async () => {
    const status = await checkServer();
    if (status !== 'online') {
      toast('سرور در دسترس نیست؛ به‌محض اتصال ارسال می‌شود', 'warning');
      return;
    }
    const r = await syncQueue();
    if (r?.skipped) return;
    if (r?.synced) {
      toast(`${r.synced.toLocaleString('fa-IR')} گزارش ارسال شد`, 'success');
      onSynced?.();
    } else if (r?.failed) {
      toast('ارسال ناموفق بود؛ به‌محض اتصال دوباره تلاش می‌شود', 'warning');
    }
  }, [toast, onSynced]);

  const confirmDelete = useCallback(
    (item) => {
      alert({
        title: 'حذف گزارش از صف؟',
        message: 'این گزارش هنوز ارسال نشده و برای همیشه حذف می‌شود.',
        buttons: [
          { text: 'انصراف', style: 'cancel' },
          {
            text: 'حذف',
            style: 'destructive',
            onPress: async () => {
              await removePending(item.localId);
              toast('گزارش از صف حذف شد', 'info');
            },
          },
        ],
      });
    },
    [alert, toast],
  );

  if (!items.length) return null;

  const STATUS = {
    checking: { text: 'در حال بررسی اتصال به سرور…', color: colors.textFaint, dot: colors.textFaint },
    online: { text: 'متصل به سرور — آماده ارسال', color: colors.emerald, dot: colors.emerald },
    'server-down': { text: 'سرور در دسترس نیست', color: colors.rose, dot: colors.rose },
    'no-network': { text: 'آفلاین — شبکه‌ای در دسترس نیست', color: colors.textFaint, dot: colors.rose },
  };
  const status = syncing
    ? { text: 'در حال ارسال به سرور…', color: colors.amber, dot: colors.amber }
    : STATUS[server] || STATUS.checking;

  const canSendNow = server === 'online' && !syncing;

  return (
    <Animated.View entering={FadeInDown.duration(400)} layout={LinearTransition.springify()} style={style}>
      <GlassCard style={styles.card}>
        {/* Header: title + live connection state */}
        <View style={styles.header}>
          <View style={styles.headerRight}>
            <Ionicons name="cloud-upload-outline" size={18} color={colors.amber} />
            <Text style={styles.title}>
              {items.length.toLocaleString('fa-IR')} گزارش در صف ارسال
            </Text>
          </View>
          <View style={styles.statusRow}>
            {syncing ? (
              <ActivityIndicator size="small" color={colors.amber} />
            ) : (
              <View style={[styles.dot, { backgroundColor: status.dot }]} />
            )}
            <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>

        {/* Queued items */}
        <View style={styles.items}>
          {items.map((item) => (
            <Animated.View
              key={item.localId}
              layout={LinearTransition.springify()}
              exiting={FadeOut.duration(180)}
              style={styles.item}
            >
              <Pressable
                onPress={() => confirmDelete(item)}
                hitSlop={8}
                style={({ pressed }) => [styles.delBtn, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.rose} />
              </Pressable>
              <View style={styles.itemBody}>
                <Text numberOfLines={1} style={styles.itemDesc}>
                  {item.description?.trim() || 'بدون توضیح'}
                </Text>
                <View style={styles.itemMeta}>
                  <Text style={styles.itemTime}>{relativeTime(item.queuedAt)}</Text>
                  {(item.attempts || 0) > 0 && (
                    <>
                      <Text style={styles.metaDivider}>·</Text>
                      <Text style={styles.itemAttempts}>
                        {(item.attempts).toLocaleString('fa-IR')} تلاش ناموفق
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Send-now action */}
        <Pressable
          onPress={sendNow}
          disabled={!canSendNow}
          style={({ pressed }) => [
            styles.sendBtn,
            !canSendNow && styles.sendBtnDisabled,
            pressed && canSendNow && { opacity: 0.85 },
          ]}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={colors.onBrand} />
          ) : (
            <Ionicons name="send" size={16} color={canSendNow ? colors.onBrand : colors.textFaint} />
          )}
          <Text style={[styles.sendText, !canSendNow && { color: colors.textFaint }]}>
            {syncing ? 'در حال ارسال…' : 'ارسال اکنون'}
          </Text>
        </Pressable>
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, borderColor: colors.amber + '55' },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  headerRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  title: { color: colors.amber, fontFamily: fonts.semibold, fontSize: 13, textAlign: 'right' },
  statusRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.medium, fontSize: 11 },
  items: { marginTop: 12, gap: 8 },
  item: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  itemBody: { flex: 1 },
  itemDesc: { color: colors.text, fontFamily: fonts.medium, fontSize: 13, textAlign: 'right' },
  itemMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 3 },
  itemTime: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 11 },
  metaDivider: { color: colors.textFaint, fontSize: 11 },
  itemAttempts: { color: colors.rose, fontFamily: fonts.regular, fontSize: 11 },
  delBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.roseSoft,
  },
  sendBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand[400],
  },
  sendBtnDisabled: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sendText: { color: colors.onBrand, fontFamily: fonts.bold, fontSize: 14 },
});
