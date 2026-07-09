/** Neutrales Suchfeld mit Lupe + Clear-Button (Verlauf-Screen). */
import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChangeText, placeholder = 'Suchen' }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={18} color={colors.text} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={() => onChangeText('')} activeOpacity={0.7}>
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: { flex: 1, fontSize: 15, color: colors.text },
});
