/** Stimmungsauswahl per Emoji-Kreis (Eintrag schreiben). */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';

const MOODS = ['😔', '😊', '😕', '😢', '🥰'] as const;

type Props = {
  label?: string;
  value: string | null;
  onChange: (mood: string) => void;
};

export function MoodEmojiPicker({ label = 'Stimmung:', value, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {MOODS.map((mood) => {
        const active = mood === value;
        return (
          <TouchableOpacity
            key={mood}
            style={[styles.circle, active && styles.circleActive]}
            onPress={() => onChange(mood)}
            activeOpacity={0.7}
          >
            <Text style={styles.emoji}>{mood}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  label: { fontSize: 12, color: colors.textMuted, marginRight: 2 },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.warmSofter,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  circleActive: { borderColor: colors.warm },
  emoji: { fontSize: 17 },
});
