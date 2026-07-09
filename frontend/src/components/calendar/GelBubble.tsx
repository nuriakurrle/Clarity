/**
 * GelBubble – einzelne, EINFARBIGE Mood-Bubble im Look des Home-Blobs:
 * satter RadialGradient + Gauß-Blur (weiche Kante), Grain-Textur und kleiner
 * Glanzpunkt – alles unter der gemeinsamen FadeMask, damit Farbe UND Korn
 * synchron ins Nichts verlaufen (kein Kasten-Bug, siehe BlobEffects.tsx).
 *
 * Anders als der Home-Blob mischt sie nichts: genau eine MOOD_COLORS-Farbe
 * pro Bubble, kein Label – Bedeutung entsteht aus Farbe (Mood) und
 * Größe (Anteil am Tag).
 */
import React, { useId } from 'react';
import Svg, {
  Circle,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Image as SvgImage,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { FadeMask, NOISE_TEXTURE, NOISE_TILE, saturate } from '../BlobEffects';

type Props = {
  /** Mood-Farbe (moodColor[level]); Sättigungsboost passiert hier drin. */
  color: string;
  /** Kantenlänge des Bubble-Canvas in px (Blob füllt ~76 % davon). */
  size: number;
};

export function GelBubble({ color, size }: Props) {
  // Eindeutige IDs pro Instanz – viele Bubbles teilen sich sonst die Defs.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const vivid = saturate(color, 1.3); // gleicher Boost wie MoodMirrorBlob
  const C = size / 2;
  // Exakt das Home-Blob-Verhältnis: stdDeviation 32 bei 320er-Canvas = 10 %.
  const blur = Math.max(5, size * 0.1);

  return (
    <Svg width={size} height={size}>
      <Defs>
        <Filter id={`gb-blur-${uid}`}>
          <FeGaussianBlur in="SourceGraphic" stdDeviation={blur} />
        </Filter>
        {/* Gradient-Stops exakt wie MoodMirrorBlob (0 % / 78 % / 100 %) */}
        <RadialGradient id={`gb-fill-${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={vivid} stopOpacity={1} />
          <Stop offset="78%" stopColor={vivid} stopOpacity={0.98} />
          <Stop offset="100%" stopColor={vivid} stopOpacity={0.65} />
        </RadialGradient>
        {/* Glanzpunkt bewusst dezenter als zuvor: Lichtreflex im Gel,
            keine glänzende Murmel. */}
        <RadialGradient id={`gb-shine-${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.3} />
          <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={0.12} />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
        <Pattern
          id={`gb-grain-${uid}`}
          patternUnits="userSpaceOnUse"
          width={NOISE_TILE}
          height={NOISE_TILE}
        >
          <SvgImage href={NOISE_TEXTURE} width={NOISE_TILE} height={NOISE_TILE} />
        </Pattern>
        <FadeMask id={`gb-mask-${uid}`} size={size} />
      </Defs>

      <G mask={`url(#gb-mask-${uid})`}>
        <G filter={`url(#gb-blur-${uid})`}>
          {/* Unsichtbares Full-Canvas-Rect: erweitert die Filter-BBox auf den
              ganzen Canvas – die native Filter-Region ignoriert filterUnits
              und würde das geblurrte Ergebnis sonst rechteckig abschneiden. */}
          <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" fillOpacity={0.004} />
          {/* 88 % Canvas-Füllung wie die Home-Blob-Schichten (r bis 0.44–0.48
              des Canvas) – die weiche Außenkante macht die FadeMask. */}
          <Circle cx={C} cy={C} r={size * 0.44} fill={`url(#gb-fill-${uid})`} />
        </G>
        {/* Grain über der Farbe, gleiche Maske → läuft synchron aus */}
        <Circle cx={C} cy={C} r={C} fill={`url(#gb-grain-${uid})`} opacity={0.09} />
        {/* Glanzpunkt oben links für den Gel-Effekt */}
        <Circle cx={size * 0.38} cy={size * 0.32} r={size * 0.26} fill={`url(#gb-shine-${uid})`} />
      </G>
    </Svg>
  );
}
