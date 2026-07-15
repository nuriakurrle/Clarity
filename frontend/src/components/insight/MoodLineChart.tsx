/**
 * MoodLineChart – Stimmungsverlauf als Linien-Diagramm.
 *
 * Nutzt react-native-chart-kit (auf Basis von react-native-svg) für eine saubere
 * Bézier-Kurve mit Gitternetz, Achsen und Flächen-Verlauf. Die Stimmung wird von
 * valence (-1..+1) auf eine 0–100-Skala gebracht (50 = neutral), damit die
 * Y-Achse gut lesbar ist.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../theme/colors';

export type MoodPoint = { label: string; valence: number };

type Props = {
  data: MoodPoint[];
  height?: number;
  /** Indizes ohne sichtbaren Punkt (interpolierte Positionen ohne Eintrag). */
  hideDotsAtIndex?: number[];
};

/** '#RRGGBB' + Deckkraft → 'rgba(r,g,b,a)' (chart-kit gibt die Opacity vor). */
function rgba(hex: string, opacity = 1): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function MoodLineChart({ data, height = 200, hideDotsAtIndex }: Props) {
  const [width, setWidth] = useState(0);

  // Die Aufrufer dünnen selbst aus (leere Strings an Positionen ohne Marke).
  const labels = data.map((d) => d.label);
  // Anzeige-Werte leicht vom Rand wegpolstern (4..96): Ein Tag mit maximal
  // negativer/positiver Stimmung läge sonst exakt AUF der Rahmenlinie und
  // wäre unsichtbar – so bleibt der Punkt immer im Zeichenbereich.
  const values = data.map((d) =>
    Math.min(96, Math.max(4, Math.round(((Math.max(-1, Math.min(1, d.valence)) + 1) / 2) * 100))),
  );

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <LineChart
          data={{ labels, datasets: [{ data: values }] }}
          width={width}
          height={height}
          bezier
          fromZero
          // Y-Skala fest auf 0–100 pinnen (wie der Karten-Untertitel verspricht).
          // Ohne das kollabiert die Skala, wenn alle Tage denselben Wert haben –
          // eine flache Linie bei 0 lag dann unsichtbar auf der Grundlinie.
          fromNumber={100}
          segments={4}
          // Bewusst NICHT hidePointsAtIndex: das würde auch die X-Achsen-Labels
          // an diesen Indizes unterdrücken. Stattdessen unsichtbare Dots (r=0).
          getDotProps={(_, i) =>
            hideDotsAtIndex?.includes(i)
              ? { r: '0' }
              : { r: '4', strokeWidth: '2', stroke: colors.surface }
          }
          withVerticalLines={false}
          withHorizontalLabels={false}
          chartConfig={{
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.surface,
            decimalPlaces: 0,
            // Tinte statt Akzent-Grün: fügt sich in den Schwarz-Weiß-Look
            // der App ein, die Fläche darunter bleibt bewusst hauchzart.
            color: (o = 1) => rgba(colors.text, o),
            labelColor: (o = 1) => rgba(colors.textMuted, o),
            fillShadowGradientFrom: colors.text,
            fillShadowGradientFromOpacity: 0.08,
            fillShadowGradientTo: colors.surface,
            fillShadowGradientToOpacity: 0,
            propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '4 7' },
          }}
          style={styles.chart}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // Ohne Y-Achsen-Beschriftung den links reservierten Platz zurückholen,
  // damit die Kurve die volle Kartenbreite nutzt.
  chart: { marginLeft: -34, borderRadius: 8 },
});
