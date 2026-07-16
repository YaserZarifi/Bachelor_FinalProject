import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors, radius, fonts, shadow } from '../../theme';

/**
 * variant: 'primary' (beacon amber) | 'emerald' (civic) | 'ghost' | 'glass'
 * Primary uses dark (ink) text on amber for accessible contrast.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon = null,
  style,
  size = 'md',
}) {
  const isGradient = variant === 'primary' || variant === 'emerald';
  const gradientColors =
    variant === 'emerald'
      ? [colors.civic[600], colors.civic[400]]
      : [colors.brand[300], colors.brand[500]];
  const solidText =
    variant === 'primary'
      ? colors.onBrand
      : variant === 'emerald'
        ? '#fff'
        : colors.text;

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={solidText} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: solidText }, size === 'lg' && styles.textLg]}>
            {title}
          </Text>
        </>
      )}
    </View>
  );

  const pad = size === 'lg' ? styles.padLg : styles.padMd;

  if (isGradient) {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          styles.base,
          variant === 'emerald' ? shadow.emerald : shadow.glow,
          { opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.975 : 1 }] },
          style,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.gradient, pad]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        pad,
        variant === 'glass' ? styles.glass : styles.ghost,
        { opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.975 : 1 }] },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, overflow: 'hidden' },
  gradient: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  padMd: { paddingVertical: 14, paddingHorizontal: 22 },
  padLg: { paddingVertical: 17, paddingHorizontal: 26 },
  content: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  text: { color: '#fff', fontFamily: fonts.bold, fontSize: 15 },
  textLg: { fontSize: 17 },
  ghost: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  glass: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
