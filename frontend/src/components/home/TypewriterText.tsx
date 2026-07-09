/**
 * TypewriterText – blendet Text zeichenweise ein, als würde er gerade live
 * geschrieben. Mit blinkendem Cursor während des Tippens.
 *
 * Läuft pro Instanz genau EINMAL: sobald `active` das erste Mal true wird,
 * startet die Animation; erneutes Rein-/Rausscrollen startet sie nicht neu
 * (das "already animated"-Flag lebt im Ref).
 *
 * Bewusst ohne reanimated: Text-Inhalt lässt sich nur per State aufbauen
 * (ein Interval erhöht den sichtbaren Zeichen-Index); nur der Cursor blinkt
 * über die eingebaute RN-Animated-API.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleProp, Text, TextStyle } from 'react-native';

const NATIVE_DRIVER = Platform.OS !== 'web';

type Props = {
  text: string;
  /** Startet die Animation beim ersten true (z. B. „Block ist im Viewport"). */
  active: boolean;
  /** Tippgeschwindigkeit in Zeichen pro Sekunde. */
  charsPerSecond?: number;
  style?: StyleProp<TextStyle>;
};

export function TypewriterText({ text, active, charsPerSecond = 40, style }: Props) {
  const [visibleChars, setVisibleChars] = useState(0);
  const startedRef = useRef(false);
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  const typing = startedRef.current && visibleChars < text.length;

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;
    const interval = setInterval(() => {
      setVisibleChars((n) => {
        if (n >= text.length) {
          clearInterval(interval);
          return n;
        }
        return n + 1;
      });
    }, 1000 / charsPerSecond);
    return () => clearInterval(interval);
  }, [active, text.length, charsPerSecond]);

  // Blinkender Cursor, solange getippt wird.
  useEffect(() => {
    if (!typing) return;
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 420, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 420, useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    blink.start();
    return () => blink.stop();
  }, [typing, cursorOpacity]);

  return (
    <Text style={style}>
      {text.slice(0, visibleChars)}
      {typing ? <Animated.Text style={{ opacity: cursorOpacity }}>▍</Animated.Text> : null}
    </Text>
  );
}
