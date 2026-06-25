import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card } from '../Card';
import { fetchReflectionPrompts, getInstantReflectionPrompts } from '../../services/promptApi';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

export function TodaysPrompt() {
  const [prompt, setPrompt] = useState('');
  const promptCursor = useRef(0);

  useEffect(() => {
    const loadPrompt = async () => {
      const instant = getInstantReflectionPrompts('', {});
      const result = await fetchReflectionPrompts('');
      const pool = result.prompts.length > 0 ? result.prompts : instant.prompts;

      if (pool.length === 0) {
        setPrompt('Noch kein Impuls geladen.');
        return;
      }

      const next = promptCursor.current % pool.length;
      setPrompt(pool[next]);
      promptCursor.current = (next + 1) % pool.length;
    };

    void loadPrompt();
  }, []);



  return (
    <Card style={styles.card}>
      <Text numberOfLines={3} style={styles.promptText}>{prompt || 'Noch kein Impuls geladen.'}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
    marginTop: 8,
    padding: 12,
    backgroundColor: colors.warmSofter,
    borderColor: colors.warmSoft,
  },
  promptText: {
    fontFamily: serif,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
});