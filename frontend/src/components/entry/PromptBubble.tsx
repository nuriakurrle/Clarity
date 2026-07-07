import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

type Props = {
  suggestion?: string;
  visible: boolean;
  iconOnly?: boolean;
  onRequestPreview?: () => void;
};

export function PromptBubble({ suggestion = '', visible, onRequestPreview, iconOnly = false }: Props) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const tipOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [visible, opacity]);

  // show transient preview tooltip whenever suggestion changes
  useEffect(() => {
    if (!suggestion) return;
    tipOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(tipOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(4200),
      Animated.timing(tipOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [suggestion, tipOpacity]);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents={'auto'} style={[styles.container, { opacity: opacity }]}> 
      <Animated.View style={[styles.previewTip, { opacity: tipOpacity }]} pointerEvents="none">
        {suggestion && <Text numberOfLines={2} ellipsizeMode="tail" style={styles.previewText}>{suggestion}</Text>}
      </Animated.View>
      <Pressable onPress={() => onRequestPreview && onRequestPreview()} style={styles.bubble} android_ripple={{ color: '#eee' }}>
        <Ionicons name="sparkles" size={16} color={colors.warm} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginBottom: 8,
    alignSelf: 'flex-end',
    marginRight: 4,
  },
  previewTip: {
    position: 'absolute',
    right: 0,
    bottom: 44,
    width: 260,
    padding: 8,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    elevation: 3,
  },
  previewText: { fontFamily: serif, fontSize: 13, color: colors.text },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: {
    marginLeft: 4,
    maxWidth: 220,
    fontFamily: serif,
    fontSize: 13,
    color: colors.textMuted,
  },
});
