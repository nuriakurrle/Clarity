Mobile Anwendungen SS26 

# Clarity: Privacy-First AI Journaling App

## Ziel
Clarity ist eine Journaling-App, die dir hilft, Gedanken festzuhalten, Muster zu erkennen und deine emotionale Entwicklung besser zu verstehen. Alles passiert lokal auf dem Gerät – ohne Cloud und ohne Zugriff auf deine Daten von außen.

## Vision
Journaling soll nicht nur Dokumentation sein, sondern Reflexion ermöglichen. Clarity unterstützt dich dabei, Zusammenhänge zwischen Gedanken, Emotionen und Verhalten über Zeit hinweg zu erkennen.

---

## Privacy First
- Alle Einträge werden lokal gespeichert
- Keine Cloud-Synchronisation persönlicher Inhalte
- Keine Weitergabe von Daten an Dritte
- Transparente, lokale Analyse

---

## Features

### Journaling
Freies Schreiben ohne Strukturzwang. Gedanken, Erlebnisse und Emotionen können jederzeit festgehalten werden.

### Reflection Prompts
Gezielte Fragen unterstützen tiefere Reflexion, z. B. über Stimmung, Auslöser und wiederkehrende Gedanken.

### Pattern Agent
Analysiert langfristige Einträge und erkennt wiederkehrende Muster wie:
- wiederkehrende Themen und Gedanken
- Auslöser für Stress oder positive Zustände
- Verbindungen zwischen Ereignissen und Verhalten

### Sentiment Agent
Analysiert emotionale Entwicklungen über Zeit:
- Stimmungstrends
- emotionale Hoch- und Tiefphasen
- Veränderungen im Ausdruck und in der Sprache

### Weekly Digest
Wöchentliche Zusammenfassung der wichtigsten Erkenntnisse:
- Highlights der Woche
- emotionale Entwicklung
- erkannte Muster
- reflektierende Fragen für die nächste Woche

---

## Architektur
Lokale Verarbeitung von Daten mit optionalen AI-Modulen für Pattern- und Sentiment-Analyse. Fokus auf Datenschutz, Einfachheit und langfristige Nutzbarkeit.

---

## App starten

### Voraussetzungen
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (für das Backend)
- [Node.js](https://nodejs.org/) inkl. npm (für das Frontend)
- Expo Go auf dem Handy (optional, zum Testen auf dem Gerät)

### Schnellstart zum Testen/Korrigieren

Drei Befehle, danach ist die App mit Demo-Daten voll benutzbar:

```bash
docker compose up --build -d              # 1. Backend (erster Start lädt Modelle, ~5–10 min)
docker compose --profile demo up seed     # 2. Demo-Daten einspielen (~7 Monate Einträge)
cd frontend && npm install && npm start   # 3. App starten (w = Web, oder QR-Code mit Expo Go)
```

Die Demo-Daten füllen Stimmungsverlauf, Key Themes, Kennzahlen und den
Wochenrückblick sofort – ohne sie startet die App mit einem leeren Tagebuch,
und die Insights entstehen erst nach eigenen Einträgen. Das Einspielen
passiert bewusst **nur** über diesen expliziten Befehl (Privacy First: echte
Nutzer bekommen nie automatisch fremde Einträge).

Beim Testen auf dem Handy müssen Handy und Rechner im **selben WLAN** sein.
Wenn die App „Backend nicht erreichbar" meldet: läuft Docker (`docker compose ps`)?

### 1. Backend starten (Docker)

```bash
docker compose up --build
```

Das startet Ollama plus alle fünf Agenten. Beim ersten Start werden die
LLM-Modelle (`llama3.2:1b`/`3b`) und das Whisper-Modell automatisch
heruntergeladen – das dauert einmalig ein paar Minuten.

| Service          | Port  |
| ---------------- | ----- |
| Sentiment Agent  | 8001  |
| Pattern Agent    | 8002  |
| Prompt Agent     | 8003  |
| Digest Agent     | 8004  |
| Transcribe Agent | 8005  |
| Ollama           | 11435 |

### 2. Frontend starten (Expo)

```bash
cd frontend
npm install
npm start        # danach a = Android, i = iOS, w = Web
```

Zum Testen auf dem Handy: QR-Code mit Expo Go scannen. Handy und
Entwicklungsrechner müssen im **selben WLAN** sein – die App leitet die
Backend-Adresse automatisch aus der Expo-Verbindung ab.

### Backend lokal ohne Docker (optional)

Für lokale Entwicklung lassen sich alle Agent-Abhängigkeiten mit einem
einzigen Befehl installieren:

```bash
pip install -r backend/requirements.txt
```

Danach einen Agenten direkt starten, z. B.:

```bash
cd backend/agent_sentiment
python main.py
```

Dafür muss Ollama lokal auf Port 11434 laufen (`ollama serve`) und die
Modelle müssen gezogen sein (`ollama pull llama3.2:3b`).

> **Hinweis:** Alle Agenten teilen sich ein Docker-Image
> (`backend/Dockerfile`) und eine gemeinsame `backend/requirements.txt`.
> Neue Python-Pakete dort eintragen und danach einmal
> `docker compose up --build` ausführen.
