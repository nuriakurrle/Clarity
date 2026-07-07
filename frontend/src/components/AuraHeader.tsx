/**
 * AuraHeader – weicher, warmer Kopfbereich mit Aura-Farbverlauf.
 * Kleines Label ("DIESE WOCHE"), großer Serifen-Titel, ruhiger Untertitel.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/colors';
import { serif } from '../theme/typography';

type Props = { label?: string; title: string; subtitle?: string };

export function AuraHeader({ label, title, subtitle }: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[colors.warmSoft, colors.primarySoft, colors.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    marginHorizontal: -20, // randlos bis zum Bildschirmrand
    marginTop: -8,
    paddingLeft: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: serif,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: 4,
  },
});
