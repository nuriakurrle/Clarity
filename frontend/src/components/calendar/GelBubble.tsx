/**
 * GelBubble – einzelne, EINFARBIGE Mood-Bubble im Look des Home-Blobs:
 * satter RadialGradient + Gauß-Blur (weiche Kante) und Grain-Textur, alles
 * unter der gemeinsamen FadeMask, damit Farbe UND Korn synchron ins Nichts
 * verlaufen (kein Kasten-Bug, siehe BlobEffects.tsx).
 *
 * Bewusst FLACH: KEIN Glanzpunkt, KEIN Schatten-Akzent – anders als der
 * Home-Blob (Gel-Kissen) soll die Kalender-Bubble ein reiner, weicher
 * Farbfleck ohne 3D-Kugel-Optik sein. Der übrige Filter-Stack (Blur-Ratio,
 * FadeMask, saturate, Grain, Gradient-Stops) ist identisch zum Home-Blob.
 *
 * Sie mischt nichts: genau eine MOOD_COLORS-Farbe pro Bubble, kein Label –
 * Bedeutung entsteht aus Farbe (Mood) und Größe (Anteil).
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
  // Bewusst zurückgenommen (1.15): der Kern-Kreis + das Plateau liefern schon
  // genug Dichte, hohe Sättigung wirkte darüber grell/plakativ. Ziel ist die
  // weiche, leicht gedämpfte Home-Blob-Anmutung, nicht maximale Sättigung.
  const vivid = saturate(color, 1.15);
  const C = size / 2;
  // Exakt das Home-Blob-Verhältnis: stdDeviation 28 bei 320er-Canvas = 8,75 %.
  const blur = Math.max(4, size * 0.0875);

  return (
    <Svg width={size} height={size}>
      <Defs>
        <Filter id={`gb-blur-${uid}`}>
          <FeGaussianBlur in="SourceGraphic" stdDeviation={blur} />
        </Filter>
        {/* Äußere Schicht: Plateau bis 83 % (Kompromiss – kein blasser Randring
            wie bei den ursprünglichen 78 %, aber auch nicht gleichmäßig knallig
            bis fast an den Rand wie bei 88 %). Rand-Opacity 0.78. */}
        <RadialGradient id={`gb-fill-${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={vivid} stopOpacity={1} />
          <Stop offset="83%" stopColor={vivid} stopOpacity={0.98} />
          <Stop offset="100%" stopColor={vivid} stopOpacity={0.78} />
        </RadialGradient>
        {/* Innerer Kern-Kreis: voll deckend im Zentrum, weich bis 0 an seiner
            eigenen Kante. Bildet die dicht ums Zentrum liegenden Satelliten des
            Home-Blobs nach und erzeugt so die satte Kern-Tiefe. Wird mit derselben
            Farbe, demselben Blur und derselben FadeMask gerendert wie die Außen-
            schicht → verschmilzt nahtlos, kein sichtbarer zweiter Kreis. */}
        <RadialGradient id={`gb-core-${uid}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={vivid} stopOpacity={0.85} />
          <Stop offset="55%" stopColor={vivid} stopOpacity={0.85} />
          <Stop offset="100%" stopColor={vivid} stopOpacity={0} />
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
          {/* Äußere Schicht (r bis ~0.44 des Canvas) – weiche Kante via FadeMask. */}
          <Circle cx={C} cy={C} r={size * 0.44} fill={`url(#gb-fill-${uid})`} />
          {/* Kern-Kreis darüber, gleiche Gruppe → gleicher Blur + gleiche Maske.
              Vertieft die Farbe im Zentrum, verschmilzt durch den weichen Rand
              nahtlos mit der Außenschicht. */}
          <Circle cx={C} cy={C} r={size * 0.26} fill={`url(#gb-core-${uid})`} />
        </G>
        {/* Grain über der Farbe, gleiche Maske → läuft synchron aus. Leicht
            angehoben (0.11), damit die Körnung in der jetzt dichteren Farbfläche
            als bewusstes Stilelement sichtbar bleibt (wie beim Home-Blob). */}
        <Circle cx={C} cy={C} r={C} fill={`url(#gb-grain-${uid})`} opacity={0.11} />
      </G>
    </Svg>
  );
}
