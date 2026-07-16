import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadow } from '../theme';

export function BrandMark({ size = 40 }) {
  return (
    <LinearGradient
      colors={[colors.brand[300], colors.brand[500]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        { width: size, height: size, borderRadius: size * 0.32 },
        styles.mark,
        shadow.glow,
      ]}
    >
      <Ionicons name="location" size={size * 0.52} color={colors.onBrand} />
    </LinearGradient>
  );
}

export function BrandLockup({ subtitle = 'سامانهٔ گزارش شهروندی' }) {
  return (
    <View style={styles.lockup}>
      <BrandMark size={44} />
      <View>
        <Text style={styles.title}>شهریاور</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  lockup: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  title: { color: colors.text, fontFamily: fonts.black, fontSize: 22, textAlign: 'right' },
  subtitle: { color: colors.textFaint, fontFamily: fonts.medium, fontSize: 12, textAlign: 'right' },
});
