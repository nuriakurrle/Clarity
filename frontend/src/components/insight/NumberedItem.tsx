/** Nummerierte Zeile (z. B. Reflexionsfragen 1, 2, 3). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

type Props = { index: number; text: string };

export function NumberedItem({ index, text }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.index}>{index}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  index: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: '700',
    marginRight: 10,
    overflow: 'hidden',
  },
  text: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
});
