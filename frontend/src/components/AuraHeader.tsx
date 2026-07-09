/**
 * AuraHeader – ruhiger Kopfbereich auf reinem Weiß.
 * Kleines Label ("DIESE WOCHE"), großer Serifen-Titel, ruhiger Untertitel.
 * Bewusst OHNE Farbverlauf: Farbe gehört im neuen Design ausschließlich den
 * Mood-Bubbles/-Blobs, der Rahmen bleibt Weiß/Schwarz (wie HomeScreen).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { serif } from '../theme/typography';

type Props = { label?: string; title: string; subtitle?: string };

export function AuraHeader({ label, title, subtitle }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 4 }]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bg, // reines Weiß, wie der Rest des Screens
    paddingHorizontal: 20,
    paddingBottom: 22,
    marginHorizontal: -20, // randlos bis zum Bildschirmrand
    marginTop: -8, // die paddingTop des ScrollViews ausgleichen -> bis ganz oben
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
    color: '#000000',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: 4,
  },
});
