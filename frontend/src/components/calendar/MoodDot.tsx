/** Farbiger Stimmungs-Punkt – im Kalender, in der Legende usw. */
import React from 'react';
import { View } from 'react-native';
import { moodColor, MoodLevel } from '../../theme/colors';

type Props = { level: MoodLevel; size?: number };

export function MoodDot({ level, size = 6 }: Props) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: moodColor[level],
      }}
    />
  );
}
