/**
 * WelcomeHero – ruhiger Begrüßungsbereich oben auf dem Home-Screen.
 *
 * Zeigt Datum, einen ruhigen Gruß, eine Reflexionsfrage und den großen
 * Schreib-Button auf einem weichen, "geblurrten" Farbverlauf – dazu die
 * Datenschutz-Zeile. Der bestehende Home-Content folgt darunter beim Scrollen.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

const WEEKDAYS = [
  'SONNTAG', 'MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG',
];
const MONTHS = [
  'JANUAR', 'FEBRUAR', 'MÄRZ', 'APRIL', 'MAI', 'JUNI',
  'JULI', 'AUGUST', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DEZEMBER',
];

const HERO_HEIGHT = Math.max(520, Math.round(Dimensions.get('window').height * 0.74));

function todayLine(): string {
  const now = new Date();
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]}`;
}

type Props = { onWrite?: () => void };

export function WelcomeHero({ onWrite }: Props) {
  // Sanftes "Atmen" des Glow-Kreises hinter dem Button.
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 3200, useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 3200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const glowOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.7] });

  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={[colors.warmSoft, colors.warmSofter, colors.bg]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <Text style={styles.date}>{todayLine()}</Text>
      <Text style={styles.greeting}>Zeit für dich</Text>
      <Text style={styles.question}>„Was möchtest du heute loswerden?"</Text>

      <View style={styles.center}>
        {/* weiche, atmende Glow-Kreise hinter dem Button */}
        <Animated.View
          style={[styles.glow, styles.glowOuter, { opacity: glowOpacity, transform: [{ scale }] }]}
        />
        <Animated.View
          style={[styles.glow, styles.glowInner, { opacity: glowOpacity, transform: [{ scale }] }]}
        />
        <Pressable
          onPress={onWrite}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Neuen Eintrag schreiben"
        >
          <Ionicons name="pencil-outline" size={30} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={13} color={colors.textMuted} />
        <Text style={styles.privacyText}>Nur du siehst das. Lokal & verschlüsselt.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: HERO_HEIGHT,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  greeting: {
    fontFamily: serif,
    fontSize: 36,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
    textAlign: 'center',
  },
  question: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 24,
    color: colors.textMuted,
    marginTop: 10,
    textAlign: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', borderRadius: 999 },
  glowOuter: { width: 260, height: 260, backgroundColor: colors.warmSoft },
  glowInner: { width: 180, height: 180, backgroundColor: colors.warmHighlight },
  button: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privacyText: { fontSize: 13, color: colors.textMuted },
});
