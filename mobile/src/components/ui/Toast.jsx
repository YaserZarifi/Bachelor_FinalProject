import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow } from '../../theme';

/** Auto-hiding glass toast pinned near the bottom. */
export function Toast({ message, onHide, duration = 3200 }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onHide?.());
    }, duration);
    return () => clearTimeout(t);
  }, [anim, duration, onHide]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });

  const Inner = (
    <View style={styles.inner}>
      <Ionicons name="notifications" size={18} color={colors.brand[300]} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );

  return (
    <Animated.View style={[styles.wrap, { opacity: anim, transform: [{ translateY }] }]} pointerEvents="none">
      {Platform.OS === 'ios' ? (
        <BlurView intensity={40} tint="dark" style={styles.card}>{Inner}</BlurView>
      ) : (
        <View style={[styles.card, { backgroundColor: 'rgba(17,24,46,0.96)' }]}>{Inner}</View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, bottom: 28, alignItems: 'center' },
  card: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, overflow: 'hidden', ...shadow.card },
  inner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 13 },
  text: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, textAlign: 'right' },
});
