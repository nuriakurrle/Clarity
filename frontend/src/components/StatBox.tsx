/** Kompakte Kennzahl (Wert + Label), z. B. „12 Einträge". */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = { value: string; label: string; highlight?: boolean };

export function StatBox({ value, label, highlight }: Props) {
  return (
    <View style={styles.box}>
      <Text style={[styles.value, highlight && { color: colors.primary }]}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
