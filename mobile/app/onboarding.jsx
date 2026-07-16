import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AuroraBackground } from '../src/components/ui/AuroraBackground';
import { Button } from '../src/components/ui/Button';
import { BrandMark } from '../src/components/Brand';
import { ONBOARDING_KEY } from './index';
import { colors, fonts, radius, shadow } from '../src/theme';

const SLIDES = [
  {
    icon: 'location',
    accent: [colors.brand[300], colors.brand[500]],
    iconColor: colors.onBrand,
    title: 'شهر را بهتر کن',
    text: 'مشکلات شهری را در چند ثانیه گزارش کن و در بهبود محله‌ات سهیم باش.',
  },
  {
    icon: 'camera',
    accent: [colors.brand[400], colors.brand[600]],
    iconColor: colors.onBrand,
    title: 'ثبت تصویر معتبر',
    text: 'با دوربین درون‌برنامه، عکسِ زنده و ضدجعل می‌گیری؛ بدون امکان بارگذاری از گالری.',
  },
  {
    icon: 'navigate',
    accent: [colors.civic[400], colors.civic[600]],
    iconColor: '#fff',
    title: 'موقعیت دقیق خودکار',
    text: 'مختصات دقیق از GPS دستگاه به‌صورت خودکار به گزارش پیوست می‌شود.',
  },
  {
    icon: 'notifications',
    accent: [colors.sky[400], colors.sky[600]],
    iconColor: '#fff',
    title: 'پیگیری زنده وضعیت',
    text: 'به‌محض تغییر وضعیت گزارش، اعلان دریافت می‌کنی و روند رسیدگی را دنبال می‌کنی.',
  },
];

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const [index, setIndex] = useState(0);

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    router.replace('/(tabs)');
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      finish();
    }
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width)),
    }
  );

  const isLast = index === SLIDES.length - 1;

  return (
    <AuroraBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BrandMark size={36} />
          {!isLast ? (
            <Pressable onPress={finish} hitSlop={12}>
              <Text style={styles.skip}>رد کردن</Text>
            </Pressable>
          ) : (
            <View style={{ width: 60 }} />
          )}
        </View>

        <Animated.FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: i }) => (
            <Slide item={item} width={width} index={i} scrollX={scrollX} />
          )}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => {
              const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
              // Animate scaleX (native-driver safe) instead of width.
              const scaleX = scrollX.interpolate({
                inputRange,
                outputRange: [1, 3.2, 1],
                extrapolate: 'clamp',
              });
              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.35, 1, 0.35],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View key={i} style={[styles.dot, { opacity, transform: [{ scaleX }] }]} />
              );
            })}
          </View>

          <Button
            title={isLast ? 'شروع کنیم' : 'بعدی'}
            onPress={next}
            size="lg"
            style={{ width: '100%' }}
            icon={<Ionicons name={isLast ? 'rocket' : 'arrow-back'} size={18} color={colors.onBrand} />}
          />
        </View>
      </SafeAreaView>
    </AuroraBackground>
  );
}

function Slide({ item, width, index, scrollX }) {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
  const scale = scrollX.interpolate({ inputRange, outputRange: [0.7, 1, 0.7], extrapolate: 'clamp' });
  const opacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: 'clamp' });
  const translateY = scrollX.interpolate({ inputRange, outputRange: [40, 0, 40], extrapolate: 'clamp' });

  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <LinearGradient colors={item.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.iconWrap, shadow.glow]}>
          <Ionicons name={item.icon} size={72} color={item.iconColor || '#fff'} />
        </LinearGradient>
      </Animated.View>
      <Animated.View style={{ opacity, transform: [{ translateY }] }}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.text}>{item.text}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  skip: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 15 },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 40 },
  iconWrap: {
    width: 168,
    height: 168,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontFamily: fonts.black, fontSize: 28, textAlign: 'center', marginBottom: 14 },
  text: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 16, textAlign: 'center', lineHeight: 28 },
  footer: { paddingHorizontal: 24, paddingBottom: 12, gap: 26 },
  dots: { flexDirection: 'row', alignSelf: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand[400] },
});
