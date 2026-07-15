/**
 * EntryImages – Bild-Thumbnails eines Eintrags.
 *
 * Zeigt die angehängten Fotos als abgerundete Kacheln nebeneinander
 * (wie im Notiz-App-Look). Mit `onRemove` (Eintrag schreiben) trägt jede
 * Kachel ein „ד zum Entfernen; ohne (Vollansicht) ist es reine Anzeige.
 */
import React from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = {
  uris: string[];
  onRemove?: (uri: string) => void;
  /** Tippen auf die Kachel (z. B. Vollbild-Ansicht in der Eintrags-Vollansicht). */
  onPress?: (uri: string) => void;
};

export function EntryImages({ uris, onRemove, onPress }: Props) {
  if (uris.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {uris.map((uri) => (
        <View key={uri} style={styles.tile}>
          <TouchableOpacity
            onPress={onPress ? () => onPress(uri) : undefined}
            activeOpacity={onPress ? 0.8 : 1}
            disabled={!onPress}
            accessibilityLabel={onPress ? 'Bild in Vollbild öffnen' : undefined}
          >
            <Image source={{ uri }} style={styles.image} />
          </TouchableOpacity>
          {onRemove ? (
            <TouchableOpacity
              style={styles.remove}
              onPress={() => onRemove(uri)}
              hitSlop={8}
              accessibilityLabel="Bild entfernen"
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  tile: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: 110, height: 110 },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(31,36,33,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
