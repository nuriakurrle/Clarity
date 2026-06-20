/** Getönte Zitat-Box (z. B. Tonverlauf, Reflexionsfrage) mit optionalem Footer/CTA. */
import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

type Tint = 'peach' | 'sage';

type Props = {
  text: string;
  tint?: Tint;
  footer?: string;
  onPressFooter?: () => void;
  style?: StyleProp<ViewStyle>;
};

const tintBg: Record<Tint, string> = {
  peach: colors.warmSofter,
  sage: colors.warmSage,
};

export function QuoteBlock({ text, tint = 'peach', footer, onPressFooter, style }: Props) {
  return (
    <View style={[styles.box, { backgroundColor: tintBg[tint] }, style]}>
      <Text style={styles.text}>“{text}”</Text>
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
  box: { borderRadius: 16, padding: 16 },
  text: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  footerRow: { marginTop: 12 },
  footer: { fontSize: 13, fontWeight: '600', color: colors.warm },
});
