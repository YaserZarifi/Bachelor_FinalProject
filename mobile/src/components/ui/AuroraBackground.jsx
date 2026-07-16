import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';

/** Dark civic canvas with soft signal glows (beacon + civic + sky) — the backdrop. */
export function AuroraBackground({ children, style }) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[colors.ink, colors.ink2, colors.ink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />
      <View style={[styles.blob, styles.blobMid]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.22 },
  blobTop: {
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    backgroundColor: colors.brand[500], // beacon amber
  },
  blobBottom: {
    bottom: -140,
    left: -90,
    width: 340,
    height: 340,
    backgroundColor: colors.civic[500], // emerald
    opacity: 0.18,
  },
  blobMid: {
    top: '38%',
    left: -120,
    width: 260,
    height: 260,
    backgroundColor: colors.sky[500], // sky
    opacity: 0.14,
  },
});
