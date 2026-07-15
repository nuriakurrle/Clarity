# Clarity Prompt Agent (Port 8003)

Advanced prompt generation with context-aware selection and LLM integration.

## Overview

The Prompt Agent generates contextually relevant reflection questions based on:
- **Sentiment signals** from the Sentiment Agent
- **Detected patterns** from the Pattern Agent
- **User context** (editor opening, post-entry, weekly reflection, etc.)
- **User engagement** (streak milestones, re-engagement after breaks)

## Features

✨ **Orchestrator**: holt Sentiment/Pattern/Digest-Kontext von den anderen
Agents und generiert daraus 4 Reflexionsfragen via Ollama.

📚 **Offline-Bibliothek**: ohne Ollama (oder bei zu wenigen Fragen) kommt
eine kontextpassende Auswahl aus der kuratierten Bibliothek – Starter-Fragen,
Sentiment-Subkategorien (positiv/negativ/neutral/ängstlich/traurig, DE/EN)
und Templates für Pattern-Themen und Wochenrückblick.

> Historische Einzel-Endpoints (`/generate-prompt`, `/generate-starter`,
> `/generate-weekly-reflection`) und ihre Bibliotheks-Kategorien
> (temporal/safety/streak_break/milestone) wurden entfernt – kein Client
> hat sie aufgerufen. Bei Bedarf: Git-Historie.

## API Endpoints

### Health Check
```
GET /health
```

### Generate Prompts (Orchestrator, 4 kontextbezogene Fragen)
```
POST /generate-prompts

Request:
{
  "text": "Heute war die Arbeit wieder zu viel.",
  "entries": ["Montag Stress im Job", "Dienstag kaum geschlafen"],
  "use_sentiment": true,
  "use_pattern": true,
  "use_digest": false,
  "blocked_topics": ["Finanzen"],
  "entry_id": null
}

Response:
{
  "prompts": ["...?", "...?", "...?", "...?"],
  "mode": "reflection",            // oder "starter" (Text < 15 Zeichen)
  "source": "ollama",              // "ollama" | "mixed" | "library"
  "context_used": ["sentiment", "pattern"]
}
```

Der Endpoint ruft Sentiment (8001), Pattern (8002) und Digest (8004) auf und
baut aus deren Ergebnissen den Ollama-Prompt. Pro Komponente gilt:
Override aus dem Request → Live-Analyse mit `persist=false` → zuletzt
gespeichertes Ergebnis (lesende Endpoints) → weglassen. Ohne Ollama kommen
die Fragen aus der lokalen Bibliothek (`source: "library"`).

## Koordination: persist-Flag (additive Änderung bei den anderen Agents)

Damit die Live-Aufrufe keine Geister-Daten erzeugen, braucht jeder
Analyse-Endpoint eine additive Flag `persist: bool = True` (Default =
bisheriges Verhalten, ändert für niemanden etwas):

| Agent | Endpoint | Ownerin | Status |
|---|---|---|---|
| Sentiment | `POST /analyze` | Aicha | **PFLICHT** – `save_entry()` schreibt sonst in `entries` |
| Pattern | `POST /detect-patterns` | Coumba | empfohlen – eigene Tabelle, unkritisch |
| Digest | `POST /create-digest` | Katharina | empfohlen – eigene Tabelle, unkritisch |

Beispiel (Sentiment): `persist: bool = True` ins `TextInput`, und
`save_entry()`/`save_sentiment()` nur bei `input.persist` ausführen –
bei `persist=false` läuft die Analyse synchron und die Antwort enthält
das Ergebnis (`sentiment`, `emotions`), ohne etwas zu speichern.

**Sicherung im Prompt-Agent:** Vor jedem Live-Aufruf prüft
`tools/context_fetcher.py` über `/openapi.json`, ob der Endpoint die
`persist`-Flag schon anbietet. Solange nicht, wird der Live-Aufruf
übersprungen (Pydantic würde die Flag sonst stillschweigend ignorieren
und trotzdem speichern) und stattdessen das zuletzt gespeicherte Ergebnis
gelesen. Sobald eine Ownerin ihre Flag deployt, nutzt der Prompt-Agent
sie automatisch – ohne weitere Änderung hier.

## Architecture

```
backend/agent_prompt/
├── main.py                   # FastAPI entry point
│                             # (Dockerfile & requirements.txt sind für alle
│                             #  Agenten gemeinsam unter backend/)
│
├── tools/
│   ├── prompt_library.py     # Prompt templates (DE/EN) + Offline-Auswahl
│   └── context_fetcher.py    # Orchestriert Sentiment/Pattern/Digest (persist=false)
│
├── schemas/
│   └── __init__.py           # Pydantic models for API
│
└── routes/
    └── __init__.py           # API endpoint definitions
```

## Running Locally

### Prerequisites
- Docker & Docker Compose (for Ollama)
- Python 3.10+
- pip

### Start Backend + Ollama
```bash
cd /path/to/Clarity
docker compose up -d ollama agent_prompt
```

### Development Server
```bash
pip install -r backend/requirements.txt
cd backend/agent_prompt
python main.py
```

Server runs at `http://localhost:8003`

## Testing

```bash
pytest tests/agent_prompt/ -v
```

- **test_prompt_library.py**: Bibliotheks-Struktur, DE/EN, Offline-Auswahl
  (`library_prompts` inkl. Sentiment-Mapping und Pattern-Templates)

## Configuration

Environment variables:
```
OLLAMA_HOST=http://ollama:11434
MODEL=llama3.2:1b
PORT=8003
```

## Decision Flow

```
Frontend (Prompt-Bubble im Editor)
    ↓  POST /generate-prompts (text, entries, use_*-Flags, sentiment-Override)
Kontext orchestrieren (context_fetcher):
  Override aus Request → Live-Analyse (persist=false) → gespeichertes Ergebnis → weglassen
    ↓
Ollama-Generierung mit Kontextblock (Stimmung, Themen, Wochenrückblick)
    ↓  (Ollama offline / zu wenige Fragen)
Auffüllen aus der Offline-Bibliothek (library_prompts)
    ↓
4 Fragen + mode/source/context_used
```

## Explainability

Die Response enthält `source` (ollama/mixed/library) und `context_used`
(welche Agents tatsächlich eingeflossen sind) – so ist nachvollziehbar,
woher die Fragen kommen.
