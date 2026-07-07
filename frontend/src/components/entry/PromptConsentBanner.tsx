import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';

type Props = {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function PromptConsentBanner({ visible, onAccept, onDecline }: Props) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.bar}>
      <Text style={styles.text}>Magst du einen kleinen Impuls zum Weiterschreiben?</Text>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onDecline} hitSlop={6}>
          <Text style={styles.decline}>Nein</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={onAccept} activeOpacity={0.8}>
          <Text style={styles.acceptText}>Ja, gern</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.warmSofter,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  text: { flex: 1, fontSize: 13, color: colors.text },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  decline: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  acceptBtn: {
    backgroundColor: colors.warm,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  acceptText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});