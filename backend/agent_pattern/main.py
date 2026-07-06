"""Clarity Pattern Agent - Port 8002.

Erkennt wiederkehrende Themen, Personen, Situationen, Trigger und Sprachmuster
ueber mehrere Journal-Eintraege hinweg (siehe agent.py) und speichert sie in der
geteilten SQLite-DB. Frontend und Digest-Agent lesen die Muster ueber
GET /patterns/latest.
"""
import os, json, re, logging, sys
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx, uvicorn

sys.path.insert(0, '/app/shared')
from database import (
    init_db, save_pattern, get_latest_pattern, get_patterns_since,
    get_entries_since, get_sentiments_since,
)
from agent import build_pattern_prompt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Pattern Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                  allow_methods=["*"], allow_headers=["*"])

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("MODEL", "llama3.2:1b")

# Ab wie vielen Eintraegen eine sinnvolle Musteranalyse ueberhaupt moeglich ist.
MIN_ENTRIES = 2


def _since(days: int) -> str:
    """SQLite-kompatibler Zeitstempel fuer 'vor N Tagen' (UTC).

    SQLite speichert created_at via CURRENT_TIMESTAMP in UTC, daher hier UTC.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    return since.strftime("%Y-%m-%d %H:%M:%S")


def fallback_patterns(entries: List[str]) -> dict:
    """Notfall-Ergebnis, falls das LLM kein gueltiges JSON liefert."""
    themes = [entry[:60].strip() for entry in entries[:3] if entry.strip()]
    return {
        "recurring_themes": themes,
        "recurring_people": [],
        "situations": [],
        "triggers": {},
        "language_shifts": [],
        "mood_trend": "stable",
        "summary": "",
    }


def _theme_counts(themes: List[str], entries: List[str]) -> dict:
    """Zaehlt grob, in wie vielen Eintraegen ein Thema vorkommt (#50).

    Themen sind LLM-Phrasen (z.B. "Uni-Stress"); wir zaehlen Eintraege, die ein
    aussagekraeftiges Wort des Themas enthalten.
    """
    lowered = [e.lower() for e in entries]
    counts = {}
    for theme in themes:
        words = [w for w in re.split(r"[^0-9a-zäöüß]+", theme.lower()) if len(w) > 3]
        if not words:
            words = [theme.lower()]
        counts[theme] = sum(1 for e in lowered if any(w in e for w in words))
    return counts


async def _ollama_generate(prompt: str) -> str:
    """Ruft Ollama auf - hoeheres Timeout + ein Retry bei kaltem Modell (#54)."""
    payload = {
        "model": MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.3},
    }
    last_err: Optional[Exception] = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                response = await client.post(f"{OLLAMA_HOST}/api/generate", json=payload)
            return response.json().get("response", "")
        except httpx.TimeoutException as e:
            last_err = e
            logger.warning("Ollama Timeout (Versuch %d/2), neuer Versuch...", attempt + 1)
    raise last_err  # type: ignore[misc]


@app.on_event("startup")
async def startup():
    init_db()
    logger.info("Database initialized")


class EntriesInput(BaseModel):
    # Optional: explizite Eintraege. Ohne Angabe werden die letzten `days` Tage
    # aus der Datenbank analysiert.
    entries: Optional[List[str]] = None
    days: int = 7


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "pattern", "model": MODEL}


@app.post("/detect-patterns")
async def detect_patterns(input: EntriesInput = EntriesInput()):
    """Analysiert wiederkehrende Muster.

    Ohne `entries` im Body werden die Eintraege der letzten `days` Tage aus der
    geteilten DB geholt (so arbeitet der Agent "across entries over time").
    """
    # 1) Eintraege bestimmen: explizit uebergeben ODER aus der DB
    if input.entries:
        entries = [e for e in input.entries if e and e.strip()]
        sentiment_hint = ""
    else:
        rows = get_entries_since(_since(input.days))
        entries = [r["content"] for r in rows if r.get("content", "").strip()]
        # Optional: Stimmungen als Zusatzkontext fuer die Trigger-Erkennung
        sentiments = get_sentiments_since(_since(input.days))
        sentiment_hint = ""
        if sentiments:
            tones = ", ".join(
                f"{s['primary_emotion']}" for s in sentiments if s.get("primary_emotion")
            )
            if tones:
                sentiment_hint = (
                    "\nFor extra context, the sentiment agent detected these emotions "
                    f"across the same period: {tones}. Use them only to spot triggers.\n"
                )

    if len(entries) < MIN_ENTRIES:
        logger.info("Not enough entries for pattern analysis (%d)", len(entries))
        return {"status": "insufficient_data", "entry_count": len(entries)}

    logger.info("Analyzing %d entries...", len(entries))
    entries_text = "\n---\n".join(entries)
    prompt = build_pattern_prompt(entries_text, sentiment_hint)

    try:
        response_text = await _ollama_generate(prompt)
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)

        if json_match:
            try:
                pattern_data = json.loads(json_match.group())
            except Exception:
                logger.warning("JSON parse failed, using fallback")
                pattern_data = fallback_patterns(entries)
        else:
            logger.warning("No JSON in response, using fallback")
            pattern_data = fallback_patterns(entries)

        # Defensiv normalisieren (Modell haelt sich nicht immer ans Schema)
        pattern_data = _normalize(pattern_data)

        # Haeufigkeit pro Thema (#50)
        theme_counts = _theme_counts(pattern_data["recurring_themes"], entries)

        # Vergleich mit der vorherigen Analyse: neue Themen (#51) + Trend (#52)
        prev = get_latest_pattern()
        prev_themes = prev.get("top_themes", []) if prev else []
        prev_counts = prev.get("theme_counts", {}) if prev else {}
        new_themes = [t for t in pattern_data["recurring_themes"] if t not in prev_themes]
        theme_changes = {}
        for theme in pattern_data["recurring_themes"]:
            count = theme_counts.get(theme, 0)
            if theme not in prev_counts:
                theme_changes[theme] = "neu"
            elif count > prev_counts[theme]:
                theme_changes[theme] = "gestiegen"
            elif count < prev_counts[theme]:
                theme_changes[theme] = "gesunken"
            else:
                theme_changes[theme] = "gleich"

        pattern_data["theme_counts"] = theme_counts
        pattern_data["new_themes"] = new_themes
        pattern_data["theme_changes"] = theme_changes
        logger.info("Patterns detected")

        # In der DB speichern (inkl. der reichhaltigen Felder)
        save_pattern(
            top_themes=pattern_data["recurring_themes"],
            mood_trend=pattern_data["mood_trend"],
            triggers=pattern_data["triggers"],
            recurring_people=pattern_data["recurring_people"],
            situations=pattern_data["situations"],
            language_shifts=pattern_data["language_shifts"],
            observations=pattern_data["observations"],
            theme_counts=theme_counts,
            new_themes=new_themes,
            theme_changes=theme_changes,
            summary=pattern_data["summary"],
        )
        logger.info("Saved to DB")

        return pattern_data
    except Exception as e:
        logger.error("Error: %s", e)
        raise


def _normalize(data: dict) -> dict:
    """Stellt sicher, dass alle erwarteten Felder mit passendem Typ existieren."""
    def as_list(value):
        if isinstance(value, list):
            return [str(v) for v in value if str(v).strip()]
        if isinstance(value, str) and value.strip():
            return [value.strip()]
        return []

    triggers = data.get("triggers")
    if not isinstance(triggers, dict):
        triggers = {}

    trend = str(data.get("mood_trend", "stable")).lower()
    if trend not in ("improving", "stable", "declining"):
        trend = "stable"

    return {
        "recurring_themes": as_list(data.get("recurring_themes") or data.get("top_themes")),
        "recurring_people": as_list(data.get("recurring_people")),
        "situations": as_list(data.get("situations")),
        "triggers": triggers,
        "language_shifts": as_list(data.get("language_shifts")),
        "observations": as_list(data.get("observations")),
        "mood_trend": trend,
        "summary": str(data.get("summary", "")).strip(),
    }


@app.get("/patterns/latest")
async def patterns_latest():
    """Zuletzt gespeicherte Muster (fuer Frontend & Digest-Agent).

    Gibt dieselbe Form zurueck wie POST /detect-patterns. In der DB heisst die
    Spalte historisch `top_themes`; nach aussen liefern wir `recurring_themes`,
    damit Frontend und beide Endpoints ein einheitliches Schema haben.
    """
    pattern = get_latest_pattern()
    if pattern is None:
        return {"status": "no_data"}
    pattern["recurring_themes"] = pattern.pop("top_themes", [])
    return pattern


@app.get("/patterns/history")
async def patterns_history(days: int = 30):
    """Vergangene Musteranalysen der letzten `days` Tage (Entwicklung ueber Zeit)."""
    rows = get_patterns_since(_since(days))
    # top_themes -> recurring_themes fuer ein einheitliches Schema
    for row in rows:
        row["recurring_themes"] = row.pop("top_themes", [])
    return {"days": days, "count": len(rows), "history": rows}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
