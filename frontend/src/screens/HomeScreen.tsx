/**
 * HomeScreen – statisches Gerüst, bewusst ohne Inhalt.
 *
 * Zeigt nur die Struktur des wöchentlichen Rückblicks (Abschnitts-
 * überschriften), noch ohne Daten – die App hat ja noch keine
 * Tagebucheinträge. Sobald die lokale Datenbank befüllt ist und die
 * Sentiment-/Pattern-/Digest-Agenten laufen, füllen sich diese
 * Abschnitte mit echtem Inhalt (Bausteine dafür liegen bereits unter
 * `../components/home`, sind hier aber noch nicht verdrahtet).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SectionLabel } from '../components';
import { colors } from '../theme/colors';
import { serif } from '../theme/typography';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Diese Woche</Text>
          <Text style={styles.bannerSubtitle}>Ein sanfter Rückblick…</Text>
        </View>

        <View style={styles.body}>
          <SectionLabel text="Tonverlauf" />
          <View style={styles.spacer32}>
            <SectionLabel text="Wiederkehrende Themen" />
          </View>
          <View style={styles.spacer32}>
            <SectionLabel text="Eine Frage zum Weitertragen" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },
  banner: { backgroundColor: colors.warmSoft, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  bannerTitle: { fontFamily: serif, fontSize: 32, fontWeight: '700', color: colors.text },
  bannerSubtitle: { fontSize: 15, color: colors.text, opacity: 0.6, marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 24 },
  spacer32: { marginTop: 32 },
});
