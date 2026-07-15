/**
 * KeyboardToolbar – runde Pill-Buttons über der Tastatur (Eintrag schreiben).
 *
 * Angelehnt an klassische Notiz-Apps: „Aa" öffnet das Format-Panel
 * (Schrift, Größe, Ausrichtung, Farbe), daneben Bild hinzufügen und
 * Spracheingabe. Der Mikro-Button pulsiert während der Aufnahme; während
 * Whisper transkribiert, zeigt er einen Spinner.
 */
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { serif } from '../../theme/typography';

const NATIVE_DRIVER = Platform.OS !== 'web';

type Props = {
  formatOpen: boolean;
  onToggleFormat: () => void;
  onAddImage: () => void;
  /** Live-Foto aufnehmen (nur mobil – auf Web ausgeblendet). */
  onTakePhoto?: () => void;
  dictating: boolean;
  /** Aufnahme ist beim Transcribe-Agenten (Whisper) in Arbeit. */
  transcribing?: boolean;
  onToggleDictation: () => void;
};

export function KeyboardToolbar({
  formatOpen,
  onToggleFormat,
  onAddImage,
  onTakePhoto,
  dictating,
  transcribing,
  onToggleDictation,
}: Props) {
  // Aufnahme-Puls: der rote Mikro-Button „atmet", solange diktiert wird
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!dictating) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [dictating, pulse]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.pill, formatOpen && styles.pillActive]}
        onPress={onToggleFormat}
        activeOpacity={0.7}
        accessibilityLabel="Schrift und Layout"
      >
        <Text style={[styles.aa, formatOpen && styles.aaActive]}>Aa</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.pill}
        onPress={onAddImage}
        activeOpacity={0.7}
        accessibilityLabel="Bild hinzufügen"
      >
        <Ionicons name="image-outline" size={20} color={colors.text} />
      </TouchableOpacity>

      {/* Live-Foto: nur mobil sinnvoll (Web hat keine echte Kamera-Aufnahme). */}
      {Platform.OS !== 'web' && onTakePhoto && (
        <TouchableOpacity
          style={styles.pill}
          onPress={onTakePhoto}
          activeOpacity={0.7}
          accessibilityLabel="Foto aufnehmen"
        >
          <Ionicons name="camera-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      )}

      <Animated.View style={dictating && { transform: [{ scale: pulseScale }] }}>
        <TouchableOpacity
          style={[styles.pill, dictating && styles.pillRecording]}
          onPress={onToggleDictation}
          activeOpacity={0.7}
          disabled={transcribing}
          accessibilityLabel={dictating ? 'Aufnahme beenden' : 'Aufnahme starten'}
        >
          {transcribing ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Ionicons
              name={dictating ? 'mic' : 'mic-outline'}
              size={20}
              color={dictating ? '#fff' : colors.text}
            />
          )}
        </TouchableOpacity>
      </Animated.View>

      {dictating && <Text style={styles.recordingHint}>Ich höre zu …</Text>}
      {transcribing && <Text style={styles.transcribingHint}>Transkribiere …</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  pill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pillActive: { backgroundColor: colors.text, borderColor: colors.text },
  pillRecording: { backgroundColor: '#D9534F', borderColor: '#D9534F' },
  aa: { fontFamily: serif, fontSize: 17, fontWeight: '700', color: colors.text },
  aaActive: { color: '#fff' },
  recordingHint: { fontSize: 13, color: '#D9534F', fontWeight: '600' },
  transcribingHint: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
