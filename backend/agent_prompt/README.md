# Clarity Prompt Agent (Port 8003)

Advanced prompt generation with context-aware selection and LLM integration.

## Overview

The Prompt Agent generates contextually relevant reflection questions based on:
- **Sentiment signals** from the Sentiment Agent
- **Detected patterns** from the Pattern Agent
- **User context** (editor opening, post-entry, weekly reflection, etc.)
- **User engagement** (streak milestones, re-engagement after breaks)

## Features

✨ **Smart Prompt Selection**
- Safety-first: Distress signals get immediate support
- Context-aware: Different prompts for morning vs evening
- Pattern-aware: Recognizes recurring themes
- Personalized: Avoids recently asked questions
- Milestone celebration: 30/60/90-day achievements

🌍 **Multilingual**
- German (de) & English (en) built-in
- Expandable to more languages

🎯 **Prompt Categories**
- **Starter**: Blank page prevention
- **Sentiment-based**: Driven by emotional signals
- **Pattern-based**: Response to recurring themes
- **Temporal**: Context-specific (morning, evening, weekly)
- **Safety**: For distress signals
- **Streak-break**: Gentle re-engagement
- **Milestone**: Celebration prompts

## API Endpoints

### Health Check
```
GET /health
```

### Generate Single Prompt
```
POST /generate-prompt

Request:
{
  "journal_text": "Today was interesting...",
  "sentiment_data": {
    "label": "positive",
    "score": 0.8,
    "distress_score": 0.1
  },
  "detected_patterns": ["work", "sleep"],
  "context": "post_entry",
  "streak_days": 15,
  "user_history_ids": [],
  "entry_id": 123
}

Response:
{
  "question": "Was war das Beste an heute?",
  "prompt_type": "sentiment_based",
  "category": "sentiment_based",
  "subcategory": "positive",
  "context_reason": "Sentiment analysis: positive",
  "suggested_timing": "post_entry",
  "entry_id": 123,
  "language": "de"
}
```

### Generate Starter Prompt (Blank Page Prevention)
```
POST /generate-starter

Request:
{
  "context": "editor_open",
  "language": "de"
}

Response:
{
  "question": "Was beschäftigt dich gerade am meisten?",
  "prompt_type": "starter",
  ...
}
```

### Generate Weekly Reflection (3-5 deep questions)
```
POST /generate-weekly-reflection

Request:
{
  "week_number": 28,
  "language": "de"
}

Response:
{
  "questions": [
    "Welche Themen durchziehen diese Woche?",
    "Was war das Beste an dieser Woche?",
    ...
  ],
  "prompt_type": "weekly_reflection",
  ...
}
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
│   ├── prompt_library.py     # All prompt templates (DE/EN) + Offline-Auswahl
│   ├── context_analyzer.py   # Decision logic for prompt selection
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

### Run All Tests
```bash
pytest tests/agent_prompt/ -v
```

### Test Coverage
- **test_prompt_library.py**: Library completeness, multilingual support
- **test_context_analyzer.py**: Selection logic, sentiment mapping

```bash
pytest tests/agent_prompt/test_prompt_library.py -v
pytest tests/agent_prompt/test_context_analyzer.py -v
```

## Configuration

Environment variables:
```
OLLAMA_HOST=http://ollama:11434
MODEL=llama3.2:1b
PORT=8003
```

## Integration with Other Agents

### Input from Sentiment Agent
```
GET http://agent_sentiment:8001/analyze
→ {"label": "positive", "score": 0.8, "distress_score": 0.1}
```

### Input from Pattern Agent
```
GET http://agent_pattern:8002/detect
→ ["work", "relationships", "sleep"]
```

## Decision Flow

```
User opens journal/posts entry
    ↓
Extract sentiment (sentiment_agent) + patterns (pattern_agent)
    ↓
[ContextAnalyzer.choose_prompt_type()]
    ↓
Is distress_score > 0.7? → YES → Use SAFETY prompt
    ↓
Is streak milestone (30/60/90)? → YES → Use MILESTONE prompt
    ↓
Is streak=0 after pause? → YES → Use STREAK_BREAK prompt
    ↓
Context-specific routing:
  - "weekly" → TEMPORAL + "weekly_reflection"
  - "morning"/"evening" → TEMPORAL + time-based
  - detected_patterns? → PATTERN_BASED
  - sentiment_label? → SENTIMENT_BASED
  - else → STARTER
    ↓
[PromptLibrary.get_prompt_by_category()] or [LLM generation via Ollama]
    ↓
Return selected prompt + metadata
```

## Explainability

Every prompt response includes `context_reason` for transparency:
- "Blank page prevention - user just opened editor"
- "Distress signal detected"
- "Detected recurring pattern: work"
- "Sentiment analysis: positive"

This helps users understand why they're seeing this specific question.

## Future Enhancements

- [ ] User preference learning (favor certain prompt types)
- [ ] Time-of-day optimization
- [ ] Sequence learning (better flow between prompts)
- [ ] A/B testing for prompt effectiveness
- [ ] Integration with notification scheduling
