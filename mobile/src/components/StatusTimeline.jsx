import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_ORDER, STATUS_LABEL, STATUS_COLOR, statusIndex } from '../constants/status';
import { colors, fonts } from '../theme';

/** Vertical RTL timeline of the report lifecycle, highlighting reached states. */
export function StatusTimeline({ status }) {
  const current = statusIndex(status);
  return (
    <View style={styles.wrap}>
      {STATUS_ORDER.map((s, i) => {
        const reached = i <= current;
        const isCurrent = i === current;
        const color = STATUS_COLOR[s];
        return (
          <View key={s} style={styles.row}>
            <View style={styles.railCol}>
              <View
                style={[
                  styles.node,
                  reached
                    ? { backgroundColor: color, borderColor: color }
                    : { backgroundColor: 'transparent', borderColor: colors.border },
                  isCurrent && styles.nodeCurrent,
                ]}
              />
              {i < STATUS_ORDER.length - 1 && (
                <View
                  style={[
                    styles.rail,
                    { backgroundColor: i < current ? color : colors.border },
                  ]}
                />
              )}
            </View>
            <View style={styles.labelCol}>
              <Text
                style={[
                  styles.label,
                  { color: reached ? colors.text : colors.textFaint },
                  isCurrent && { fontFamily: fonts.bold },
                ]}
              >
                {STATUS_LABEL[s]}
              </Text>
              {isCurrent && <Text style={styles.now}>مرحلهٔ کنونی</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  row: { flexDirection: 'row-reverse' },
  railCol: { alignItems: 'center', width: 26 },
  node: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  nodeCurrent: { transform: [{ scale: 1.25 }] },
  rail: { width: 2, flex: 1, minHeight: 26, marginVertical: 2 },
  labelCol: { flex: 1, paddingBottom: 18, paddingRight: 10, marginTop: -2 },
  label: { fontFamily: fonts.medium, fontSize: 14, textAlign: 'right' },
  now: { color: colors.brand[300], fontFamily: fonts.semibold, fontSize: 11, textAlign: 'right', marginTop: 2 },
});
