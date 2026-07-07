import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';

type Props = {
  topics: string[];
  blocked: string[];
  onToggle: (topic: string) => void;
  autoSuggest: boolean;
  onAutoSuggestChange: (value: boolean) => void;
  useSentimentAgent: boolean;
  onUseSentimentAgentChange: (value: boolean) => void;
};

export function TopicFilter({
  topics,
  blocked,
  onToggle,
  autoSuggest,
  onAutoSuggestChange,
  useSentimentAgent,
  onUseSentimentAgentChange,
}: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Worüber darf nachgefragt werden?</Text>
      <View style={styles.chips}>
        {topics.map((topic) => {
          const off = blocked.includes(topic);
          return (
            <TouchableOpacity
              key={topic}
              style={[styles.chip, off && styles.chipOff]}
              onPress={() => onToggle(topic)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, off && styles.chipTextOff]}>
                {off ? '✕ ' : ''}
                {topic}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Impulse bei Schreibpause</Text>
        <Switch
          value={autoSuggest}
          onValueChange={onAutoSuggestChange}
          trackColor={{ true: colors.warm }}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Echtes Sentiment nutzen</Text>
        <Switch
          value={useSentimentAgent}
          onValueChange={onUseSentimentAgentChange}
          trackColor={{ true: colors.primary }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.warmSofter,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipOff: { backgroundColor: 'transparent', borderColor: colors.border },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  chipTextOff: { color: colors.textMuted, textDecorationLine: 'line-through' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  rowLabel: { fontSize: 13, color: colors.text },
});