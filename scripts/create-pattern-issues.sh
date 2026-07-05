#!/usr/bin/env bash
#
# Legt alle 7 GitHub-Issues fuer den Pattern-Agent an (Repo nuriakurrle/Clarity).
#
# Einmalige Voraussetzung (nur beim ersten Mal noetig):
#     gh auth login      # GitHub.com  ->  HTTPS  ->  Browser  ->  einloggen
#
# Danach ausfuehren:
#     bash scripts/create-pattern-issues.sh
#
set -euo pipefail

REPO="nuriakurrle/Clarity"
export PATH="/opt/homebrew/bin:$PATH"

# Label anlegen (Fehler ignorieren, falls es schon existiert)
gh label create "pattern-agent" --repo "$REPO" --color "5319e7" \
  --description "Pattern-Agent (Katharina)" 2>/dev/null || true

new_issue() {
  local title="$1"; local body="$2"; shift 2
  gh issue create --repo "$REPO" --title "$title" --body "$body" "$@"
  echo "angelegt: $title"
}

new_issue "Pattern Agent: echten CrewAI-Agent definieren (statt Stub)" \
"## Ziel
agent_pattern/agent.py war nur ein 4-Zeilen-Platzhalter. Vollwertiger CrewAI-Agent
mit klarer role/goal/backstory (analog agent_sentiment).

## Aufgaben
- [x] pattern_agent mit role/goal/backstory (Themen, Personen, Situationen, Trigger, Sprachmuster - Beobachtungen statt Bewertungen)
- [x] allow_delegation=False, verbose=True
- [x] build_pattern_prompt() nutzt die Agenten-Persona im LLM-Aufruf

## Akzeptanzkriterien
- Vollwertiger Agent, aus main.py aufgerufen, kein toter Code." \
  --label "pattern-agent"

new_issue "Pattern Agent: Eintraege aus der Datenbank analysieren (ueber Zeitraum)" \
"## Ziel
Muster across entries over time erkennen. Statt Request-Body die echten Eintraege
der letzten N Tage aus der geteilten DB lesen.

## Aufgaben
- [x] POST /detect-patterns liest ohne Body die letzten days Tage (get_entries_since)
- [x] Sentiments als Zusatzkontext fuer Trigger (get_sentiments_since)
- [x] insufficient_data sauber behandeln

## Akzeptanzkriterien
- Aufruf ohne Body analysiert die letzten N Tage aus der DB; save_pattern bleibt." \
  --label "pattern-agent"

new_issue "Pattern Agent: strukturierte Mustererkennung mit robustem JSON" \
"## Ziel
Reichhaltigere, verlaessliche Muster mit strengem JSON-Prompt (Vorbild Sentiment).

## Aufgaben
- [x] JSON-Schema: recurring_themes, recurring_people, situations, triggers, language_shifts, mood_trend, summary
- [x] Ollama mit format json + niedriger Temperatur
- [x] Normalisierung + Fallback
- [x] Speichern in pattern_detection (DB-Migration ergaenzt neue Spalten)

## Akzeptanzkriterien
- Nachvollziehbare, neutrale Muster; keine Platzhalter." \
  --label "pattern-agent"

new_issue "Pattern Agent: GET-Endpoint fuer die zuletzt erkannten Muster" \
"## Ziel
Frontend und Digest-Agent muessen die gespeicherten Muster abrufen koennen.

## Aufgaben
- [x] GET /patterns/latest (neuester Eintrag aus pattern_detection, JSON dekodiert)
- [x] get_latest_pattern() in shared/database.py

## Akzeptanzkriterien
- curl http://localhost:8002/patterns/latest liefert die letzten Muster als JSON." \
  --label "pattern-agent"

new_issue "Frontend: Muster & Trigger des Pattern-Agents im InsightScreen anzeigen" \
"## Ziel
Der Pattern-Agent (Port 8002) war im Frontend unsichtbar. Eigene Anzeige im InsightScreen.

## Aufgaben
- [x] api.ts: pattern: 8002 + fetchLatestPatterns() + PatternResult-Typ
- [x] InsightScreen: Karte Wiederkehrende Muster liest aus dem Pattern-Agent
      (Themen/Personen als Tags, Trigger als Ausloeser -> Reaktion)

## Akzeptanzkriterien
- Echte Muster/Trigger sichtbar; Agent in die App eingebunden." \
  --label "pattern-agent"

new_issue "Mobile Feature: Push-Notification bei neu erkanntem Trigger/Muster" \
"## Ziel
Mobilspezifische Funktion (Kriterium 3): lokale Push-Benachrichtigung, wenn der
Pattern-Agent ein neues wiederkehrendes Muster / einen Trigger erkennt.

## Aufgaben
- [ ] expo-notifications einbinden + Berechtigungen anfragen
- [ ] Nach fetchLatestPatterns() mit zuletzt gesehenem Stand vergleichen (AsyncStorage)
- [ ] Lokale Notification bei neuem Muster ausloesen
- [ ] Auf echtem Geraet testen + Screenshot fuers Taskboard

## Akzeptanzkriterien
- Neu erkanntes Muster fuehrt zu sichtbarer Push-Benachrichtigung." \
  --label "pattern-agent"

new_issue "Doku & Reflexion: Pattern Agent dokumentieren" \
"## Ziel
Dokumentation fuer die Abgabe (Kriterium 8).

## Aufgaben
- [ ] README-Abschnitt Pattern Agent: Zweck, Endpoints, lokale Inbetriebnahme, Beispiel-curl
- [ ] Architektur-Notiz: Tabelle pattern_detection, Zusammenspiel mit Digest
- [ ] Screenshots (InsightScreen-Sektion + Push)
- [ ] Individuelle Reflexion (300-400 Woerter)

## Akzeptanzkriterien
- Jemand anderes kann den Agenten anhand der Doku allein starten und testen." \
  --label "pattern-agent"

echo ""
echo "Fertig. Alle Issues liegen jetzt unter https://github.com/${REPO}/issues"
