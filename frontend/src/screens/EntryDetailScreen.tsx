/**
 * EntryDetailScreen – Vollansicht eines gespeicherten Tagebucheintrags.
 *
 * Wird aus dem Verlauf (SearchScreen) und dem Kalender-Detailbereich
 * geöffnet, wenn ein Eintrag angetippt wird. Aufbau orientiert sich am
 * EntryScreen (Datum-Kopfzeile + X, Serif-Titel, Fließtext): Datum/Uhrzeit
 * kommen aus `created_at`, dazu die Stimmung aus der Sentiment-Analyse
 * (farbiger Punkt + Label) und – falls vorhanden – die Hauptemotion.
 *
 * Bearbeiten: Der Stift schaltet Titel + Text auf Eingabefelder um.
 * „Speichern" schickt den neuen Text per PUT /entries/{id} an den
 * Sentiment-Agenten (Save-first, die Analyse läuft im Hintergrund neu)
 * und meldet den aktualisierten Eintrag über `onUpdated` an App.tsx –
 * so zeigen Detailansicht und Listen sofort den neuen Stand.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { EntryRecord, updateEntry } from '../services/api';
import { colors, moodColor, moodLabel, valenceToMoodLevel } from '../theme/colors';
import { serif } from '../theme/typography';

type Props = {
  entry: EntryRecord;
  onClose?: () => void;
  /** Meldet den gespeicherten Stand nach dem Bearbeiten (siehe App.tsx). */
  onUpdated?: (entry: EntryRecord) => void;
};

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

/**
 * Roh-Aufteilung fürs Bearbeiten: erste Zeile = Titel, Rest = Text –
 * OHNE die Anzeige-Kürzung von splitEntry, damit beim Editieren nichts
 * vom Originaltext verloren geht.
 */
function splitForEdit(content: string): { title: string; body: string } {
  const [firstLine, ...rest] = content.split('\n');
  return { title: firstLine.trim(), body: rest.join('\n').trim() };
}

export default function EntryDetailScreen({ entry, onClose, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);

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

  const showError = (message: string) => {
    if (Platform.OS === 'web') {
      (globalThis as { alert?: (msg: string) => void }).alert?.(message);
    } else {
      Alert.alert('Bearbeiten', message);
    }
  };

  const startEditing = () => {
    const raw = splitForEdit(entry.content);
    setEditTitle(raw.title);
    setEditBody(raw.body);
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveEdit = async () => {
    // Gleiches Format wie beim Anlegen im EntryScreen: Titel + Leerzeile + Text
    const text = [editTitle.trim(), editBody.trim()].filter(Boolean).join('\n\n');
    if (!text) {
      showError('Der Eintrag darf nicht leer sein.');
      return;
    }
    setSaving(true);
    try {
      await updateEntry(entry.id, text);
      // Stimmungswerte bleiben vorerst die alten – die Analyse des neuen
      // Texts läuft im Backend als Hintergrund-Task.
      onUpdated?.({ ...entry, content: text });
      setEditing(false);
    } catch {
      showError(
        'Die Änderung konnte nicht gespeichert werden. Läuft das Backend (docker compose up) und bist du im selben WLAN?',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Text style={styles.date}>
              {dateLabel} · {timeLabel}
            </Text>
            <View style={styles.headerIcons}>
              {!editing ? (
                <TouchableOpacity
                  onPress={startEditing}
                  hitSlop={10}
                  accessibilityLabel="Eintrag bearbeiten"
                >
                  <Ionicons name="create-outline" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={editing ? cancelEditing : onClose}
                hitSlop={10}
                accessibilityLabel={editing ? 'Bearbeiten abbrechen' : 'Eintrag schließen'}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stimmung aus der Analyse – gleicher Badge-Look wie im Verlauf */}
          {!editing && level ? (
            <View style={styles.moodRow}>
              <View style={[styles.moodDot, { backgroundColor: moodColor[level] }]} />
              <Text style={styles.moodText}>{moodLabel[level]}</Text>
              {entry.primary_emotion ? (
                <Text style={styles.emotionText}>· {entry.primary_emotion}</Text>
              ) : null}
            </View>
          ) : null}

          {editing ? (
            <>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Worum geht's?"
                placeholderTextColor={colors.textFaint}
                style={styles.titleInput}
              />
              <TextInput
                value={editBody}
                onChangeText={setEditBody}
                placeholder="Dein Eintrag …"
                placeholderTextColor={colors.textFaint}
                style={styles.bodyInput}
                multiline
                textAlignVertical="top"
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>{title}</Text>
              {body ? <Text style={styles.body}>{body}</Text> : null}
            </>
          )}

          <View style={styles.bottomSpace} />
        </ScrollView>

        {/* Fußzeile wie im EntryScreen – nur im Bearbeiten-Modus */}
        {editing ? (
          <View style={styles.footer}>
            <TouchableOpacity onPress={cancelEditing} hitSlop={8} disabled={saving}>
              <Text style={styles.cancelText}>Abbrechen</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveEdit}
              activeOpacity={0.8}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Speichern</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Web zeichnet um fokussierte Eingabefelder einen schwarzen Standard-Rahmen –
// hier unerwünscht, die Felder sollen rahmenlos wirken (wie im EntryScreen)
const noOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  // Neutral wie die Datumszeilen in Verlauf/Kalender (früher: Orange/warm)
  date: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
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
  // Eingabefelder im Look der Anzeige (Titel serif, Text wie body)
  titleInput: {
    fontFamily: serif,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 10,
    marginBottom: 12,
    padding: 0,
    ...noOutline,
  },
  bodyInput: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
    padding: 0,
    minHeight: 160,
    ...noOutline,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  saveBtn: {
    backgroundColor: colors.text,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bottomSpace: { height: 24 },
});
