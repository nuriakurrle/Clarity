import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const NATIVE_DRIVER = Platform.OS !== 'web';

type Props = {
  label: string;
  color?: string;
  compact?: boolean;
};

export function LoadingPulse({ label, color = colors.warm, compact = false }: Props) {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const sequence = Animated.loop(
      Animated.stagger(
        140,
        dots.map((dot) =>
          Animated.sequence([
            Animated.timing(dot, {
              toValue: 1,
              duration: 260,
              easing: Easing.out(Easing.quad),
              useNativeDriver: NATIVE_DRIVER,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 260,
              easing: Easing.in(Easing.quad),
              useNativeDriver: NATIVE_DRIVER,
            }),
          ]),
        ),
      ),
    );

    sequence.start();
    return () => sequence.stop();
  }, [dots]);

  return (
    <View style={[styles.row, compact ? styles.rowCompact : null]}>
      <Text style={[styles.label, compact ? styles.labelCompact : null, { color }]}>{label}</Text>
      <View style={styles.dots}>
        {dots.map((dot, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: color,
                opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                transform: [
                  {
                    scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.18] }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  rowCompact: {
    gap: 8,
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 12,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
});