/**
 * PatternThread – der "Faden" des Pattern-Agents: eine geschwungene Linie mit
 * Punkten, die sich beim Öffnen selbst zeichnet (Metapher für verbundene Muster).
 */
import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors } from '../../theme/colors';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const WIDTH = 240;
const HEIGHT = 44;
const PATH = 'M6,30 C50,6 92,6 130,24 S196,40 234,14';
const LENGTH = 320; // >= tatsächliche Pfadlänge; genügt für den Zeichen-Effekt
const DOTS = [
  { cx: 6, cy: 30 },
  { cx: 130, cy: 24 },
  { cx: 234, cy: 14 },
];

export function PatternThread() {
  const draw = useRef(new Animated.Value(1)).current; // 1 = unsichtbar
  const dots = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(draw, { toValue: 0, duration: 1100, useNativeDriver: true }),
      Animated.timing(dots, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [draw, dots]);

  const dashoffset = draw.interpolate({ inputRange: [0, 1], outputRange: [0, LENGTH] });

  return (
    <Svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
      <AnimatedPath
        d={PATH}
        stroke={colors.textFaint}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={LENGTH}
        strokeDashoffset={dashoffset}
      />
      {DOTS.map((d, i) => (
        <AnimatedCircle key={i} cx={d.cx} cy={d.cy} r={4} fill={colors.warm} opacity={dots} />
      ))}
    </Svg>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
