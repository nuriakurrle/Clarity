"""Clarity Reflection / Digest Agent - Port 8004 - WITH DATABASE

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
# MODEL: jedes lokal gezogene Ollama-Modell (z. B. `ollama pull phi3`).
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("DIGEST_MODEL", "phi3")


@app.on_event("startup")
async def startup():
    init_db()
    logger.info("✅ Database initialized")


# --- Modelle ----------------------------------------------------------------
class DigestInput(BaseModel):
    """Direkter Aufruf mit fertigen Einträgen (ohne DB-Lesen)."""
    entries: List[str]
    week: str = "this week"


class ReflectInput(BaseModel):
    """Reflexion aus der DB über die letzten `days` Tage."""
    days: int = 7


# --- Ollama-Helfer (lokales LLM) --------------------------------------------
async def call_ollama(prompt: str, temperature: float = 0.4) -> str:
    """Schickt einen Prompt an die lokale Ollama-Instanz und gibt den Text zurück."""
    async with httpx.AsyncClient(timeout=90) as client:
        try:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "stream": False,
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
    """Verdichtet die Stimmungsanalysen der Woche zu einem kurzen Text."""
    if not sentiments:
        return "Keine Stimmungsdaten vorhanden."
    counts: dict = {}
    emotions: dict = {}
    for s in sentiments:
        counts[s["sentiment"]] = counts.get(s["sentiment"], 0) + 1
        for emotion in s.get("emotions", []):
            emotions[emotion] = emotions.get(emotion, 0) + 1
    distribution = ", ".join(f"{k}: {v}" for k, v in counts.items())
    top_emotions = sorted(emotions, key=emotions.get, reverse=True)[:5]
    return (
        f"Stimmungsverteilung: {distribution}. "
        f"Häufige Emotionen: {', '.join(top_emotions) if top_emotions else '–'}."
    )


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
Erstelle eine wöchentliche Reflexion auf Deutsch – basierend auf den Einträgen,
der Stimmung und den erkannten Mustern der Woche.

EINTRÄGE DER WOCHE:
{entries_text}

STIMMUNG:
{mood}

MUSTER:
{pattern}

Antworte AUSSCHLIESSLICH mit JSON in genau diesem Format:
{{"summary": "2-3 Sätze Gesamtüberblick", "highlights": ["positive Momente"], "challenges": ["schwierige Momente"], "growth": ["erkennbare Entwicklung"], "affirmation": "ein ermutigender Satz für die nächste Woche"}}"""


def persist_digest(digest_data: dict) -> None:
    """Speichert eine Reflexion in der weekly_digest-Tabelle (Wochenstart = Montag)."""
    week_start = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime("%Y-%m-%d")
    save_digest(
        week_start,
        digest_data.get("summary", ""),
        digest_data.get("highlights", []),
        digest_data.get("challenges", []),
        digest_data.get("growth", []),
        digest_data.get("affirmation", ""),
    )
    logger.info(f"💾 Digest gespeichert (week_start={week_start})")


# --- Endpunkte --------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "reflection", "model": MODEL}


@app.post("/reflect")
async def reflect(input: ReflectInput = ReflectInput()):
    """Wöchentliche Reflexion aus den in der DB gespeicherten Wochendaten."""
    since = (datetime.now() - timedelta(days=input.days)).strftime("%Y-%m-%d %H:%M:%S")
    entries = get_entries_since(since)
    if not entries:
        raise HTTPException(status_code=404, detail="Keine Einträge in diesem Zeitraum")

    sentiments = get_sentiments_since(since)
    patterns = get_patterns_since(since)
    logger.info(
        f"🪞 Reflexion über {len(entries)} Einträge, "
        f"{len(sentiments)} Stimmungen, {len(patterns)} Muster..."
    )

    entries_text = "\n---\n".join(e["content"] for e in entries)
    prompt = build_reflection_prompt(
        entries_text,
        summarize_mood(sentiments),
        summarize_patterns(patterns),
    )

    raw = await call_ollama(prompt, temperature=0.4)
    digest_data = extract_json(raw)
    persist_digest(digest_data)
    return digest_data


@app.post("/create-digest")
async def create_digest(input: DigestInput):
    """Direkter Aufruf mit fertigen Einträgen (z. B. zum Testen ohne DB-Inhalt)."""
    logger.info(f"📖 Creating digest for {len(input.entries)} entries...")
    entries_text = "\n---\n".join(input.entries)
    prompt = build_reflection_prompt(entries_text, "Keine Stimmungsdaten.", "Keine Muster.")

    raw = await call_ollama(prompt, temperature=0.4)
    digest_data = extract_json(raw)
    persist_digest(digest_data)
    return digest_data


@app.get("/digest/latest")
async def latest_digest():
    """Letzte gespeicherte Reflexion aus SQLite (kein LLM-Aufruf)."""
    digest = get_latest_digest()
    if digest is None:
        raise HTTPException(status_code=404, detail="Noch keine Reflexion vorhanden")
    return digest


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
