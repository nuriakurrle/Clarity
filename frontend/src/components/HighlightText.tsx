/**
 * HighlightText – hebt „wichtige" Wörter in einem Fließtext fett hervor.
 *
 * Wichtig = die wiederkehrenden Themen/Personen und die häufigsten Schlagwörter
 * (Key Themes) aus den Einträgen. So werden z. B. „Familie", „Freunden",
 * „dankbar" im Tonverlauf und in den Beobachtungen betont, ohne dass man von
 * Hand markieren muss.
 *
 * Gibt inline-Fragmente zurück und ist dafür gedacht, INNERHALB eines <Text>
 * (z. B. in <Bullet text={<HighlightText …/>} />) verwendet zu werden.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors } from '../theme/colors';

type Props = { text: string; terms: string[] };

/** Wort gilt als wichtig, wenn es einen Stamm teilt (Umlaut-/Beugungs-tolerant). */
function isImportant(token: string, terms: string[]): boolean {
  const w = token.toLowerCase().replace(/[^0-9a-zäöüß]/g, '');
  if (w.length < 4) return false;
  return terms.some((t) => t.length >= 4 && (w.startsWith(t) || t.startsWith(w)));
}

export function HighlightText({ text, terms }: Props) {
  if (!terms.length) return <>{text}</>;
  // Am Whitespace splitten und die Trenner behalten, damit Abstände erhalten bleiben.
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) =>
        isImportant(part, terms) ? (
          <Text key={i} style={styles.bold}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  bold: { fontWeight: '800', color: colors.text },
});
