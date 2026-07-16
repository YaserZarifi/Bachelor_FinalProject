import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_COLOR, STATUS_LABEL } from '../constants/status';
import { fonts, radius } from '../theme';

export function StatusBadge({ status, size = 'md' }) {
  const color = STATUS_COLOR[status] || '#94a3b8';
  return (
    <View
      style={[
        styles.badge,
        { borderColor: color + '66', backgroundColor: color + '22' },
        size === 'sm' && styles.sm,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }, size === 'sm' && styles.textSm]}>
        {STATUS_LABEL[status] || status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 10, paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontFamily: fonts.bold, fontSize: 13 },
  textSm: { fontSize: 11 },
});
