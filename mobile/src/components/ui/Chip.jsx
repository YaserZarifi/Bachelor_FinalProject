import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fonts, radius } from '../../theme';

export function Chip({ label, color = '#f9b526', icon = null, style }) {
  return (
    <View style={[styles.chip, { borderColor: color + '55', backgroundColor: color + '1f' }, style]}>
      {icon}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: { fontFamily: fonts.bold, fontSize: 12 },
});
