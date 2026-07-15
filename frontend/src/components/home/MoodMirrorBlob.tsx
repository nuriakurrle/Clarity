/**
 * MoodMirrorBlob – der "Stimmungs-Spiegel" oben auf dem Home-Screen.
 *
 * Ein großer, weicher Farb-Blob, der die Stimmungen der letzten 7 Tage
 * (fetchMoodProfile) zu einer ineinander verschmolzenen Farbwolke mischt:
 * jede Tagesfarbe wird ein überlappender Radial-Gradient-Kreis, gewichtet
 * nach Anzahl der Einträge und Intensität. Ohne Einträge zeigt er einen
 * sanften Pastell-Default. Tap auf den Blob öffnet den EntryScreen.
 *
 * Rendering: react-native-svg <RadialGradient> mit Opacity-Fade auf 0 ab
 * 92 % (BLOB_STOPS) statt <FeGaussianBlur> – SVG-Filter sind in
 * react-native-svg unzuverlässig; der Fade-Ansatz ist projektintern erprobt
 * (PromptBubble.tsx) und rendert auf iOS/Android/Web gleich weich.
 * Animation: eingebaute RN-Animated-API (native driver), drei phasen-
 * verschobene Drift-Loops + globales Atmen – bewusst kein reanimated.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { FadeMask, lightenToward, NOISE_TEXTURE, saturate } from '../BlobEffects';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';
import {
  EMPTY_BLOB_COLORS,
  moodColor,
  MoodLevel,
  valenceToMoodLevel,
} from '../../theme/moodColors';
import { weeklyMoodPrompt } from '../../utils/moodPrompts';
import { isInLastWeek, lastWeekRange } from '../../utils/week';
import { TypewriterText } from './TypewriterText';
import { EntryRecord, fetchEntries } from '../../services/api';
import { PrivacyNote } from '../PrivacyNote';

const NATIVE_DRIVER = Platform.OS !== 'web';

const WEEKDAYS = [
  'SONNTAG', 'MONTAG', 'DIENSTAG', 'MITTWOCH', 'DONNERSTAG', 'FREITAG', 'SAMSTAG',
];
const MONTHS = [
  'JANUAR', 'FEBRUAR', 'MÄRZ', 'APRIL', 'MAI', 'JUNI',
  'JULI', 'AUGUST', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DEZEMBER',
];

const HERO_HEIGHT = Math.max(520, Math.round(Dimensions.get('window').height * 0.74));
const SIZE = 320; // quadratischer Blob-Canvas

function todayLine(): string {
  const now = new Date();
  return `${WEEKDAYS[now.getDay()]}, ${now.getDate()}. ${MONTHS[now.getMonth()]}`;
}

/** Eine Farbschicht der Wolke: Farbe + Anteil (0..1) an der Periode.
 *  `level` fehlt nur beim Pastell-Default (keine Einträge). */
type BlobLayer = { color: string; share: number; level?: MoodLevel };

/** Positionierte Schicht mit fertigen Kreis-Koordinaten + Zentrums-Deckkraft. */
type PlacedLayer = BlobLayer & { cx: number; cy: number; r: number; centerOpacity: number };

/** Pastell-Default, solange keine Einträge existieren (oder Backend offline). */
const EMPTY_LAYERS: BlobLayer[] = EMPTY_BLOB_COLORS.map((color) => ({
  color,
  share: 1 / EMPTY_BLOB_COLORS.length,
}));

/**
 * Einträge der Vorwoche (Mo–So, gleiches Fenster wie der Digest-Agent) zu
 * Farbschichten verdichten – pro EINTRAG
 * (nicht pro Tag), damit alle vorkommenden Moods der Woche einfließen und
 * sich nichts über den Tages-Durchschnitt wegmittelt. Anteil = Einträge
 * dieses Moods / alle Einträge der Periode; absteigend sortiert, sodass
 * die dominante Emotion an Index 0 steht.
 */
function buildLayers(entries: EntryRecord[]): BlobLayer[] {
  const counts = new Map<MoodLevel, number>();
  const range = lastWeekRange();
  let total = 0;
  for (const e of entries) {
    if (e.valence == null) continue;
    if (!isInLastWeek(e.created_at, range)) continue;
    const level = valenceToMoodLevel(e.valence);
    counts.set(level, (counts.get(level) ?? 0) + 1);
    total += 1;
  }
  if (!total) return [];
  return [...counts.entries()]
    .map(([level, n]) => ({ level, color: moodColor[level], share: n / total }))
    .sort((a, b) => b.share - a.share);
}

/**
 * Schichten anordnen: die dominante Farbe liegt zentral mit dem größten
 * Radius und voller Deckkraft; schwächere Moods werden kleinere, blassere
 * Farbflecken am Rand, deren Größe/Deckkraft mit ihrem Anteil skaliert.
 */
function placeLayers(layers: BlobLayer[]): PlacedLayer[] {
  const C = SIZE / 2;
  const rest = layers.length - 1;
  return layers.map((l, k) => {
    if (k === 0) {
      // Dominante Emotion: zentral, größter Fleck, volle Deckkraft.
      return {
        ...l,
        color: saturate(l.color, 1.3),
        cx: C,
        cy: C,
        r: Math.min(SIZE * 0.48, SIZE * (0.32 + 0.16 * l.share)),
        centerOpacity: 1,
      };
    }
    const angle = ((k - 1) / Math.max(1, rest)) * 2 * Math.PI - Math.PI / 2; // ab 12 Uhr
    // Satelliten rücken dicht ans Zentrum (50–70 % Flächenüberlappung mit dem
    // dominanten Kreis), damit der Blur alles zu einem Continuum verschmilzt.
    return {
      ...l,
      color: lightenToward(saturate(l.color, 1.3), 0.04),
      cx: C + Math.cos(angle) * SIZE * 0.12,
      cy: C + Math.sin(angle) * SIZE * 0.12,
      r: Math.max(SIZE * 0.22, SIZE * (0.22 + 0.3 * l.share)),
      centerOpacity: Math.min(1, 0.9 + 0.3 * l.share),
    };
  });
}




/** Endlos-Loop 0→1→0 mit sanfter Sinus-Easing-Kurve. */
function makeLoop(value: Animated.Value, duration: number) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.timing(value, {
        toValue: 0,
        duration,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]),
  );
}

type Props = { onWrite?: () => void; minHeight?: number };

export function MoodMirrorBlob({ onWrite, minHeight }: Props) {
  const [layers, setLayers] = useState<BlobLayer[]>(EMPTY_LAYERS);

  // Stimmungen der letzten 7 Tage laden; Fehler/leer → Pastell-Default bleibt.
  const dataOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let alive = true;
    fetchEntries()
      .then((res) => {
        if (!alive) return;
        const built = buildLayers(res.entries ?? []);
        if (built.length) {
          // Sanfter Crossfade beim Wechsel vom Default auf echte Farben
          Animated.sequence([
            Animated.timing(dataOpacity, { toValue: 0, duration: 300, useNativeDriver: NATIVE_DRIVER }),
            Animated.timing(dataOpacity, { toValue: 1, duration: 300, useNativeDriver: NATIVE_DRIVER }),
          ]).start();
          setTimeout(() => alive && setLayers(built), 300);
        }
      })
      .catch(() => {
        /* Backend offline → Pastell-Default, bewusst still (wie HomeScreen) */
      });
    return () => {
      alive = false;
    };
  }, [dataOpacity]);

  // Einfühlsame Wochen-Ansprache passend zur dominanten Stimmung des Blobs;
  // ohne Einträge (Pastell-Default, level fehlt) die neutrale Standard-Frage.
  const question = useMemo(
    () =>
      weeklyMoodPrompt(
        layers.flatMap((l) => (l.level ? [{ level: l.level, share: l.share }] : [])),
      ),
    [layers],
  );

  // Schichten platzieren und round-robin auf 3 animierte Gruppen verteilen.
  // Die dominante Schicht (Index 0) landet in der ZULETZT gerenderten Gruppe,
  // damit sie oben liegt und nicht von den Satelliten verdeckt wird.
  const groups = useMemo(() => {
    const placed = placeLayers(layers);
    const g: PlacedLayer[][] = [[], [], []];
    placed.forEach((l, i) => g[2 - (i % 3)].push(l));
    return g.filter((grp) => grp.length > 0);
  }, [layers]);

  // Drei phasenverschobene Drift-Loops + globales Atmen + Press-Feedback.
  const drifts = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const breath = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  // Sanftes Auf-und-ab-Wippen des Scroll-Hinweises am unteren Hero-Rand.
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = [
      makeLoop(drifts[0], 4200),
      makeLoop(drifts[1], 5600),
      makeLoop(drifts[2], 6800),
      makeLoop(breath, 4800),
      makeLoop(bob, 1500),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phasenverschobene Output-Ranges, damit die Gruppen gegeneinander treiben.
  const groupTransforms = [
    {
      translateX: drifts[0].interpolate({ inputRange: [0, 1], outputRange: [-14, 14] }),
      translateY: drifts[0].interpolate({ inputRange: [0, 1], outputRange: [10, -14] }),
      scale: drifts[0].interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.09] }),
    },
    {
      translateX: drifts[1].interpolate({ inputRange: [0, 1], outputRange: [14, -14] }),
      translateY: drifts[1].interpolate({ inputRange: [0, 1], outputRange: [-14, 10] }),
      scale: drifts[1].interpolate({ inputRange: [0, 1], outputRange: [1.09, 0.95] }),
    },
    {
      translateX: drifts[2].interpolate({ inputRange: [0, 1], outputRange: [-11, 11] }),
      translateY: drifts[2].interpolate({ inputRange: [0, 1], outputRange: [-10, 14] }),
      scale: drifts[2].interpolate({ inputRange: [0, 1], outputRange: [1.06, 0.94] }),
    },
  ];
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  const pressIn = () =>
    Animated.spring(pressScale, { toValue: 0.95, speed: 40, useNativeDriver: NATIVE_DRIVER }).start();
  const pressOut = () =>
    Animated.spring(pressScale, { toValue: 1, friction: 4, useNativeDriver: NATIVE_DRIVER }).start();

  return (
    <View style={[styles.hero, { minHeight: minHeight ?? HERO_HEIGHT }]}>
      <Text style={styles.brand}>Clarity</Text>
      <Text style={styles.date}>{todayLine()}</Text>
      {/* Wochen-Ansprache tippt sich einmal beim Laden ein – gleiche
          Typewriter-Logik wie in der Digest-Sektion (TypewriterText).
          key={question}: wenn kurz nach dem Mount die echten Wochendaten
          eintreffen und der Text wechselt, startet der Typewriter sauber
          neu statt mit dem Zählerstand des alten Texts weiterzulaufen. */}
      <TypewriterText key={question} text={question} active style={styles.question} />

      <View style={styles.center}>
        <Pressable
          onPress={onWrite}
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityRole="button"
          accessibilityLabel="Neuen Eintrag schreiben"
          hitSlop={8}
        >
          <Animated.View
            style={[
              styles.blobBox,
              { opacity: dataOpacity, transform: [{ scale: breathScale }, { scale: pressScale }] },
            ]}
          >
            {groups.map((group, gi) => (
              <Animated.View
                key={gi}
                style={[
                  StyleSheet.absoluteFill,
                  {
                    transform: [
                      { translateX: groupTransforms[gi].translateX },
                      { translateY: groupTransforms[gi].translateY },
                      { scale: groupTransforms[gi].scale },
                    ],
                  },
                ]}
              >
                <Svg width={SIZE} height={SIZE}>
                  <Defs>
                    {/* Gauß-Blur + Re-Sättigung über die ganze Gruppe:
                        Der Blur verwischt die Einzelkreise zu einem Continuum,
                        die FeColorMatrix (saturate 1.6) holt die Mischzonen
                        aus dem Grau zurück in satte Zwischentöne. Beides nativ
                        (Metal) – FeTurbulence dagegen rendert auf iOS nichts.
                        Echtes screen-Blending ZWISCHEN den drei animierten
                        Layern ist nicht möglich (separate native Views, RN
                        kennt kein mix-blend-mode; FeBlend sieht nur das eigene
                        SourceGraphic) – Saturate ist der native Ersatz. */}
                    {/* Filter-Region explizit in Canvas-Koordinaten
                        (userSpaceOnUse): die Default-Region relativ zur
                        Bounding-Box der Kreise schneidet das geblurrte
                        Ergebnis rechteckig ab – das war die sichtbare
                        Geisterkante im Blob.
                        Nur Blur, KEIN FeColorMatrix: saturate verfärbte die
                        gesamte rechteckige Filter-Region (Premultiply-
                        Artefakt auf iOS) – die Sättigung kommt stattdessen
                        aus den vorab aufgehellten Layer-Farben (Screen-
                        Näherung in JS, siehe lightenToward()). */}
                    <Filter
                      id={`mmb-blur-${gi}`}
                      filterUnits="userSpaceOnUse"
                      x={0}
                      y={0}
                      width={SIZE}
                      height={SIZE}
                    >
                      <FeGaussianBlur in="SourceGraphic" stdDeviation={28} />
                    </Filter>
                    {group.map((l, i) => (
                      <RadialGradient key={i} id={`mmb-${gi}-${i}`} cx="50%" cy="50%" r="50%">
                        {/* Volle Intensität bis weit nach außen (78 %), erst
                            dann moderater Abfall – so zeigt eine große Fläche
                            maximale Sättigung, nicht nur ein Kernpunkt. Die
                            weiche Außenkante erzeugt der Blur. */}
                        <Stop offset="0%" stopColor={l.color} stopOpacity={l.centerOpacity} />
                        <Stop offset="78%" stopColor={l.color} stopOpacity={l.centerOpacity * 0.98} />
                        <Stop offset="100%" stopColor={l.color} stopOpacity={l.centerOpacity * 0.65} />
                      </RadialGradient>
                    ))}
                    <FadeMask id={`mmb-mask-${gi}`} size={SIZE} />
                  </Defs>
                  <G mask={`url(#mmb-mask-${gi})`}>
                    <G filter={`url(#mmb-blur-${gi})`}>
                      {/* Unsichtbares Full-Canvas-Rect: erweitert die
                          Bounding-Box der gefilterten Gruppe auf den ganzen
                          Canvas. Die native Filter-Region orientiert sich an
                          der BBox (filterUnits wird auf iOS nicht respektiert)
                          und würde das geblurrte Ergebnis sonst als sichtbares
                          Rechteck mitten im Blob abschneiden. */}
                      <Rect x={0} y={0} width={SIZE} height={SIZE} fill="#FFFFFF" fillOpacity={0.004} />
                      {group.map((l, i) => (
                        <Circle key={i} cx={l.cx} cy={l.cy} r={l.r} fill={`url(#mmb-${gi}-${i})`} />
                      ))}
                    </G>
                  </G>
                </Svg>
              </Animated.View>
            ))}

            {/* Schatten-Akzent unten rechts: minimal dunklerer, sehr weicher
                Fleck – zusammen mit dem Glanzpunkt entsteht der Gel-Kissen-
                Eindruck (Licht von oben links). Gleiche FadeMask wie alle
                anderen Layer. */}
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <RadialGradient id="mmb-shade" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#1F2421" stopOpacity={0.24} />
                  <Stop offset="60%" stopColor="#1F2421" stopOpacity={0.1} />
                  <Stop offset="100%" stopColor="#1F2421" stopOpacity={0} />
                </RadialGradient>
                <FadeMask id="mmb-mask-shade" size={SIZE} />
              </Defs>
              <G mask="url(#mmb-mask-shade)">
                <Circle cx={SIZE * 0.64} cy={SIZE * 0.68} r={SIZE * 0.42} fill="url(#mmb-shade)" />
              </G>
            </Svg>

            {/* Grain-Textur: statisches, gekacheltes Noise-PNG statt
                FeTurbulence (nicht nativ implementiert, rendert auf iOS
                nichts – verifiziert in react-native-svg 15.15.4). Liegt im
                selben animierten Container wie die Farbgruppen und nutzt
                DIESELBE FadeMask – Korn und Farbe verlaufen synchron ins
                Nichts, kein eigenständiges Rechteck-Overlay. */}
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <Pattern id="mmb-grain" patternUnits="userSpaceOnUse" width={128} height={128}>
                  <SvgImage href={NOISE_TEXTURE} width={128} height={128} />
                </Pattern>
                <FadeMask id="mmb-mask-grain" size={SIZE} />
              </Defs>
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={SIZE / 2}
                fill="url(#mmb-grain)"
                opacity={0.09}
                mask="url(#mmb-mask-grain)"
              />
            </Svg>

            {/* Glanzpunkt oben links: kleiner, sehr weicher heller Fleck
                simuliert Licht/Reflexion; hängt am Drift-Loop der ersten
                Gruppe und bewegt sich dezent mit. */}
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [
                    { translateX: groupTransforms[0].translateX },
                    { translateY: groupTransforms[0].translateY },
                  ],
                },
              ]}
              pointerEvents="none"
            >
              <Svg width={SIZE} height={SIZE}>
                <Defs>
                  <RadialGradient id="mmb-shine" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.6} />
                    <Stop offset="55%" stopColor="#FFFFFF" stopOpacity={0.25} />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                  <FadeMask id="mmb-mask-shine" size={SIZE} />
                </Defs>
                <G mask="url(#mmb-mask-shine)">
                  <Circle cx={SIZE * 0.36} cy={SIZE * 0.3} r={SIZE * 0.3} fill="url(#mmb-shine)" />
                </G>
              </Svg>
            </Animated.View>
          </Animated.View>
        </Pressable>
        <Text style={styles.hint}>Tippe, um zu schreiben</Text>
      </View>

      <PrivacyNote style={styles.privacy} />

      {/* Scroll-Hinweis: Der Wochenrückblick liegt unterhalb des
          bildschirmfüllenden Heros und wird sonst leicht übersehen. */}
      <Animated.View
        style={[
          styles.scrollCue,
          { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }] },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.scrollCueText}>Scroll</Text>
        <Text style={styles.scrollCueArrow}>↓</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  // Wortmarke: bewusst monochrom (Serif kursiv) – Farbe bleibt exklusiv dem
  // Blob/den Mood-Daten vorbehalten.
  brand: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 18,
    letterSpacing: 3,
    color: '#000000',
    marginTop: 2,
  },
  date: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#000000', // reines Schwarz auf reinem Weiß – maximaler Kontrast
    textTransform: 'uppercase',
    marginTop: 16,
  },
  question: {
    fontFamily: serif,
    fontSize: 23,
    lineHeight: 31,
    fontWeight: '600',
    color: '#000000',
    marginTop: 22,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  // Blob leicht oberhalb der Mitte zwischen Frage und Hinweis –
  // ausbalanciert, ohne oben zu kleben oder unten großen Leerraum zu lassen.
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -16 },
  blobBox: { width: SIZE, height: SIZE },
  hint: {
    fontSize: 13,
    color: colors.textFaint,
    marginTop: 10,
  },
  privacy: { marginTop: 14 },
  scrollCue: { alignItems: 'center', marginTop: 18 },
  // Gleiche Typo-Sprache wie die Datumszeile oben (Uppercase + Letterspacing),
  // nur gedämpft – lädt zum Scrollen ein, ohne mit dem Blob zu konkurrieren.
  scrollCueText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  scrollCueArrow: {
    fontSize: 15,
    lineHeight: 18,
    marginTop: 2,
    color: colors.textMuted,
  },
});
