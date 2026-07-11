/**
 * EntryDetailScreen – Vollansicht eines gespeicherten Tagebucheintrags.
 *
 * Wird aus dem Verlauf (SearchScreen) und dem Kalender-Detailbereich
 * geöffnet, wenn ein Eintrag angetippt wird. Aufbau orientiert sich am
 * EntryScreen (Datum-Kopfzeile + X, Serif-Titel, Fließtext), ist aber
 * bewusst read-only: Datum/Uhrzeit kommen aus `created_at`, dazu die
 * Stimmung aus der Sentiment-Analyse (farbiger Punkt + Label) und –
 * falls vorhanden – die erkannte Hauptemotion.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EntryRecord } from '../services/api';
import { colors, moodColor, moodLabel, valenceToMoodLevel } from '../theme/colors';
import { serif } from '../theme/typography';

type Props = { entry: EntryRecord; onClose?: () => void };

/** created_at ("YYYY-MM-DD HH:MM:SS", UTC) → lokales Date. */
function parseCreatedAt(createdAt: string): Date {
  return new Date(`${createdAt.replace(' ', 'T')}Z`);
}

/**
 * Überschrift + Fließtext aus dem gespeicherten Inhalt ableiten –
 * dieselbe Logik wie in der Verlaufsliste (SearchScreen), damit ein
 * Eintrag in Liste und Vollansicht identisch betitelt ist.
 */
function splitEntry(content: string): { title: string; body: string } {
  const [firstLine, ...rest] = content.split('\n');
  let title = firstLine.trim();
  let body = rest.join('\n').trim();
  if (!body || title.length > 60) {
    title = title.length > 48 ? `${title.slice(0, 48).trimEnd()}…` : title;
    body = content.trim();
  }
  return { title, body };
}

export default function EntryDetailScreen({ entry, onClose }: Props) {
  const { dateLabel, timeLabel } = useMemo(() => {
    const d = parseCreatedAt(entry.created_at);
    return {
      dateLabel: new Intl.DateTimeFormat('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(d),
      timeLabel: new Intl.DateTimeFormat('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(d),
    };
  }, [entry.created_at]);

  const { title, body } = useMemo(() => splitEntry(entry.content), [entry.content]);
  const level = entry.valence != null ? valenceToMoodLevel(entry.valence) : null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.date}>
            {dateLabel} · {timeLabel}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Eintrag schließen">
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Stimmung aus der Analyse – gleicher Badge-Look wie im Verlauf */}
        {level ? (
          <View style={styles.moodRow}>
            <View style={[styles.moodDot, { backgroundColor: moodColor[level] }]} />
            <Text style={styles.moodText}>{moodLabel[level]}</Text>
            {entry.primary_emotion ? (
              <Text style={styles.emotionText}>· {entry.primary_emotion}</Text>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontSize: 13, color: colors.warm, fontWeight: '600' },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  moodDot: { width: 10, height: 10, borderRadius: 5 },
  moodText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  emotionText: { fontSize: 13, color: colors.textMuted },
  title: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 10,
    marginBottom: 12,
  },
  body: { fontSize: 16, lineHeight: 24, color: colors.text },
  bottomSpace: { height: 24 },
});
