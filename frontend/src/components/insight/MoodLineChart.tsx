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

type Props = { data: MoodPoint[]; height?: number };

/** '#RRGGBB' + Deckkraft → 'rgba(r,g,b,a)' (chart-kit gibt die Opacity vor). */
function rgba(hex: string, opacity = 1): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function MoodLineChart({ data, height = 200 }: Props) {
  const [width, setWidth] = useState(0);

  // Bei vielen Punkten nicht jede Beschriftung zeigen, sonst überlappt es.
  const step = Math.max(1, Math.ceil(data.length / 6));
  const labels = data.map((d, i) => (i % step === 0 ? d.label : ''));
  const values = data.map(
    (d) => Math.round(((Math.max(-1, Math.min(1, d.valence)) + 1) / 2) * 100),
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
          segments={4}
          withVerticalLines={false}
          withHorizontalLabels={false}
          chartConfig={{
            backgroundGradientFrom: colors.surface,
            backgroundGradientTo: colors.surface,
            decimalPlaces: 0,
            color: (o = 1) => rgba(colors.primary, o),
            labelColor: (o = 1) => rgba(colors.textMuted, o),
            fillShadowGradientFrom: colors.primary,
            fillShadowGradientFromOpacity: 0.2,
            fillShadowGradientTo: colors.surface,
            fillShadowGradientToOpacity: 0,
            propsForDots: { r: '4', strokeWidth: '2', stroke: colors.surface },
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
