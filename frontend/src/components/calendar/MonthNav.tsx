/** Monats-Navigation: ‹ Label › */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';

type Props = { label: string; onPrev: () => void; onNext: () => void };

export function MonthNav({ label, onPrev, onNext }: Props) {
  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.btn} onPress={onPrev} activeOpacity={0.7}>
        <Text style={styles.btnText}>‹</Text>
      </TouchableOpacity>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.btn} onPress={onNext} activeOpacity={0.7}>
        <Text style={styles.btnText}>›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 22, color: colors.text, marginTop: -2 },
  label: { fontSize: 18, fontWeight: '700', color: colors.text },
});
