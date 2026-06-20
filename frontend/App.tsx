/**
 * TEMPORÄRER Vorschau-Harness – NICHT die finale Navigation!
 *
 * Dient nur dazu, die beiden statischen Screens (Insight & Kalender) lokal
 * anzusehen, solange das richtige Routing noch nicht steht.
 * Sobald wir das Routing (z. B. expo-router / Bottom-Tabs) gemeinsam
 * einrichten, wird diese Datei durch die echte Navigation ersetzt – die
 * Screens unter `src/screens/` bleiben unverändert und werden dort
 * einfach importiert.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import InsightScreen from './src/screens/InsightScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import { colors } from './src/theme/colors';

type Tab = 'insight' | 'calendar';

export default function App() {
  const [tab, setTab] = useState<Tab>('insight');

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <View style={styles.screen}>
        {tab === 'insight' ? <InsightScreen /> : <CalendarScreen />}
      </View>

      {/* Provisorische Umschaltung – ersetzt durch echte Tab-Navigation */}
      <View style={styles.switcher}>
        <TouchableOpacity
          style={[styles.switchItem, tab === 'insight' && styles.switchActive]}
          onPress={() => setTab('insight')}
        >
          <Text
            style={[
              styles.switchText,
              tab === 'insight' && styles.switchTextActive,
            ]}
          >
            Einblicke
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.switchItem, tab === 'calendar' && styles.switchActive]}
          onPress={() => setTab('calendar')}
        >
          <Text
            style={[
              styles.switchText,
              tab === 'calendar' && styles.switchTextActive,
            ]}
          >
            Kalender
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
  switcher: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingBottom: 24,
    paddingTop: 8,
  },
  switchItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  switchActive: {},
  switchText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  switchTextActive: { color: colors.primary, fontWeight: '700' },
});
