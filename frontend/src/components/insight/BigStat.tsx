/**
 * BigStat – kompakte Kennzahl-Karte (Layout angelehnt an die Vorlage):
 * kleines Label in Versalien, große Serifen-Zahl. Optik wie die übrigen Karten
 * (weiß mit weichem Schatten), damit alle Kärtchen einheitlich aussehen.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

type Props = { label: string; value: string };

export function BigStat({ label, value }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  value: {
    fontFamily: serif,
    fontSize: 28,
    lineHeight: 32,
    color: colors.text,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 6,
  },
});
