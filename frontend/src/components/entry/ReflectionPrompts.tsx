import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LoadingPulse } from '../LoadingPulse';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

type Props = {
  prompts: string[];
  loading?: boolean;
  mode?: 'starter' | 'reflection';
  onSelect: (prompt: string) => void;
  onRefresh?: () => void;
  onClose?: () => void;
};

export function ReflectionPrompts({
  prompts,
  loading,
  mode = 'reflection',
  onSelect,
  onRefresh,
  onClose,
}: Props) {
  const compactLoading = loading && prompts.length === 0;

  if (!loading && prompts.length === 0) {
    return null;
  }

  const title = mode === 'starter' ? 'Zum Loslegen' : 'Zum Nachdenken';

  return (
    <View style={[styles.card, compactLoading ? styles.cardCompact : null]}>
      <View style={styles.header}>
        <Text style={styles.title}>✨ {title}</Text>
        <View style={styles.actions}>
          {onRefresh ? (
            <TouchableOpacity onPress={onRefresh} hitSlop={8}>
              <Ionicons name="refresh" size={16} color={colors.warm} />
            </TouchableOpacity>
          ) : null}
          {onClose ? (
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {loading ? (
        <LoadingPulse
          label={prompts.length > 0 ? 'Neue Impulse laden…' : 'Impuls wird vorbereitet'}
          compact
        />
      ) : null}

      <TouchableOpacity
        style={[styles.singlePrompt, loading && prompts.length > 0 ? styles.promptDimmed : null]}
        onPress={() => onSelect(prompts[0] ?? '')}
        activeOpacity={0.8}
      >
        <Text style={styles.promptText}>{prompts[0] ?? (loading ? 'Lade Vorschlag…' : 'Kein Vorschlag vorhanden')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.warmSofter,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardCompact: {
    padding: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { fontSize: 13, fontWeight: '700', color: colors.warm },
  actions: { flexDirection: 'row', gap: 14 },
  softRefreshNote: {
    marginTop: 2,
    marginBottom: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  softRefreshText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  singlePrompt: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  prompt: { paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border },
  promptDimmed: { opacity: 0.6 },
  promptText: { fontFamily: serif, fontSize: 14, lineHeight: 20, color: colors.text },
});