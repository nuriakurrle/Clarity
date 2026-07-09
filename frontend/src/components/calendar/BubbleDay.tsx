/**
 * Ein einzelner weicher Mood-Kreis (Bubble) für den Kalender.
 * Wird von Wochen- (WeekBubbles) und Monatsansicht (CalendarGrid) genutzt:
 * Farbe = Stimmung, Durchmesser = Intensität, Auswahl hebt die Bubble hervor.
 *
 * Rendering: react-native-svg <RadialGradient> mit Opacity-Fade auf 0 ab 92 %
 * (BLOB_STOPS) statt <FeGaussianBlur> – SVG-Filter sind in react-native-svg
 * unzuverlässig, der Fade-Ansatz ist projektintern erprobt (PromptBubble.tsx).
 * Ein zweiter, dichterer Kern-Gradient hält kleine Bubbles lesbar.
 */
import React, { useEffect, useId, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '../../theme/colors';
import { BLOB_STOPS, EMPTY_DAY_COLOR } from '../../theme/moodColors';

const NATIVE_DRIVER = Platform.OS !== 'web';

type Props = {
  /** Blob-Farbe (moodColor[level]); bei `empty` ignoriert. */
  color: string;
  /** Blob-Durchmesser in px (bereits aus Intensität gemappt). */
  size: number;
  /** Tageszahl als Label über der Bubble. */
  day: number;
  selected: boolean;
  /** Kein Eintrag: winziger blasser Platzhalter-Kreis statt Blob. */
  empty?: boolean;
  /** Heutiger Tag: dezenter Haarlinien-Ring um die Zelle. */
  isToday?: boolean;
  /** Tageszahl in der Bubble anzeigen (Monatsansicht zeigt sie separat). */
  showLabel?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function BubbleDay({
  color,
  size,
  day,
  selected,
  empty = false,
  isToday = false,
  showLabel = true,
  onPress,
  accessibilityLabel,
}: Props) {
  // Eindeutige Gradient-IDs pro Instanz, damit sich mehrere <Svg>-Bäume
  // (7 Bubbles nebeneinander) nicht gegenseitig die Defs überschreiben.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const scale = useRef(new Animated.Value(selected ? 1.25 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1.25 : 1,
      friction: 5,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [selected, scale]);

  // Canvas etwas größer als der Blob, damit der Fade Platz zum Auslaufen hat.
  const canvas = Math.ceil(size * 1.15);

  return (
    <Pressable
      onPress={onPress}
      style={styles.cell}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${day}.`}
      hitSlop={4}
    >
      <View style={[styles.ring, isToday && styles.ringToday]}>
        <Animated.View style={[styles.bubbleWrap, { transform: [{ scale }] }]}>
          {empty ? (
            <View style={styles.emptyDot} />
          ) : (
            <Svg width={canvas} height={canvas}>
              <Defs>
                <RadialGradient id={`bd-soft-${uid}`} cx="50%" cy="50%" r="50%">
                  {BLOB_STOPS.map((s) => (
                    <Stop key={s.offset} offset={s.offset} stopColor={color} stopOpacity={s.opacity} />
                  ))}
                </RadialGradient>
                <RadialGradient id={`bd-core-${uid}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={color} stopOpacity={0.9} />
                  <Stop offset="100%" stopColor={color} stopOpacity={0.25} />
                </RadialGradient>
              </Defs>
              <Circle cx={canvas / 2} cy={canvas / 2} r={size / 2} fill={`url(#bd-soft-${uid})`} />
              <Circle cx={canvas / 2} cy={canvas / 2} r={size * 0.3} fill={`url(#bd-core-${uid})`} />
            </Svg>
          )}
          {showLabel ? (
            <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{day}</Text>
          ) : null}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringToday: { borderColor: colors.textFaint },
  bubbleWrap: { alignItems: 'center', justifyContent: 'center' },
  emptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EMPTY_DAY_COLOR,
    margin: 8,
  },
  dayText: {
    position: 'absolute',
    fontSize: 12,
    color: colors.text,
  },
  dayTextSelected: { fontWeight: '700' },
});
