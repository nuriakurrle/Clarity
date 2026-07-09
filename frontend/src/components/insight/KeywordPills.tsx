/**
 * KeywordPills – „Key Themes" als farbige Schlagwort-Pillen.
 *
 * Zeigt die meistgenutzten Wörter aus den Einträgen (Pattern-Agent /keywords).
 * Jede Pille ist nach der durchschnittlichen Stimmung des Wortes eingefärbt:
 * grün = eher positiv, bernstein = neutral, rot = eher belastend.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { keywordTone } from '../../theme/colors';
import type { KeywordItem } from '../../services/api';

type Props = { items: KeywordItem[] };

/** Erstes Zeichen groß (Backend liefert klein: „arbeit" → „Arbeit"). */
const capitalize = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

export function KeywordPills({ items }: Props) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const tone = keywordTone(item.valence);
        return (
          <View key={item.word} style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.text, { color: tone.fg }]}>{capitalize(item.word)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  text: { fontSize: 14, fontWeight: '600' },
});
