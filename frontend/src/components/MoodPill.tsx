/** Stimmungs-Label als farbige Pille (z. B. „Sehr gut"). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { moodColor, moodLabel, MoodLevel } from '../theme/colors';

type Props = { level: MoodLevel };

export function MoodPill({ level }: Props) {
  return (
    <View style={[styles.pill, { backgroundColor: moodColor[level] }]}>
      <Text style={styles.text}>{moodLabel[level]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  text: { fontSize: 12, color: '#fff', fontWeight: '600' },
});
