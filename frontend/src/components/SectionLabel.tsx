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
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.warm,
    textTransform: 'uppercase',
  },
  emphasis: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.warm,
  },
});
