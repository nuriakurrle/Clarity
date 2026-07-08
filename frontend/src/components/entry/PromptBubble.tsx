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
    marginTop: 20,
    marginBottom: 12,
    alignSelf: 'flex-end',
    marginRight: 4,
    paddingRight: 4,
  },
  previewTip: {
    position: 'absolute',
    right: 0,
    bottom: 50,
    width: 280,
    padding: 12,
    backgroundColor: colors.warm + '15',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.warm,
    shadowColor: colors.warm,
    shadowOpacity: 0.2,
    elevation: 5,
  },
  previewText: { fontFamily: serif, fontSize: 14, fontWeight: '500', color: colors.text },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.warm,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: {
    marginLeft: 4,
    maxWidth: 220,
    fontFamily: serif,
    fontSize: 13,
    color: '#fff',
  },
});
