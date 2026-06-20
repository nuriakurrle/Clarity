/** Legende aller Stimmungsstufen (Punkt + Label). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { moodLabel, MoodLevel } from '../../theme/colors';
import { MoodDot } from './MoodDot';

export function MoodLegend() {
  const levels = Object.keys(moodLabel) as MoodLevel[];
  return (
    <View style={styles.legend}>
      {levels.map((level) => (
        <View key={level} style={styles.item}>
          <View style={styles.dot}>
            <MoodDot level={level} size={8} />
          </View>
          <Text style={styles.text}>{moodLabel[level]}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 4 },
  item: { flexDirection: 'row', alignItems: 'center' },
  dot: { marginRight: 6 },
  text: { fontSize: 12, color: '#6B7B73' },
});
