/**
 * Zitat-Box (z. B. Tonverlauf, Reflexionsfrage) mit optionalem Footer/CTA.
 *
 * Stil folgt dem Weiß/Schwarz-Schema der App: weiße Fläche mit dezenter
 * Rahmenlinie; optional ein sehr zarter Tint (~5 %) der dominanten
 * Wochen-Mood-Farbe als Akzent – beide Boxen auf dem Screen nutzen damit
 * dasselbe System statt zweier beliebiger Farbtöne.
 * Optional tippt der Text sich per Typewriter-Effekt ein (TypewriterText).
 */
import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';
import { TypewriterText } from './TypewriterText';

type Props = {
  text: string;
  /** Mood-Farbe der Woche; wird als ~5 %-Tint hinterlegt. Ohne: reines Weiß. */
  accentColor?: string;
  /** Typewriter-Steuerung: undefined = statisch, sonst Start bei erstem true. */
  typingActive?: boolean;
  footer?: string;
  onPressFooter?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function QuoteBlock({ text, accentColor, typingActive, footer, onPressFooter, style }: Props) {
  const quoted = `„${text}“`;
  return (
    <View
      style={[
        styles.box,
        // 8-stelliger Hex: ~5 % Alpha der Akzentfarbe als hauchzarter Tint.
        accentColor ? { backgroundColor: `${accentColor}0D` } : null,
        style,
      ]}
    >
      {typingActive === undefined ? (
        <Text style={styles.text}>{quoted}</Text>
      ) : (
        <TypewriterText text={quoted} active={typingActive} style={styles.text} />
      )}
      {footer ? (
        <TouchableOpacity
          disabled={!onPressFooter}
          onPress={onPressFooter}
          activeOpacity={0.7}
          style={styles.footerRow}
        >
          <Text style={styles.footer}>
            {footer} →
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  footerRow: { marginTop: 12 },
  footer: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
});
