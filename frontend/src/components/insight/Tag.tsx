/** Themen-Chip mit optionalem Zähler (z. B. „Arbeit & Stress  5"). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

type Props = { label: string; count?: number };

export function Tag({ label, count }: Props) {
  return (
    <View style={styles.tag}>
      <Text style={styles.text}>{label}</Text>
      {count != null ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Neutral statt Alt-Grün: weiße Chips mit dezenter Rahmenlinie,
  // passend zum Weiß/Schwarz-Schema (Farbe bleibt den Mood-Elementen).
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  text: { fontSize: 13, color: colors.text, fontWeight: '500' },
  badge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
});
