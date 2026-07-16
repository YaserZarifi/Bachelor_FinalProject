import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { colors, fonts, shadow } from '../../src/theme';

const TABS = [
  { name: 'index', label: 'خانه', icon: 'home', iconOutline: 'home-outline' },
  { name: 'reports', label: 'گزارش‌ها', icon: 'documents', iconOutline: 'documents-outline' },
  { name: 'profile', label: 'پروفایل', icon: 'person', iconOutline: 'person-outline' },
];

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <GlassTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="reports" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

/** One tab: an animated pill + icon that pop when the tab becomes active. */
function TabItem({ tab, isFocused, onPress }) {
  const p = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(isFocused ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, p]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: 0.72 + p.value * 0.28 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -p.value * 3 }, { scale: 1 + p.value * 0.08 }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.55 + p.value * 0.45 }));

  return (
    <Pressable style={styles.tab} onPress={onPress} hitSlop={8}>
      <Animated.View style={[styles.pill, pillStyle]} />
      <Animated.View style={iconStyle}>
        <Ionicons
          name={isFocused ? tab.icon : tab.iconOutline}
          size={23}
          color={isFocused ? colors.brand[300] : colors.textFaint}
        />
      </Animated.View>
      <Animated.Text style={[styles.label, isFocused && styles.labelActive, labelStyle]}>
        {tab.label}
      </Animated.Text>
    </Pressable>
  );
}

/** Floating action button — hovers above the tab bar (no center notch). */
function ReportFab({ bottom }) {
  const router = useRouter();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const open = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/report/new');
  };

  return (
    <Animated.View style={[styles.fabWrap, { bottom }, style]}>
      <Pressable
        onPressIn={() => (scale.value = withSpring(0.92, { damping: 14 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 12 }))}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="ثبت گزارش جدید"
      >
        <LinearGradient
          colors={[colors.brand[300], colors.brand[500]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fab, shadow.glow]}
        >
          <Ionicons name="add" size={30} color={colors.onBrand} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

function GlassTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const [barHeight, setBarHeight] = useState(62);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <ReportFab bottom={barHeight + 16} />

      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 0}
        tint="dark"
        style={styles.bar}
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.barInner}>
          {state.routes
            .filter((r) => TABS.some((t) => t.name === r.name))
            .map((route) => {
              const tab = TABS.find((t) => t.name === route.name);
              const isFocused = state.routes[state.index]?.name === route.name;
              const onPress = () => {
                Haptics.selectionAsync().catch(() => {});
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
              };
              return <TabItem key={route.key} tab={tab} isFocused={isFocused} onPress={onPress} />;
            })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  bar: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(11,18,32,0.4)' : 'rgba(14,22,42,0.94)',
    ...shadow.card,
  },
  barInner: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tab: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 64, flex: 1, paddingVertical: 6 },
  pill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 12,
    right: 12,
    borderRadius: 16,
    backgroundColor: colors.brand[500] + '20',
    borderWidth: 1,
    borderColor: colors.brand[500] + '2e',
  },
  label: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 11 },
  labelActive: { color: colors.brand[300], fontFamily: fonts.bold },
  fabWrap: { position: 'absolute', right: 4, zIndex: 20 },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.ink,
  },
});
