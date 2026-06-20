/**
 * CalendarScreen – bewusst noch leer.
 *
 * Existiert nur, damit der Tab in der Navigation funktioniert. Der Screen
 * wird erst gebaut, wenn die lokale Datenbank mit echten Einträgen
 * angebunden ist.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export default function CalendarScreen() {
  return <SafeAreaView style={styles.safe} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
});
