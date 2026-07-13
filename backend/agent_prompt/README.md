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

## Architecture

```
backend/agent_prompt/
├── main.py                   # FastAPI entry point
│                             # (Dockerfile & requirements.txt sind für alle
│                             #  Agenten gemeinsam unter backend/)
│
├── tools/
│   ├── prompt_library.py     # All prompt templates (DE/EN)
│   └── context_analyzer.py   # Decision logic for prompt selection
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
