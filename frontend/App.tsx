/**
 * Root-Navigation: 4 Bottom-Tabs (Start, Verlauf, Einblicke, Kalender)
 * + zentraler FAB für einen neuen Eintrag.
 *
 * Bewusst einfach (useState statt einer Navigationsbibliothek) – passend
 * zu den aktuell rein statischen Screens. Reicht das Routing-Bedürfnis
 * später darüber hinaus, kann dies durch z. B. React Navigation ersetzt
 * werden, ohne dass sich an den Screens unter `src/screens/` etwas ändert.
 *
 * Einblicke & Kalender sind aktuell bewusst leere Screens (siehe dort) –
 * nur die Tabs/das Routing dorthin existieren schon.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { BottomNav, TabKey } from './src/components';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import EntryScreen from './src/screens/EntryScreen';
import EntryDetailScreen from './src/screens/EntryDetailScreen';
import InsightScreen from './src/screens/InsightScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import { EntryRecord } from './src/services/api';
import { colors } from './src/theme/colors';

export default function App() {
  const [tab, setTab] = useState<TabKey>('home');
  const [showEntry, setShowEntry] = useState(false);
  // Angetippter Eintrag aus Verlauf/Kalender → Vollansicht (read-only)
  const [viewEntry, setViewEntry] = useState<EntryRecord | null>(null);

  const openEntry = () => {
    setViewEntry(null);
    setShowEntry(true);
  };
  const closeEntry = () => setShowEntry(false);

  const changeTab = (key: TabKey) => {
    setShowEntry(false);
    setViewEntry(null);
    setTab(key);
  };

  let screen: React.ReactNode;
  if (showEntry) {
    screen = <EntryScreen onDone={closeEntry} />;
  } else if (viewEntry) {
    screen = (
      <EntryDetailScreen
        entry={viewEntry}
        onClose={() => setViewEntry(null)}
        onUpdated={setViewEntry}
      />
    );
  } else if (tab === 'home') {
    screen = <HomeScreen onWrite={openEntry} />;
  } else if (tab === 'search') {
    screen = <SearchScreen onOpenEntry={setViewEntry} />;
  } else if (tab === 'insight') {
    screen = <InsightScreen />;
  } else {
    screen = <CalendarScreen onOpenEntry={setViewEntry} />;
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="dark" />

        <View style={styles.screen}>{screen}</View>

        {/* Beim Schreiben ausgeblendet: Fokus-Modus ohne Tabs und redundanten „+"-FAB */}
        {!showEntry && <BottomNav active={tab} onChange={changeTab} onPressAdd={openEntry} />}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
});
