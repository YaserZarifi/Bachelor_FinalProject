import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';

import { AuroraBackground } from '../../src/components/ui/AuroraBackground';
import { GlassCard } from '../../src/components/ui/GlassCard';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { CameraCapture } from '../../src/components/CameraCapture';
import { useLocation } from '../../src/hooks/useLocation';
import { computeCaptureHash } from '../../src/api/integrity';
import { fetchCategories, createReport } from '../../src/api/reports';
import { enqueueReport } from '../../src/api/offline';
import { rememberGuestReport } from '../../src/api/guestStore';
import { subscribeGuestReport } from '../../src/notifications/pushManager';
import { useAuth } from '../../src/context/AuthContext';
import { colors, fonts, radius } from '../../src/theme';

const STEPS = ['ثبت تصویر', 'جزئیات', 'بازبینی'];

export default function NewReport() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { request: requestLocation } = useLocation();

  const [step, setStep] = useState(0);
  const [photoUri, setPhotoUri] = useState(null);
  const [geo, setGeo] = useState(null); // { lat, lng, accuracy, at }
  const [hash, setHash] = useState(null);
  const [acquiring, setAcquiring] = useState(false);
  const [geoError, setGeoError] = useState(null);

  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // After a photo is taken, immediately lock GPS + compute the integrity hash.
  const onCaptured = async ({ uri }) => {
    setPhotoUri(uri);
    setAcquiring(true);
    setGeoError(null);
    try {
      const loc = await requestLocation();
      setGeo(loc);
      const h = await computeCaptureHash(uri, {
        lat: loc.lat,
        lng: loc.lng,
        capturedAt: loc.at,
        accuracy: loc.accuracy,
      });
      setHash(h);
    } catch (e) {
      setGeoError(e?.message || 'دریافت موقعیت ناموفق بود.');
    } finally {
      setAcquiring(false);
    }
  };

  const retake = () => {
    setPhotoUri(null);
    setGeo(null);
    setHash(null);
    setGeoError(null);
  };

  const canNextFromCapture = !!photoUri && !!geo && !acquiring;

  const buildItem = () => ({
    description: description.trim(),
    category,
    lat: geo.lat,
    lng: geo.lng,
    accuracy: geo.accuracy,
    capturedAt: geo.at,
    integrityHash: hash,
    imageUri: photoUri,
  });

  const submit = async () => {
    if (!geo || !photoUri) return;
    setSubmitting(true);
    const item = buildItem();
    const net = await NetInfo.fetch();

    if (!net.isConnected) {
      await enqueueReport(item);
      setSubmitting(false);
      Alert.alert(
        'ذخیره آفلاین',
        'گزارش شما ذخیره شد و به‌محض اتصال به اینترنت به‌صورت خودکار ارسال می‌شود.',
        [{ text: 'باشه', onPress: () => router.replace('/(tabs)/reports') }]
      );
      return;
    }

    try {
      const report = await createReport(item);
      if (report?.guest_access_token) {
        await rememberGuestReport({
          id: report.id,
          token: report.guest_access_token,
          description: item.description,
          status: report.status || 'SUBMITTED',
        });
        await subscribeGuestReport(report.id, report.guest_access_token);
      }
      setSubmitting(false);
      router.replace(`/report/${report.id}`);
    } catch (e) {
      // Network/server error → fall back to the offline queue.
      await enqueueReport(item);
      setSubmitting(false);
      Alert.alert(
        'ارسال ناموفق',
        'گزارش در صف ارسال قرار گرفت و بعداً دوباره تلاش می‌شود.',
        [{ text: 'باشه', onPress: () => router.replace('/(tabs)/reports') }]
      );
    }
  };

  return (
    <AuroraBackground>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => (step === 0 ? router.back() : setStep(step - 1))} hitSlop={10} style={styles.iconBtn}>
            <Ionicons name={step === 0 ? 'close' : 'arrow-forward'} size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{STEPS[step]}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Stepper */}
        <View style={styles.stepper}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.stepBar, { backgroundColor: i <= step ? colors.brand[400] : colors.border }]} />
          ))}
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {step === 0 && (
            <View style={styles.captureStep}>
              <CameraCapture photoUri={photoUri} onCaptured={onCaptured} onRetake={retake} />
              {photoUri && (
                <GlassCard style={styles.geoCard}>
                  {acquiring ? (
                    <View style={styles.geoRow}>
                      <ActivityIndicator color={colors.brand[300]} />
                      <Text style={styles.geoText}>در حال دریافت موقعیت دقیق…</Text>
                    </View>
                  ) : geoError ? (
                    <View style={styles.geoRow}>
                      <Ionicons name="warning" size={18} color={colors.rose} />
                      <Text style={[styles.geoText, { color: colors.rose, flex: 1 }]}>{geoError}</Text>
                      <Pressable onPress={() => onCaptured({ uri: photoUri })}>
                        <Text style={styles.retryLink}>تلاش مجدد</Text>
                      </Pressable>
                    </View>
                  ) : geo ? (
                    <View style={styles.geoRow}>
                      <Ionicons name="location" size={18} color={colors.emerald} />
                      <Text style={styles.geoText}>موقعیت ثبت شد</Text>
                      <Chip label={`دقت ${Math.round(geo.accuracy)} متر`} color={colors.emerald} />
                    </View>
                  ) : null}
                </GlassCard>
              )}
              <Button
                title="ادامه"
                onPress={() => setStep(1)}
                disabled={!canNextFromCapture}
                size="lg"
                style={{ marginTop: 12 }}
                icon={<Ionicons name="arrow-back" size={18} color={colors.onBrand} />}
              />
            </View>
          )}

          {step === 1 && (
            <ScrollView contentContainerStyle={styles.detailsStep} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>دستهٔ مشکل</Text>
              <Text style={styles.hint}>اختیاری — در صورت عدم انتخاب، هوش مصنوعی پیشنهاد می‌دهد.</Text>
              <View style={styles.catWrap}>
                {categories.map((c) => {
                  const active = category === c.id;
                  return (
                    <Pressable key={c.id} onPress={() => setCategory(active ? null : c.id)}>
                      <View style={[styles.cat, active && styles.catActive]}>
                        <Text style={[styles.catText, active && styles.catTextActive]}>{c.name}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {categories.length === 0 && <Text style={styles.hint}>دسته‌ای در دسترس نیست.</Text>}
              </View>

              <Text style={[styles.label, { marginTop: 22 }]}>توضیحات</Text>
              <View style={styles.textareaWrap}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="مشکل را کوتاه و دقیق توضیح دهید…"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  textAlign="right"
                  style={styles.textarea}
                />
              </View>

              <Button
                title="بازبینی نهایی"
                onPress={() => setStep(2)}
                disabled={description.trim().length < 3}
                size="lg"
                style={{ marginTop: 24 }}
                icon={<Ionicons name="arrow-back" size={18} color={colors.onBrand} />}
              />
            </ScrollView>
          )}

          {step === 2 && (
            <ScrollView contentContainerStyle={styles.detailsStep} showsVerticalScrollIndicator={false}>
              <GlassCard padded={false} style={{ overflow: 'hidden' }}>
                {photoUri && <Image source={{ uri: photoUri }} style={styles.reviewImg} contentFit="cover" />}
                <View style={{ padding: 16 }}>
                  <Text style={styles.reviewDesc}>{description.trim()}</Text>
                  <View style={styles.reviewMeta}>
                    {category && (
                      <Chip label={categories.find((c) => c.id === category)?.name || ''} color={colors.brand[300]} />
                    )}
                    {geo && <Chip label={`دقت ${Math.round(geo.accuracy)} متر`} color={colors.emerald} />}
                  </View>
                </View>
              </GlassCard>

              <GlassCard style={{ marginTop: 14 }}>
                <View style={styles.integrityRow}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.emerald} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.integrityTitle}>بستهٔ ضدجعل آماده است</Text>
                    <Text style={styles.integrityText}>
                      تصویر، موقعیت و زمان با اثرانگشت یکپارچگی به‌هم گره خورده‌اند.
                    </Text>
                  </View>
                </View>
              </GlassCard>

              {!isAuthenticated && (
                <Text style={styles.guestNote}>
                  به‌صورت مهمان ارسال می‌کنید؛ این گزارش روی همین دستگاه قابل پیگیری خواهد بود.
                </Text>
              )}

              <Button
                title="ارسال گزارش"
                onPress={submit}
                loading={submitting}
                variant="emerald"
                size="lg"
                style={{ marginTop: 20 }}
                icon={<Ionicons name="send" size={18} color="#fff" />}
              />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  headerTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17 },
  stepper: { flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 16, marginTop: 14 },
  stepBar: { flex: 1, height: 4, borderRadius: 2 },
  captureStep: { flex: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  geoCard: { marginTop: 12 },
  geoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  geoText: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  retryLink: { color: colors.brand[300], fontFamily: fonts.bold, fontSize: 13 },
  detailsStep: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },
  label: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
  hint: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12, textAlign: 'right', marginTop: 4 },
  catWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  cat: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  catActive: { borderColor: colors.brand[400], backgroundColor: colors.brand[500] + '33' },
  catText: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 13 },
  catTextActive: { color: colors.brand[200] },
  textareaWrap: { marginTop: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  textarea: { minHeight: 130, padding: 16, color: colors.text, fontFamily: fonts.regular, fontSize: 15, textAlignVertical: 'top', writingDirection: 'rtl', lineHeight: 24 },
  reviewImg: { width: '100%', height: 200 },
  reviewDesc: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, textAlign: 'right', lineHeight: 24 },
  reviewMeta: { flexDirection: 'row-reverse', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  integrityRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  integrityTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, textAlign: 'right' },
  integrityText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'right', marginTop: 3, lineHeight: 19 },
  guestNote: { color: colors.textFaint, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 16, lineHeight: 20 },
});
