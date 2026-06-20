/** Einheitlicher Seitenkopf (Titel + optionaler Untertitel) für alle Screens. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = { title: string; subtitle?: string };

export function ScreenHeader({ title, subtitle }: Props) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 30, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: 4 },
});
