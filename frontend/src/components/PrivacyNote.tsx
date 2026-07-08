/**
 * PrivacyNote – dezente Datenschutz-Zeile ("Nur du siehst das. Lokal &
 * verschlüsselt.") mit Schloss-Icon. Wiederverwendbar über mehrere Screens.
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

type Props = { style?: StyleProp<ViewStyle> };

export function PrivacyNote({ style }: Props) {
  return (
    <View style={[styles.row, style]}>
      <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
      <Text style={styles.text}>Nur du siehst das. Lokal & verschlüsselt.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  text: { fontSize: 13, color: colors.textMuted },
});
