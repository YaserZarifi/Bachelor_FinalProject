import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

function GlassTabBar({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const openReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push('/report/new');
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {/* Center floating report button */}
      <Pressable onPress={openReport} style={styles.fabWrap}>
        <LinearGradient
          colors={[colors.brand[300], colors.brand[500]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fab, shadow.glow]}
        >
          <Ionicons name="add" size={32} color={colors.onBrand} />
        </LinearGradient>
        <Text style={styles.fabLabel}>ثبت گزارش</Text>
      </Pressable>

      <BlurView intensity={Platform.OS === 'ios' ? 40 : 0} tint="dark" style={styles.bar}>
        <View style={styles.barInner}>
          {state.routes
            .filter((r) => TABS.some((t) => t.name === r.name))
            .map((route) => {
              const tab = TABS.find((t) => t.name === route.name);
              const isFocused = state.routes[state.index]?.name === route.name;
              const onPress = () => {
                Haptics.selectionAsync().catch(() => {});
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
              };
              return (
                <Pressable key={route.key} style={styles.tab} onPress={onPress} hitSlop={8}>
                  <Ionicons
                    name={isFocused ? tab.icon : tab.iconOutline}
                    size={23}
                    color={isFocused ? colors.brand[300] : colors.textFaint}
                  />
                  <Text style={[styles.label, isFocused && styles.labelActive]}>{tab.label}</Text>
                </Pressable>
              );
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
    backgroundColor: Platform.OS === 'ios' ? 'rgba(10,16,36,0.4)' : 'rgba(12,18,38,0.92)',
    ...shadow.card,
  },
  barInner: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tab: { alignItems: 'center', gap: 4, minWidth: 64, flex: 1 },
  label: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 11 },
  labelActive: { color: colors.brand[300], fontFamily: fonts.bold },
  fabWrap: { position: 'absolute', top: -34, alignSelf: 'center', alignItems: 'center', zIndex: 10 },
  fab: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.ink },
  fabLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 11, marginTop: 4 },
});
