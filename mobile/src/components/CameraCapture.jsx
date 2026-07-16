import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from './ui/Button';
import { colors, fonts, radius } from '../theme';

/**
 * In-app live camera capture (gallery upload intentionally not offered — the
 * web app does the same to guarantee a fresh, anti-fraud photo).
 * Calls onCaptured({ uri }) once a photo is taken.
 */
export function CameraCapture({ photoUri, onCaptured, onRetake }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const camRef = useRef(null);

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand[300]} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={styles.permIcon}>
          <Ionicons name="camera-outline" size={40} color={colors.brand[300]} />
        </View>
        <Text style={styles.permTitle}>دسترسی به دوربین لازم است</Text>
        <Text style={styles.permText}>
          برای ثبت تصویر معتبر و ضدجعل از مشکل، به دوربین دستگاه نیاز داریم.
        </Text>
        <Button title="اجازه دسترسی" onPress={requestPermission} style={{ marginTop: 18 }} />
      </View>
    );
  }

  if (photoUri) {
    return (
      <View style={styles.previewWrap}>
        <Image source={{ uri: photoUri }} style={styles.preview} contentFit="cover" />
        <Pressable style={styles.retake} onPress={onRetake}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.retakeText}>عکس مجدد</Text>
        </Pressable>
        <View style={styles.okBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.emerald} />
          <Text style={styles.okText}>تصویر ثبت شد</Text>
        </View>
      </View>
    );
  }

  const take = async () => {
    if (!camRef.current || busy || !ready) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      onCaptured({ uri: photo.uri });
    } catch {
      // ignore; user can retry
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        ref={camRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setReady(true)}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={styles.hintWrap} pointerEvents="none">
        <Text style={styles.hint}>
          {ready ? 'مشکل را در کادر قرار دهید' : 'در حال آماده‌سازی دوربین…'}
        </Text>
      </View>
      <View style={styles.shutterRow}>
        <Pressable
          onPress={take}
          disabled={busy || !ready}
          style={[styles.shutterOuter, !ready && { opacity: 0.4 }]}
        >
          {busy || !ready ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permIcon: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand[500] + '22' },
  permTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, marginTop: 16 },
  permText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  cameraWrap: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#000' },
  frame: {
    position: 'absolute', top: 24, left: 24, right: 24, bottom: 110,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderRadius: radius.lg, borderStyle: 'dashed',
  },
  hintWrap: { position: 'absolute', top: 36, left: 0, right: 0, alignItems: 'center' },
  hint: { color: '#fff', fontFamily: fonts.semibold, fontSize: 13, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  shutterRow: { position: 'absolute', bottom: 28, left: 0, right: 0, alignItems: 'center' },
  shutterOuter: {
    width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)',
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  previewWrap: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#000' },
  preview: { ...StyleSheet.absoluteFillObject },
  retake: {
    position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
  },
  retakeText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 13 },
  okBadge: {
    position: 'absolute', top: 14, right: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  okText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 12 },
});
