import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius, shadow } from '../../theme';

/** Frosted-glass surface. Uses BlurView on iOS; a translucent fill elsewhere. */
export function GlassCard({ children, style, intensity = 30, padded = true }) {
  const inner = (
    <View style={[styles.inner, padded && styles.padded]}>{children}</View>
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} tint="dark" style={[styles.card, style]}>
        {inner}
      </BlurView>
    );
  }
  return <View style={[styles.card, styles.androidFill, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.card,
  },
  androidFill: { backgroundColor: 'rgba(17,24,46,0.72)' },
  inner: { borderRadius: radius.xl },
  padded: { padding: 18 },
});
