/**
 * OnboardingScreen – der erste Eindruck beim allerersten App-Start.
 *
 * Bewusst schlicht und im Blob-Look der App gehalten: reines Weiß, die
 * Serif-Wortmarke, ein weicher Farb-Orb als ruhiger Blickfang und ein einziger
 * grüner Call-to-Action. Kein Erklärtext-Overload – eine Zeile Versprechen,
 * ein Knopf hinein.
 *
 * Die "schon gesehen"-Logik liegt in App.tsx (AsyncStorage); dieser Screen ist
 * rein präsentativ und meldet den Klick nur über `onStart` zurück.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { PrivacyNote } from '../components';
import { colors } from '../theme/colors';
import { serif } from '../theme/typography';

const ORB = 260;

/** Weicher, atmender Farb-Orb – dieselbe Bildsprache wie der Mood-Blob. */
function GreetingOrb() {
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 3800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 3800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [breath]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Animated.View style={[styles.orbWrap, { transform: [{ scale }] }]}>
      <Svg width={ORB} height={ORB}>
        <Defs>
          <RadialGradient id="orb" cx="50%" cy="45%" r="55%">
            <Stop offset="0%" stopColor="#8FD4B4" stopOpacity={1} />
            <Stop offset="55%" stopColor={colors.primary} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={ORB / 2} cy={ORB / 2} r={ORB / 2} fill="url(#orb)" />
      </Svg>
      <Text style={styles.orbLabel}>Clarity</Text>
    </Animated.View>
  );
}

type Props = { onStart: () => void };

export default function OnboardingScreen({ onStart }: Props) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressIn = () =>
    Animated.spring(pressScale, { toValue: 0.97, speed: 40, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(pressScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <GreetingOrb />
        <Text style={styles.headline}>Hol dir Klarheit{'\n'}in dein Leben.</Text>
        <Text style={styles.subline}>
          Ein ruhiger Ort für deine Gedanken – Tag für Tag, ganz für dich.
        </Text>
      </View>

      <View style={styles.bottom}>
        <Animated.View style={{ transform: [{ scale: pressScale }], width: '100%' }}>
          <Pressable
            onPress={onStart}
            onPressIn={pressIn}
            onPressOut={pressOut}
            accessibilityRole="button"
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Loslegen</Text>
          </Pressable>
        </Animated.View>
        <PrivacyNote style={styles.privacy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
  orbWrap: { alignItems: 'center', justifyContent: 'center' },
  // Wortmarke mittig über dem Orb – weiß auf der satten Kugelfarbe.
  orbLabel: {
    position: 'absolute',
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 26,
    letterSpacing: 3,
    color: '#FFFFFF',
  },
  headline: {
    fontFamily: serif,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  subline: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  bottom: { paddingBottom: 12, gap: 18 },
  cta: {
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  privacy: { marginTop: 2 },
});
