/** Einzelner Journal-Eintrag (Uhrzeit + Text); antippbar, wenn `onPress` gesetzt ist. */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = { time: string; text: string; onPress?: () => void };

export function EntryCard({ time, text, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.headerRow}>
        <Text style={styles.time}>{time}</Text>
        {onPress ? (
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        ) : null}
      </View>
      <Text style={styles.text}>{text}</Text>
    </TouchableOpacity>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Neutral statt Alt-Grün: Uhrzeit gehört zum Weiß/Schwarz-Schema
  time: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  text: { fontSize: 15, color: colors.text, marginTop: 4, lineHeight: 21 },
});
