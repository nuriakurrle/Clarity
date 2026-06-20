/** Pfirsich-Pille mit Zähler-Präfix (z. B. „5× Arbeit"). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

type Props = { count: number; label: string };

export function CountPill({ count, label }: Props) {
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>
        <Text style={styles.count}>{count}×</Text> {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.warmSoft,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  text: { fontSize: 13, color: colors.text, fontWeight: '500' },
  count: { fontWeight: '700' },
});
