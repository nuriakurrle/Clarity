/**
 * PromptBubble – sanft pulsierender Gradient-Orb als Einstieg zu den Prompts.
 *
 * Design: weiche Kugel in der warmen App-Palette (Peach/Amber) mit passender
 * Aura (Orange/Gelb), die im Atem-Rhythmus pulsiert und über einem weichen
 * Bodenschatten schwebt; ein Licht-Schimmer wandert langsam über die Kugel.
 * Die Gradients sind mit react-native-svg gebaut, weil das sowohl nativ als
 * auch im Browser rendert (experimental_backgroundImage greift nur nativ).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, mixHex } from '../../theme/colors';
import { serif } from '../../theme/typography';

// Auf Web gibt es kein natives Animationsmodul – false vermeidet die Warnung,
// funktional identisch (RN Web animiert ohnehin in JS)
const NATIVE_DRIVER = Platform.OS !== 'web';

// Standard-Look ohne Tint: warme Peach/Amber-Palette mit einem Stich Hell-Lila
const LILAC = '#C7B5EA';
const DEFAULT_ORB = {
  auraInner: mixHex('#FF9D5C', LILAC, 0.3),
  auraOuter: mixHex('#FFC857', LILAC, 0.3),
  bodyLight: mixHex('#FFEBD6', LILAC, 0.2),
  bodyMid: mixHex('#F3CDB0', LILAC, 0.25),
  bodyDeep: mixHex('#E5A17C', LILAC, 0.25),
  bodyEdge: mixHex('#D98D62', LILAC, 0.25),
  glow: mixHex('#FF9E80', LILAC, 0.45),
};

/**
 * Orb-Palette aus einer Tint-Farbe ableiten (z.B. der gewählten Stimmung):
 * heller Kern → satter Rand, Aura und Glühen im selben Ton.
 */
function orbPalette(tint?: string) {
  if (!tint) return DEFAULT_ORB;
  return {
    auraInner: tint,
    auraOuter: mixHex(tint, '#FFFFFF', 0.35),
    bodyLight: mixHex(tint, '#FFFFFF', 0.75),
    bodyMid: mixHex(tint, '#FFFFFF', 0.4),
    bodyDeep: tint,
    bodyEdge: mixHex(tint, '#000000', 0.15),
    glow: mixHex(tint, '#FFFFFF', 0.2),
  };
}

type Props = {
  suggestion?: string;
  visible: boolean;
  iconOnly?: boolean;
  /** Färbt Kugel + Aura (z.B. Stimmungsfarbe); ohne Tint warmer Standard-Look. */
  tint?: string;
  /**
   * Zurückhaltender Modus fürs Schreiben (Tastatur offen): Orb schrumpft,
   * wird blass und rückt an den Rand. Liegt eine Empfehlung vor, bleibt er
   * etwas größer und voll sichtbar – präsent, aber nicht störend.
   */
  compact?: boolean;
  onRequestPreview?: () => void;
};

export function PromptBubble({
  suggestion = '',
  visible,
  onRequestPreview,
  iconOnly = false,
  tint,
  compact = false,
}: Props) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const tipOpacity = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: NATIVE_DRIVER }).start();
  }, [visible, opacity]);

  // Präsenz je nach Situation: beim Schreiben klein und blass am Rand,
  // mit vorliegender Empfehlung sichtbar (aber kleiner als im Ruhezustand)
  const hasSuggestion = Boolean(suggestion);
  const targetScale = compact ? (hasSuggestion ? 0.7 : 0.45) : 1;
  const targetPresence = compact ? (hasSuggestion ? 0.95 : 0.35) : 1;
  const presenceScale = useRef(new Animated.Value(targetScale)).current;
  const presenceOpacity = useRef(new Animated.Value(targetPresence)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(presenceScale, {
        toValue: targetScale,
        duration: 250,
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.timing(presenceOpacity, {
        toValue: targetPresence,
        duration: 250,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]).start();
  }, [targetScale, targetPresence, presenceScale, presenceOpacity]);

  // Atem-Animation: Aura und Orb schwellen sanft an und ab (~5s Zyklus)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  // Schwebe-Animation: Orb samt Aura driftet auf und ab (~5s Zyklus),
  // bewusst asynchron zum Atem-Rhythmus, damit die Bewegung organisch wirkt
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  // Seitliches Driften (~6.8s Zyklus): kombiniert mit dem vertikalen Schweben
  // entsteht eine leichte Achterbahn statt einer reinen Auf-Ab-Bewegung
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  // Licht-Schimmer wandert langsam über die Kugel (eine Runde = 14s)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: NATIVE_DRIVER,
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
      Animated.timing(tipOpacity, { toValue: 1, duration: 220, useNativeDriver: NATIVE_DRIVER }),
      Animated.delay(4200),
      Animated.timing(tipOpacity, { toValue: 0, duration: 400, useNativeDriver: NATIVE_DRIVER }),
    ]).start();
  }, [suggestion, tipOpacity]);

  if (!visible) return null;

  const orbColors = orbPalette(tint);

  const auraScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const auraOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const orbScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const shimmerRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // Deutlich spürbares Schweben und Driften – der Orb soll lebendig wirken
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [8, -14] });
  const driftX = drift.interpolate({ inputRange: [0, 1], outputRange: [-9, 9] });
  // Bodenschatten läuft gegenphasig: Orb oben → Schatten kleiner und blasser
  const shadowScale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
  const shadowOpacity = float.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.1] });

  // Touch-Feedback: beim Antippen kurz „einatmen", per Spring zurück
  const pressIn = () =>
    Animated.spring(pressScale, { toValue: 0.93, speed: 40, useNativeDriver: NATIVE_DRIVER }).start();
  const pressOut = () =>
    Animated.spring(pressScale, { toValue: 1, friction: 4, useNativeDriver: NATIVE_DRIVER }).start();

  // Im Kompakt-Modus zusätzlich Richtung rechten Rand rücken
  const edgeShift = presenceScale.interpolate({
    inputRange: [0.45, 1],
    outputRange: [26, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: Animated.multiply(opacity, presenceOpacity),
          transform: [{ scale: presenceScale }, { translateX: edgeShift }],
        },
      ]}
    >
      <Animated.View
        style={[styles.groundShadow, { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] }]}
      />
      <Animated.View style={[styles.floatWrap, { transform: [{ translateY: floatY }, { translateX: driftX }] }]}>
        <Animated.View
          style={[styles.aura, { opacity: auraOpacity, transform: [{ scale: auraScale }] }]}
        >
          <Svg width={AURA_SIZE} height={AURA_SIZE}>
            <Defs>
              <RadialGradient id="pbAura" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={orbColors.auraInner} stopOpacity={0.5} />
                <Stop offset="42%" stopColor={orbColors.auraOuter} stopOpacity={0.28} />
                <Stop offset="70%" stopColor={orbColors.auraOuter} stopOpacity={0.1} />
                {/* Schon vor dem Kreisrand voll transparent – vermeidet eine
                    sichtbare Kante durch Rundungsartefakte beim Rendern */}
                <Stop offset="92%" stopColor={orbColors.auraOuter} stopOpacity={0} />
                <Stop offset="100%" stopColor={orbColors.auraOuter} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={AURA_SIZE / 2} cy={AURA_SIZE / 2} r={AURA_SIZE / 2} fill="url(#pbAura)" />
          </Svg>
        </Animated.View>
        <Pressable
          onPress={() => onRequestPreview && onRequestPreview()}
          onPressIn={pressIn}
          onPressOut={pressOut}
          hitSlop={8}
        >
          <Animated.View style={[styles.orb, { transform: [{ scale: orbScale }, { scale: pressScale }] }]}>
            <Svg width={ORB_SIZE} height={ORB_SIZE} style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="pbBody" cx="68%" cy="45%" r="88%">
                  <Stop offset="0%" stopColor={orbColors.bodyLight} />
                  <Stop offset="55%" stopColor={orbColors.bodyMid} />
                  <Stop offset="90%" stopColor={orbColors.bodyDeep} />
                  <Stop offset="100%" stopColor={orbColors.bodyEdge} />
                </RadialGradient>
              </Defs>
              <Circle cx={ORB_SIZE / 2} cy={ORB_SIZE / 2} r={ORB_SIZE / 2} fill="url(#pbBody)" />
            </Svg>
            <Animated.View style={[styles.orbShimmer, { transform: [{ rotate: shimmerRotate }] }]}>
              <Svg width={ORB_SIZE} height={ORB_SIZE}>
                <Defs>
                  <RadialGradient id="pbShine" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.9} />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                  <RadialGradient id="pbGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={orbColors.glow} stopOpacity={0.8} />
                    <Stop offset="100%" stopColor={orbColors.glow} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={ORB_SIZE * 0.3} cy={ORB_SIZE * 0.28} r={ORB_SIZE * 0.42} fill="url(#pbShine)" />
                <Circle cx={ORB_SIZE * 0.26} cy={ORB_SIZE * 0.64} r={ORB_SIZE * 0.55} fill="url(#pbGlow)" />
              </Svg>
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.previewTip, { opacity: tipOpacity }]}>
        {suggestion ? <Text numberOfLines={2} ellipsizeMode="tail" style={styles.previewText}>{suggestion}</Text> : null}
      </Animated.View>
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
  floatWrap: {
    width: AURA_SIZE,
    height: AURA_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Weicher Bodenschatten unter dem Orb – verankert die Schwebe-Bewegung,
  // bleibt selbst am Boden, während der Orb darüber auf- und absteigt.
  // boxShadow statt experimental_backgroundImage, damit er auch auf Web rendert.
  groundShadow: {
    position: 'absolute',
    pointerEvents: 'none',
    bottom: 4,
    width: ORB_SIZE * 0.55,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(107,79,58,0.22)',
    boxShadow: '0px 1px 10px 5px rgba(107,79,58,0.22)',
  },
  // Warme Aura: Orange/Gelb, läuft weich nach außen aus
  aura: {
    position: 'absolute',
    pointerEvents: 'none',
    width: AURA_SIZE,
    height: AURA_SIZE,
  },
  // Kugel: Teal-Körper mit rosa Rand; der Gradient liegt als SVG darin
  orb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Wandernder Schimmer: weißes Highlight + orange-rosa Glühen, off-center,
  // rotiert langsam und lässt die Kugel dadurch „lebendig" wirken
  orbShimmer: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
  },
  previewTip: {
    position: 'absolute',
    pointerEvents: 'none',
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
