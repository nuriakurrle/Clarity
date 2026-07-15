/**
 * SettingsScreen - Steuerung der lokalen Benachrichtigungen.
 *
 * Ein Hauptschalter plus ein Schalter je Meldungstyp und die Uhrzeit des
 * taeglichen Reminders. Jede Aenderung wird sofort gespeichert
 * (notificationSettings.ts) und die geplanten Notifications neu aufgesetzt
 * (refreshScheduledNotifications), damit Reminder/Stupser dem Stand entsprechen.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DEFAULT_SETTINGS,
  NotificationSettings,
  getNotificationSettings,
  updateNotificationSettings,
} from '../services/notificationSettings';
import { ensureNotificationPermission, refreshScheduledNotifications } from '../services/notifications';
import { colors } from '../theme/colors';
import { serif } from '../theme/typography';

type Props = { onClose: () => void };

const pad = (n: number) => n.toString().padStart(2, '0');

export default function SettingsScreen({ onClose }: Props) {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    getNotificationSettings().then(setSettings);
  }, []);

  // Aendert Felder, speichert und plant Reminder/Stupser neu.
  const apply = async (patch: Partial<NotificationSettings>) => {
    const next = await updateNotificationSettings(patch);
    setSettings(next);
    if (next.enabled) await ensureNotificationPermission();
    await refreshScheduledNotifications();
  };

  const shiftHour = (delta: number) =>
    apply({ reminderHour: (settings.reminderHour + delta + 24) % 24 });
  const shiftMinute = (delta: number) =>
    apply({ reminderMinute: (settings.reminderMinute + delta + 60) % 60 });

  const master = settings.enabled;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.back}>Fertig</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Benachrichtigungen</Text>
        <Text style={styles.intro}>
          Clarity meldet sich nur lokal auf diesem Geraet - ruhig und nur, wenn es etwas zu
          sagen gibt.
        </Text>

        <Row
          label="Benachrichtigungen"
          hint="Hauptschalter fuer alle Meldungen"
          value={master}
          onValueChange={(v) => apply({ enabled: v })}
        />

        <View style={[styles.group, !master && styles.groupDisabled]}>
          <SectionTitle text="Von den Agenten" />
          <Row
            label="Neues Muster"
            hint="Wenn ein wiederkehrendes Thema auftaucht"
            value={settings.newPattern}
            disabled={!master}
            onValueChange={(v) => apply({ newPattern: v })}
          />
          <Row
            label="Analyse fertig"
            hint="Wenn dein Eintrag ausgewertet wurde"
            value={settings.analysisDone}
            disabled={!master}
            onValueChange={(v) => apply({ analysisDone: v })}
          />
          <Row
            label="Wochenrueckblick"
            hint="Wenn deine Woche zusammengefasst ist"
            value={settings.digestReady}
            disabled={!master}
            onValueChange={(v) => apply({ digestReady: v })}
          />
        </View>

        <View style={[styles.group, !master && styles.groupDisabled]}>
          <SectionTitle text="Erinnerungen" />
          <Row
            label="Taeglicher Reminder"
            hint="Eine sanfte Erinnerung zum Schreiben"
            value={settings.dailyReminder}
            disabled={!master}
            onValueChange={(v) => apply({ dailyReminder: v })}
          />

          {master && settings.dailyReminder ? (
            <View style={styles.timeRow}>
              <Text style={styles.timeLabel}>Uhrzeit</Text>
              <View style={styles.stepper}>
                <Stepper onPress={() => shiftHour(-1)} label="-" />
                <Text style={styles.time}>{pad(settings.reminderHour)}</Text>
                <Stepper onPress={() => shiftHour(1)} label="+" />
                <Text style={styles.colon}>:</Text>
                <Stepper onPress={() => shiftMinute(-5)} label="-" />
                <Text style={styles.time}>{pad(settings.reminderMinute)}</Text>
                <Stepper onPress={() => shiftMinute(5)} label="+" />
              </View>
            </View>
          ) : null}

          <Row
            label="Stupser bei Inaktivitaet"
            hint={`Meldung nach ${settings.inactivityDays} Tagen ohne Eintrag`}
            value={settings.inactivityNudge}
            disabled={!master}
            onValueChange={(v) => apply({ inactivityNudge: v })}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function Row({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, disabled && styles.dim]}>{label}</Text>
        <Text style={[styles.rowHint, disabled && styles.dim]}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function Stepper({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} style={styles.stepBtn} hitSlop={8}>
      <Text style={styles.stepBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 4 },
  back: { fontSize: 16, color: colors.primary, fontWeight: '600' },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { fontSize: 30, fontFamily: serif, color: colors.text, marginTop: 8 },
  intro: { fontSize: 15, color: colors.textMuted, marginTop: 8, marginBottom: 20, lineHeight: 21 },

  group: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginTop: 16,
  },
  groupDisabled: { opacity: 0.5 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
  },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 16, color: colors.text },
  rowHint: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  dim: { color: colors.textFaint },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingLeft: 4,
  },
  timeLabel: { fontSize: 15, color: colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, color: colors.primary, lineHeight: 22 },
  time: { fontSize: 20, fontVariant: ['tabular-nums'], color: colors.text, width: 34, textAlign: 'center' },
  colon: { fontSize: 20, color: colors.text, marginHorizontal: 2 },
});
