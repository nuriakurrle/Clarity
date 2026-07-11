/**
 * Bottom-Tab-Leiste mit 4 Tabs + zentralem FAB ("Neuer Eintrag").
 * Der FAB überlappt die Leiste und ist nicht Teil der 4 Tabs.
 */
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

// Dunkle Tab-Bar: schwarzer Grund, weiße Icons (inaktiv gedimmt),
// FAB als weißer Kreis mit dunklem Plus für maximalen Kontrast.
const NAV_BG = '#111111';
const NAV_ICON_ACTIVE = '#FFFFFF';
const NAV_ICON_INACTIVE = 'rgba(255,255,255,0.55)';

export type TabKey = 'home' | 'search' | 'insight' | 'calendar';
export type ActiveKey = TabKey | 'entry';

type Tab = {
  key: TabKey;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
};

const LEFT_TABS: Tab[] = [
  { key: 'home', icon: 'home-outline', iconActive: 'home' },
  { key: 'search', icon: 'time-outline', iconActive: 'time' },
];
const RIGHT_TABS: Tab[] = [
  { key: 'insight', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { key: 'calendar', icon: 'calendar-outline', iconActive: 'calendar' },
];

type Props = {
  active: ActiveKey;
  onChange: (key: TabKey) => void;
  onPressAdd: () => void;
};

export function BottomNav({ active, onChange, onPressAdd }: Props) {
  const handlePressAdd = () => {
    // Kurzes haptisches Feedback beim Öffnen des Eintrag-Editors; fire-and-forget,
    // auf Geräten ohne Vibrationsmotor schlägt das Promise still fehl.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    onPressAdd();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {LEFT_TABS.map((tab) => (
          <TabButton key={tab.key} tab={tab} active={active === tab.key} onPress={() => onChange(tab.key)} />
        ))}

        <View style={styles.fabSlot} />

        {RIGHT_TABS.map((tab) => (
          <TabButton key={tab.key} tab={tab} active={active === tab.key} onPress={() => onChange(tab.key)} />
        ))}
      </View>

      <View style={styles.fabWrap}>
        <TouchableOpacity style={styles.fab} onPress={handlePressAdd} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color={NAV_BG} />
        </TouchableOpacity>
        <View style={[styles.dot, { opacity: active === 'entry' ? 1 : 0 }]} />
      </View>
    </View>
  );
}

function TabButton({ tab, active, onPress }: { tab: Tab; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.7}>
      <Ionicons
        name={active ? tab.iconActive : tab.icon}
        size={24}
        color={active ? NAV_ICON_ACTIVE : NAV_ICON_INACTIVE}
      />
      <View style={[styles.dot, { opacity: active ? 1 : 0 }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: NAV_BG },
  // paddingBottom deckt den Home-Indicator-Bereich ab, damit die schwarze
  // Bar sauber bis zum unteren Rand läuft.
  bar: { flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingBottom: 24 },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  fabSlot: { flex: 1 },
  fabWrap: { position: 'absolute', top: -22, left: 0, right: 0, alignItems: 'center', gap: 6, pointerEvents: 'box-none' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NAV_ICON_ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: NAV_ICON_ACTIVE },
});
