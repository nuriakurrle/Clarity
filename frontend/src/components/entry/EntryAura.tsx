/**
 * EntryAura – weicher Farb-Hintergrund für den Entry-Screen.
 *
 * Sehr heller, fast weißer Grund mit zarten Farbschimmern an den Rändern
 * (warmes Pfirsich oben links, Flieder/Blau am rechten Rand, Salbei unten) –
 * ruhig und clean, aber durch die warmen Töne trotzdem einladend.
 * Bewusst niedrige Deckkraft, damit der Eintragstext gut lesbar bleibt.
 * SVG-RadialGradients, weil die sowohl nativ als auch im Browser rendern.
 */
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

// Farbe + Position (relativ zur Screengröße) + Radius je Orb.
// Reihenfolge = Zeichenreihenfolge; spätere Orbs liegen „oben".
const ORBS: { color: string; cx: number; cy: number; r: number; opacity: number }[] = [
  { color: '#F0954F', cx: 0.08, cy: 0.04, r: 0.45, opacity: 0.18 }, // Pfirsich – oben links
  { color: '#8B7BD8', cx: 1.04, cy: 0.36, r: 0.4, opacity: 0.14 }, // Flieder – rechter Rand
  { color: '#5D96CE', cx: 1.0, cy: 0.78, r: 0.38, opacity: 0.11 }, // Blau – rechts unten
  { color: '#9CC5A1', cx: -0.06, cy: 0.88, r: 0.4, opacity: 0.11 }, // Salbei – unten links
];

export function EntryAura() {
  const { width, height } = useWindowDimensions();
  const base = Math.max(width, height);

  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          {ORBS.map((orb, i) => (
            <RadialGradient key={i} id={`entryOrb${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={orb.color} stopOpacity={orb.opacity} />
              <Stop offset="55%" stopColor={orb.color} stopOpacity={orb.opacity * 0.45} />
              {/* Vor dem Kreisrand voll transparent – vermeidet sichtbare Kanten */}
              <Stop offset="88%" stopColor={orb.color} stopOpacity={0} />
              <Stop offset="100%" stopColor={orb.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {ORBS.map((orb, i) => (
          <Circle
            key={i}
            cx={orb.cx * width}
            cy={orb.cy * height}
            r={orb.r * base}
            fill={`url(#entryOrb${i})`}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Fast weiß mit minimal warmem Einschlag – die Farbe kommt von den Orbs
  wrap: { backgroundColor: '#F7F5F2' },
});
