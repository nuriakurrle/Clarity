/**
 * Formatierungsleiste für den Editor (Eintrag schreiben).
 *
 * Steuert die Darstellung des Eintragstexts: Ausrichtung, Schriftgröße,
 * Schriftschnitt und Schriftfarbe. Die Leiste ist eine kontrollierte
 * Komponente – der Screen hält den Formatzustand (`EditorFormat`) und
 * wendet ihn auf das Text-Eingabefeld an.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

export type EditorAlign = 'left' | 'center' | 'right';
export type EditorSize = 'small' | 'medium' | 'large';
export type EditorFont = 'serif' | 'serif-italic' | 'serif-bold' | 'sans';

export type EditorFormat = {
  align: EditorAlign;
  size: EditorSize;
  font: EditorFont;
  color: string;
};

export const DEFAULT_FORMAT: EditorFormat = {
  align: 'left',
  size: 'medium',
  font: 'serif',
  color: colors.text,
};

/** Format → Style fürs Text-Eingabefeld (vom EntryScreen benutzt). */
export function formatToStyle(format: EditorFormat) {
  const size = SIZES.find((s) => s.key === format.size) ?? SIZES[1];
  const font = FONT_STYLES[format.font];
  return {
    textAlign: format.align,
    fontSize: size.fontSize,
    lineHeight: size.lineHeight,
    color: format.color,
    ...font,
  } as const;
}

const ALIGNMENTS: { key: EditorAlign; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'left', icon: 'reorder-four-outline' },
  { key: 'center', icon: 'reorder-three-outline' },
  { key: 'right', icon: 'reorder-two-outline' },
];

const SIZES: { key: EditorSize; label: string; fontSize: number; lineHeight: number }[] = [
  { key: 'small', label: 'A', fontSize: 14, lineHeight: 22 },
  { key: 'medium', label: 'A', fontSize: 16, lineHeight: 26 },
  { key: 'large', label: 'A', fontSize: 19, lineHeight: 30 },
];

const FONT_STYLES: Record<EditorFont, object> = {
  serif: { fontFamily: serif },
  'serif-italic': { fontFamily: serif, fontStyle: 'italic' as const },
  'serif-bold': { fontFamily: serif, fontWeight: '700' as const },
  sans: { fontFamily: undefined, fontWeight: '400' as const },
};

const FONTS: { key: EditorFont; label: string; style: object }[] = [
  { key: 'serif', label: 'Aa', style: FONT_STYLES.serif },
  { key: 'serif-italic', label: 'Aa', style: FONT_STYLES['serif-italic'] },
  { key: 'serif-bold', label: 'Aa', style: FONT_STYLES['serif-bold'] },
  { key: 'sans', label: 'Aa', style: FONT_STYLES.sans },
];

const TEXT_COLORS = [colors.text, colors.warm, colors.primary, colors.textMuted];

type Props = {
  value: EditorFormat;
  onChange: (next: EditorFormat) => void;
};

export function EditorToolbar({ value, onChange }: Props) {
  const set = <K extends keyof EditorFormat>(key: K, val: EditorFormat[K]) =>
    onChange({ ...value, [key]: val });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // Taps sollen die Buttons treffen, nicht erst die Tastatur schließen
      keyboardShouldPersistTaps="always"
    >
      {ALIGNMENTS.map((a) => (
        <TouchableOpacity
          key={a.key}
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => set('align', a.key)}
        >
          <Ionicons
            name={a.icon}
            size={18}
            color={value.align === a.key ? colors.text : colors.textFaint}
          />
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />

      {SIZES.map((s) => (
        <TouchableOpacity
          key={s.key}
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => set('size', s.key)}
        >
          <Text
            style={[
              styles.sizeText,
              { fontSize: 12 + SIZES.indexOf(s) * 3 },
              value.size === s.key && styles.activeText,
            ]}
          >
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />

      {FONTS.map((f) => (
        <TouchableOpacity
          key={f.key}
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => set('font', f.key)}
        >
          <Text style={[styles.fontPreview, f.style, value.font === f.key && styles.activeText]}>
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />

      {TEXT_COLORS.map((c) => (
        <TouchableOpacity
          key={c}
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => set('color', c)}
        >
          <View style={[styles.swatchRing, value.color === c && styles.swatchRingActive]}>
            <View style={[styles.swatch, { backgroundColor: c }]} />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Trennlinien/Karte übernimmt der umgebende Screen (formatPanel)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  iconBtn: { alignItems: 'center', justifyContent: 'center', minWidth: 22 },
  divider: { width: 1, height: 20, backgroundColor: colors.border },
  sizeText: { fontWeight: '700', color: colors.textFaint },
  fontPreview: { fontSize: 16, color: colors.textFaint },
  activeText: { color: colors.text },
  swatchRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchRingActive: { borderColor: colors.textFaint },
  swatch: { width: 16, height: 16, borderRadius: 8 },
});
