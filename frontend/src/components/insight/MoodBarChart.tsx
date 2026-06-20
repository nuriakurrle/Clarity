/** Balkendiagramm für den Stimmungsverlauf (ein Balken pro Tag). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, moodColor, MoodLevel } from '../../theme/colors';

export type MoodBar = { label: string; level: MoodLevel; value: number };

type Props = { data: MoodBar[] };

export function MoodBarChart({ data }: Props) {
  return (
    <View style={styles.row}>
      {data.map((d) => (
        <View key={d.label} style={styles.col}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  height: `${Math.round(Math.max(0, Math.min(1, d.value)) * 100)}%`,
                  backgroundColor: moodColor[d.level],
                },
              ]}
            />
          </View>
          <Text style={styles.label}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
  },
  col: { flex: 1, alignItems: 'center' },
  track: {
    width: 18,
    height: 110,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 9,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  fill: { width: '100%', borderRadius: 9 },
  label: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
});
