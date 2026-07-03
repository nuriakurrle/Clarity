/**
 * Stimmungsauswahl für den Eintrag (Eintrag schreiben).
 *
 * Fünf Icons entlang der App-Stimmungsskala (Schwer → Sehr gut), passend
 * zur Valence-Skala des Sentiment-Agenten. Die Auswahl ist optional und
 * wird beim Speichern als Zusatz-Kontext an die Analyse übergeben.
 * Erneutes Antippen hebt die Auswahl wieder auf.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, moodColor, moodLabel, MoodLevel } from '../../theme/colors';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Reihenfolge: negativ → positiv (wie eine Skala von links nach rechts)
const MOODS: { level: MoodLevel; icon: IconName; iconActive: IconName }[] = [
  { level: 'bad', icon: 'emoticon-cry-outline', iconActive: 'emoticon-cry' },
  { level: 'low', icon: 'emoticon-sad-outline', iconActive: 'emoticon-sad' },
  { level: 'neutral', icon: 'emoticon-neutral-outline', iconActive: 'emoticon-neutral' },
  { level: 'good', icon: 'emoticon-happy-outline', iconActive: 'emoticon-happy' },
  { level: 'great', icon: 'emoticon-excited-outline', iconActive: 'emoticon-excited' },
];

type Props = {
  label?: string;
  value: MoodLevel | null;
  onChange: (mood: MoodLevel | null) => void;
};

export function MoodPicker({ label = 'Stimmung:', value, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {MOODS.map(({ level, icon, iconActive }) => {
        const active = level === value;
        return (
          <TouchableOpacity
            key={level}
            style={[styles.circle, active && { borderColor: moodColor[level] }]}
            onPress={() => onChange(active ? null : level)}
            activeOpacity={0.7}
            accessibilityLabel={`Stimmung: ${moodLabel[level]}`}
          >
            <MaterialCommunityIcons
              name={active ? iconActive : icon}
              size={20}
              color={active ? moodColor[level] : colors.textMuted}
            />
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.warmSofter,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
