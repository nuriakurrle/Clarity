/**
 * PromptBubble – sanft pulsierender Gradient-Orb als Einstieg zu den Prompts.
 *
 * Design: weiche Kugel (Teal/Rosa) mit warmer Aura (Orange/Gelb), die im
 * Atem-Rhythmus pulsiert; ein Licht-Schimmer wandert langsam über die Kugel.
 * Nutzt native CSS-Gradients (experimental_backgroundImage, RN 0.79+) –
 * bewusst ohne zusätzliche Libraries, damit package.json unangetastet bleibt.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
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
  const breathe = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [visible, opacity]);

  // Atem-Animation: Aura und Orb schwellen sanft an und ab (~5s Zyklus)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  // Licht-Schimmer wandert langsam über die Kugel (eine Runde = 14s)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

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

  const auraScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const auraOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const orbScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const shimmerRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View pointerEvents={'auto'} style={[styles.container, { opacity: opacity }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.aura, { opacity: auraOpacity, transform: [{ scale: auraScale }] }]}
      />
      <Animated.View style={[styles.previewTip, { opacity: tipOpacity }]} pointerEvents="none">
        {suggestion && <Text numberOfLines={2} ellipsizeMode="tail" style={styles.previewText}>{suggestion}</Text>}
      </Animated.View>
      <Pressable onPress={() => onRequestPreview && onRequestPreview()} hitSlop={8}>
        <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }] }]}>
          <Animated.View style={[styles.orbShimmer, { transform: [{ rotate: shimmerRotate }] }]} />
          <Ionicons name="sparkles" size={14} color="rgba(255,255,255,0.85)" style={styles.icon} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const AURA_SIZE = 120;
const ORB_SIZE = 60;

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 12,
    alignSelf: 'flex-end',
    marginRight: 4,
    width: AURA_SIZE,
    height: AURA_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Warme Aura: Orange/Gelb, läuft weich nach außen aus
  aura: {
    position: 'absolute',
    width: AURA_SIZE,
    height: AURA_SIZE,
    borderRadius: AURA_SIZE / 2,
    experimental_backgroundImage:
      'radial-gradient(circle, rgba(255,157,92,0.55) 0%, rgba(255,200,87,0.30) 45%, rgba(255,200,87,0) 72%)',
  },
  // Kugel: Teal-Körper mit rosa Rand (Fallback-Farbe, falls Gradient nicht greift)
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8FB8BA',
    experimental_backgroundImage:
      'radial-gradient(circle at 68% 45%, #9CC3C5 0%, #8FB8BA 55%, #F4B8C8 90%, #FBD4DF 100%)',
  },
  // Wandernder Schimmer: weißes Highlight + orange-rosa Glühen, off-center,
  // rotiert langsam und lässt die Kugel dadurch „lebendig" wirken
  orbShimmer: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    experimental_backgroundImage:
      'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 42%), radial-gradient(circle at 26% 64%, rgba(255,158,128,0.8) 0%, rgba(255,158,128,0) 55%)',
  },
  icon: { opacity: 0.9 },
  previewTip: {
    position: 'absolute',
    right: 0,
    bottom: AURA_SIZE - 16,
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
});
