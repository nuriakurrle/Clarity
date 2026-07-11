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
import { EntryImages } from '../components/entry';
import { EntryRecord, deleteEntry, entryImageUrl, updateEntry } from '../services/api';
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
 * Überschrift + Fließtext aus dem gespeicherten Inhalt ableiten.
 *
 * Nur wenn der Eintrag eine ECHTE Titelzeile hat (kurze erste Zeile mit Text
 * darunter), gibt es eine Überschrift – sonst bleibt sie leer und der ganze
 * Inhalt ist Fließtext. Wichtig: Ansicht und Bearbeiten nutzen dieselbe
 * Aufteilung, damit beim Umschalten nichts „verschwindet" oder der Text
 * plötzlich in der Überschrift landet (keine gebastelte Kurz-Überschrift
 * aus den ersten Zeichen des Textes mehr).
 */
function splitEntry(content: string): { title: string; body: string } {
  const [firstLine, ...rest] = content.split('\n');
  const title = firstLine.trim();
  const body = rest.join('\n').trim();
  if (!body || title.length > 60) return { title: '', body: content.trim() };
  return { title, body };
}

export default function EntryDetailScreen({ entry, onClose, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    // Exakt dieselbe Aufteilung wie die Ansicht – Überschrift und Text
    // stehen beim Bearbeiten genau dort, wo sie eben noch angezeigt wurden.
    const raw = splitEntry(entry.content);
    setEditTitle(raw.title);
    setEditBody(raw.body);
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  // Löschen mit Nachfrage – entfernt den Eintrag samt Analyse-Daten in der DB
  // (DELETE /entries/{id}) und schließt danach die Vollansicht. Verlauf und
  // Kalender laden beim Schließen ohnehin neu (die Screens remounten).
  const confirmDelete = () => {
    const doDelete = async () => {
      setDeleting(true);
      try {
        await deleteEntry(entry.id);
        onClose?.();
      } catch {
        showError(
          'Der Eintrag konnte nicht gelöscht werden. Läuft das Backend (docker compose up) und bist du im selben WLAN?',
        );
        setDeleting(false);
      }
    };
    // Alert mit Buttons ist auf Web ein No-op – dort window.confirm (wie im EntryScreen)
    if (Platform.OS === 'web') {
      const confirm = (globalThis as { confirm?: (msg: string) => boolean }).confirm;
      if (!confirm || confirm('Eintrag endgültig löschen?')) doDelete();
      return;
    }
    Alert.alert('Eintrag löschen?', 'Das kann nicht rückgängig gemacht werden.', [
      { text: 'Abbrechen' },
      { text: 'Löschen', style: 'destructive', onPress: doDelete },
    ]);
  };

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
                <>
                  <TouchableOpacity
                    onPress={startEditing}
                    hitSlop={10}
                    disabled={deleting}
                    accessibilityLabel="Eintrag bearbeiten"
                  >
                    <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmDelete}
                    hitSlop={10}
                    disabled={deleting}
                    accessibilityLabel="Eintrag löschen"
                  >
                    {deleting ? (
                      <ActivityIndicator size="small" color={colors.textMuted} />
                    ) : (
                      <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </>
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
              {/* defaultValue statt value: Die Felder werden beim Umschalten in
                  den Bearbeiten-Modus frisch gemountet und garantiert mit dem
                  bestehenden Text vorbefüllt (kontrollierte Inputs zeigten auf
                  Android beim Einblenden teils leere Felder). Der State läuft
                  über onChangeText fürs Speichern weiter mit. */}
              <TextInput
                defaultValue={editTitle}
                onChangeText={setEditTitle}
                placeholder="Worum geht's?"
                placeholderTextColor={colors.textFaint}
                style={styles.titleInput}
              />
              <TextInput
                defaultValue={editBody}
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
              {title ? <Text style={styles.title}>{title}</Text> : null}
              {body ? <Text style={styles.body}>{body}</Text> : null}
              {/* Angehängte Bilder (reine Anzeige, ohne Entfernen-Kreuz) */}
              {entry.images && entry.images.length > 0 ? (
                <View style={styles.imagesWrap}>
                  <EntryImages uris={entry.images.map(entryImageUrl)} />
                </View>
              ) : null}
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
  },
  // marginTop trägt den Abstand – funktioniert mit und ohne Überschrift
  body: { fontSize: 16, lineHeight: 24, color: colors.text, marginTop: 12 },
  imagesWrap: { marginTop: 12 },
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
