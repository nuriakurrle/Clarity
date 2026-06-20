/** Generischer Umschalter (z. B. Woche / Monat / Jahr). */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const active = option === value;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onChange(option)}
            activeOpacity={0.8}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    padding: 4,
  },
  item: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  itemActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  text: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  textActive: { color: colors.text, fontWeight: '600' },
});
