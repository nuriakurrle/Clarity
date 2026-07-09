/** Einzelner Journal-Eintrag (Uhrzeit + Text). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

type Props = { time: string; text: string };

export function EntryCard({ time, text }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  // Neutral statt Alt-Grün: Uhrzeit gehört zum Weiß/Schwarz-Schema
  time: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  text: { fontSize: 15, color: colors.text, marginTop: 4, lineHeight: 21 },
});
