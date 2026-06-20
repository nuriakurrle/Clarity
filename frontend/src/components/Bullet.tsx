/** Aufzählungszeile mit Akzent-Punkt (z. B. Wochenrückblick-Highlights). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = { text: string };

export function Bullet({ text }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.dot} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 10,
  },
  text: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
});
