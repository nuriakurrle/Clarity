"""Clarity Reflection / Digest Agent - Port 8004 

Erstellt wöchentliche Einblicke aus Stimmung, Mustern und Entwicklungen.

Datenfluss (alles lokal):
  SQLite (entries + sentiment_analysis + pattern_detection)
      -> Wochenkontext zusammenbauen
      -> lokales LLM via Ollama (/api/generate)
      -> Reflexion als JSON
      -> zurück in SQLite (weekly_digest)
"""
import os, json, re, logging, sys
from typing import List
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx, uvicorn

sys.path.insert(0, '/app/shared')
from database import (
    init_db,
    save_digest,
    get_entries_since,
    get_sentiments_since,
    get_patterns_since,
    get_latest_digest,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Reflection Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                  allow_methods=["*"], allow_headers=["*"])

# --- Lokale Konfiguration ---------------------------------------------------
# OLLAMA_HOST: im Docker-Netz "http://ollama:11434", lokal "http://localhost:11434".
# MODEL: jedes lokal gezogene Ollama-Modell. Gleiche Env-Variable wie die
# anderen Agenten, damit docker-compose (MODEL=...) auch hier greift.
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("MODEL", "llama3.2:1b")


@app.on_event("startup")
async def startup():
    init_db()
    logger.info("Database initialized")


# --- Modelle ----------------------------------------------------------------
class DigestInput(BaseModel):
    """Direkter Aufruf mit fertigen Einträgen (ohne DB-Lesen)."""
    entries: List[str]
    week: str = "this week"


class ReflectInput(BaseModel):
    """Reflexion über eine abgeschlossene Kalenderwoche.

    `weeks_back=1` = letzte Woche (Mo–So), 2 = die Woche davor usw.
    """
    weeks_back: int = 1


# --- Ollama-Helfer (lokales LLM) --------------------------------------------
async def call_ollama(prompt: str, temperature: float = 0.4) -> str:
    async with httpx.AsyncClient(timeout=90) as client:
        try:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": temperature},
                },
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error(f"Ollama nicht erreichbar: {exc}")
            raise HTTPException(status_code=503, detail="Ollama nicht erreichbar")
    return response.json().get("response", "")


def extract_json(text: str) -> dict:
    """Holt das erste JSON-Objekt aus der Modellantwort."""
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if not match:
        raise HTTPException(status_code=502, detail="Keine JSON-Antwort vom Modell")
    try:
        return json.loads(match.group())
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Ungültiges JSON vom Modell")


# --- Kontext aus den Wochendaten --------------------------------------------
def summarize_mood(sentiments: list) -> str:
    if not sentiments:
        return "Keine Stimmungsdaten vorhanden."
    counts: dict = {}
    emotions: dict = {}
    valences: list = []
    intensities: list = []
    for s in sentiments:
        counts[s["sentiment"]] = counts.get(s["sentiment"], 0) + 1
        primary = s.get("primary_emotion")
        if primary:
            emotions[primary] = emotions.get(primary, 0) + 1
        for emotion in s.get("secondary_emotions", []):
            emotions[emotion] = emotions.get(emotion, 0) + 1
        if s.get("valence") is not None:
            valences.append(s["valence"])
        if s.get("intensity") is not None:
            intensities.append(s["intensity"])

    distribution = ", ".join(f"{k}: {v}" for k, v in counts.items())
    top_emotions = sorted(emotions, key=emotions.get, reverse=True)[:5]

    parts = [f"Stimmungsverteilung: {distribution}."]
    if valences:
        parts.append(f"Durchschnittliche Valenz: {sum(valences) / len(valences):.2f}.")
    if intensities:
        parts.append(f"Durchschnittliche Intensität: {round(sum(intensities) / len(intensities))}.")
    parts.append(f"Häufige Emotionen: {', '.join(top_emotions) if top_emotions else '–'}.")
    return " ".join(parts)


def summarize_patterns(patterns: list) -> str:
    """Verdichtet die erkannten Muster der Woche zu einem kurzen Text."""
    if not patterns:
        return "Keine Muster erkannt."
    latest = patterns[-1]
    themes = ", ".join(latest.get("top_themes", [])[:5]) or "–"
    trend = latest.get("mood_trend") or "–"
    return f"Top-Themen: {themes}. Stimmungstrend: {trend}."


def build_reflection_prompt(entries_text: str, mood: str, pattern: str) -> str:
    return f"""Du bist ein einfühlsamer Reflexions-Begleiter für eine Journaling-App.
Erstelle eine Reflexion der vergangenen Woche auf Deutsch – basierend auf den
Einträgen, der Stimmung und den erkannten Mustern dieser Woche.

EINTRÄGE DER VERGANGENEN WOCHE (Mo–So):
{entries_text}

STIMMUNG:
{mood}

MUSTER:
{pattern}

Antworte AUSSCHLIESSLICH mit JSON in genau diesem Format:
{{"summary": "2-3 Sätze Gesamtüberblick", "highlights": ["positive Momente"], "challenges": ["schwierige Momente"], "growth": ["erkennbare Entwicklung"], "affirmation": "ein ermutigender Satz für die nächste Woche"}}"""


def week_window(weeks_back: int = 1) -> tuple[datetime, datetime]:
    """Montag 00:00 bis (exklusiv) Montag 00:00 der abgeschlossenen Woche.

    weeks_back=1 liefert die *letzte* Woche (Mo–So), nicht die laufende.
    """
    today = datetime.now()
    this_monday = (today - timedelta(days=today.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    start = this_monday - timedelta(weeks=weeks_back)
    return start, start + timedelta(days=7)


def persist_digest(digest_data: dict, week_start_dt: datetime) -> None:
    week_start = week_start_dt.strftime("%Y-%m-%d")
    save_digest(
        week_start,
        digest_data.get("summary", ""),
        digest_data.get("highlights", []),
        digest_data.get("challenges", []),
        digest_data.get("growth", []),
        digest_data.get("affirmation", ""),
    )
    logger.info(f"Digest gespeichert (week_start={week_start})")


# Endpunkte 
@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "reflection", "model": MODEL}


@app.post("/reflect")
async def reflect(input: ReflectInput = ReflectInput()):
    """Reflexion über die abgeschlossene Vorwoche (Mo–So) aus der DB."""
    start_dt, end_dt = week_window(input.weeks_back)
    since = start_dt.strftime("%Y-%m-%d %H:%M:%S")
    until = end_dt.strftime("%Y-%m-%d %H:%M:%S")

    entries = get_entries_since(since, until)
    if not entries:
        raise HTTPException(status_code=404, detail="Keine Einträge in diesem Zeitraum")

    sentiments = get_sentiments_since(since, until)
    patterns = get_patterns_since(since, until)
    logger.info(
        f"Reflexion für {start_dt:%Y-%m-%d} bis {end_dt - timedelta(days=1):%Y-%m-%d}: "
        f"{len(entries)} Einträge, {len(sentiments)} Stimmungen, {len(patterns)} Muster..."
    )

    entries_text = "\n---\n".join(e["content"] for e in entries)
    prompt = build_reflection_prompt(
        entries_text,
        summarize_mood(sentiments),
        summarize_patterns(patterns),
    )

    raw = await call_ollama(prompt, temperature=0.4)
    digest_data = extract_json(raw)
    persist_digest(digest_data, start_dt)
    return digest_data


@app.post("/create-digest")
async def create_digest(input: DigestInput):
    logger.info(f"Creating digest for {len(input.entries)} entries...")
    entries_text = "\n---\n".join(input.entries)
    prompt = build_reflection_prompt(entries_text, "Keine Stimmungsdaten.", "Keine Muster.")

    raw = await call_ollama(prompt, temperature=0.4)
    digest_data = extract_json(raw)
    persist_digest(digest_data, week_window(1)[0])
    return digest_data


@app.get("/digest/latest")
async def latest_digest():

    digest = get_latest_digest()
    if digest is None:
        raise HTTPException(status_code=404, detail="Noch keine Reflexion vorhanden")
    return digest


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
