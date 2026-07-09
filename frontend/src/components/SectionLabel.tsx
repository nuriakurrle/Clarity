/** Kleine Versal-Überschrift für Abschnitte (z. B. „TONVERLAUF"), optional mit betontem Zusatz. */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = { text: string; emphasis?: string };

export function SectionLabel({ text, emphasis }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{text}</Text>
      {emphasis ? (
        <Text style={styles.emphasis}>
          {'  ·  '}
          {emphasis}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  // Deutlich als Abschnittsüberschrift lesbar: größer, fett, reines Schwarz –
  // passend zum Weiß/Schwarz-Schema mit Mood-Farb-Akzenten.
  text: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#000000',
    textTransform: 'uppercase',
  },
  emphasis: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textMuted,
  },
});
