/** Rein dekorative Formatierungsleiste für den Editor (Eintrag schreiben). Ohne echte Textformatierung. */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

const ALIGN_ICONS = ['reorder-four-outline', 'reorder-three-outline', 'reorder-two-outline'] as const;
const HEADINGS = ['H1', 'H2', 'H3'] as const;
const STYLES = [
  { key: 'serif-italic', label: 'Aa', style: { fontFamily: serif, fontStyle: 'italic' as const } },
  { key: 'serif-bold', label: 'Aa', style: { fontFamily: serif, fontWeight: '700' as const } },
  { key: 'sans', label: 'Aa', style: { fontWeight: '400' as const } },
];

export function EditorToolbar() {
  const [heading, setHeading] = useState<string | null>(null);
  const [fontStyle, setFontStyle] = useState<string | null>(null);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {ALIGN_ICONS.map((name) => (
        <TouchableOpacity key={name} style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name={name} size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />

      {HEADINGS.map((h) => (
        <TouchableOpacity
          key={h}
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => setHeading((prev) => (prev === h ? null : h))}
        >
          <Text style={[styles.headingText, heading === h && styles.headingActive]}>{h}</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />

      {STYLES.map((s) => (
        <TouchableOpacity
          key={s.key}
          style={styles.iconBtn}
          activeOpacity={0.7}
          onPress={() => setFontStyle((prev) => (prev === s.key ? null : s.key))}
        >
          <Text
            style={[
              styles.fontPreview,
              s.style,
              fontStyle === s.key && styles.fontPreviewActive,
            ]}
          >
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, height: 20, backgroundColor: colors.border },
  headingText: { fontSize: 15, fontWeight: '700', color: colors.textFaint },
  headingActive: { color: colors.text },
  fontPreview: { fontSize: 16, color: colors.textFaint },
  fontPreviewActive: { color: colors.text },
});
