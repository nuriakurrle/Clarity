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
    init_db, save_pattern, get_latest_pattern, get_pattern_before,
    get_patterns_since, get_entries_since, get_sentiments_since,
)
from agent import build_pattern_prompt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Pattern Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                  allow_methods=["*"], allow_headers=["*"])

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
# Default an docker-compose angeglichen, damit ein lokaler Start dasselbe Modell nutzt.
MODEL = os.getenv("MODEL", "llama3.2:3b")

# Ab wie vielen Eintraegen eine sinnvolle Musteranalyse ueberhaupt moeglich ist.
# Aus zwei Eintraegen laesst sich nichts "Wiederkehrendes" ableiten - das Modell
# wuerde nur erfinden.
MIN_ENTRIES = 3

# Ein Thema gilt erst als "wiederkehrend", wenn es in mindestens so vielen
# Eintraegen tatsaechlich vorkommt. Das ist der Halluzinations-Filter: das Modell
# erfindet gerne Themen (z.B. "Uniabgaben"), die in keinem Eintrag stehen.
MIN_THEME_OCCURRENCES = 2

# Deutsche Funktionswoerter, die ein Thema nicht inhaltlich kennzeichnen.
STOPWORDS = {
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
    "einer", "und", "oder", "mit", "von", "vom", "fuer", "für", "auf", "aus",
    "bei", "beim", "zum", "zur", "nach", "vor", "ueber", "über", "unter",
    "durch", "gegen", "ohne", "ist", "sind", "war", "waren", "hat", "habe",
    "hatte", "wurde", "werden", "sein", "sich", "ich", "wie", "als", "auch",
    "noch", "nur", "sehr", "viel", "mehr", "dass", "weil", "aber", "dann",
    "schon", "immer",
}


def _since(days: int) -> str:
    """SQLite-kompatibler Zeitstempel fuer 'vor N Tagen' (UTC).

    SQLite speichert created_at via CURRENT_TIMESTAMP in UTC, daher hier UTC.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    return since.strftime("%Y-%m-%d %H:%M:%S")


def empty_patterns() -> dict:
    """Leeres Ergebnis, falls das LLM kein gueltiges JSON liefert.

    Bewusst OHNE erfundene Inhalte: die Vorgaenger-Version hat die ersten 60
    Zeichen von Eintraegen als "Themen" ausgegeben und gespeichert. Lieber gar
    kein Muster als ein falsches.
    """
    return {
        "recurring_themes": [],
        "recurring_people": [],
        "situations": [],
        "triggers": {},
        "language_shifts": [],
        "observations": [],
        "mood_trend": "stable",
        "summary": "",
    }


def _content_words(phrase: str) -> List[str]:
    """Inhaltstragende Woerter einer LLM-Phrase (ohne Funktionswoerter)."""
    words = [w for w in re.split(r"[^0-9a-zäöüß]+", phrase.lower()) if w]
    content = [w for w in words if len(w) >= 3 and w not in STOPWORDS]
    return content or [phrase.lower().strip()]


def _occurs_in(phrase: str, entry_lower: str) -> bool:
    """Kommt `phrase` inhaltlich in diesem Eintrag vor?

    ALLE inhaltstragenden Woerter muessen vorkommen (UND, nicht ODER). Genau hier
    lag der Bug: mit ODER bekamen "Streit in der Familie" und "Zeit mit der
    Familie verbracht" beide denselben Zaehler, weil beide auf "familie" matchten -
    obwohl ein Abend mit der Familie kein Streit ist.

    Der Substring-Vergleich pro Wort bleibt bewusst erhalten, damit deutsche
    Komposita und Beugungen greifen ("familie" findet auch "Familienabend").
    """
    return all(word in entry_lower for word in _content_words(phrase))


def _theme_counts(themes: List[str], entries: List[str]) -> dict:
    """Zaehlt, in wie vielen Eintraegen ein Thema tatsaechlich vorkommt."""
    lowered = [e.lower() for e in entries]
    return {theme: sum(1 for e in lowered if _occurs_in(theme, e)) for theme in themes}


_WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag",
                "Samstag", "Sonntag"]


def _with_date(row: dict) -> str:
    """Formatiert einen Eintrag als 'Mo, 2026-07-07: <text>' fuer den Prompt.

    So sieht das Modell die zeitliche Reihenfolge und kann Aussagen ueber den
    Wochenverlauf belegen, statt sie zu erfinden.
    """
    created = str(row.get("created_at", ""))[:10]
    label = created
    try:
        wd = datetime.strptime(created, "%Y-%m-%d").weekday()
        label = f"{_WEEKDAYS_DE[wd][:2]}, {created}"
    except ValueError:
        pass
    return f"{label}: {row['content'].strip()}"


def _filter_hallucinations(pattern_data: dict, theme_counts: dict, entries: List[str]) -> dict:
    """Entfernt Themen/Personen/Situationen, die nicht wirklich in den Eintraegen stehen.

    Kern des Fixes: das kleine Modell erfindet gerne Inhalte. Ein Thema bleibt nur,
    wenn es in mindestens MIN_THEME_OCCURRENCES Eintraegen vorkommt; Personen und
    Situationen muessen wenigstens einmal belegbar sein.
    """
    lowered = [e.lower() for e in entries]

    pattern_data["recurring_themes"] = [
        t for t in pattern_data["recurring_themes"]
        if theme_counts.get(t, 0) >= MIN_THEME_OCCURRENCES
    ]
    pattern_data["recurring_people"] = [
        p for p in pattern_data["recurring_people"]
        if any(_occurs_in(p, e) for e in lowered)
    ]
    pattern_data["situations"] = [
        s for s in pattern_data["situations"]
        if any(_occurs_in(s, e) for e in lowered)
    ]
    pattern_data["triggers"] = {
        k: v for k, v in pattern_data["triggers"].items()
        if any(_occurs_in(k, e) for e in lowered)
    }
    # Themen-Zaehler auf die verbliebenen Themen eindampfen.
    pattern_data["_kept_counts"] = {
        t: theme_counts[t] for t in pattern_data["recurring_themes"]
    }
    return pattern_data


def _previous_pattern(days: int) -> Optional[dict]:
    """Letzte Analyse VOR dem aktuellen Fenster (fuer den Wochenvergleich)."""
    return get_pattern_before(_since(days))


def _matches_any(theme: str, prev_themes: List[str]) -> Optional[str]:
    """Findet ein vorheriges Thema, das inhaltlich dasselbe meint - oder None.

    Exakter String-Vergleich reicht nicht: das Modell formuliert dasselbe Thema
    jede Woche anders ("Streit mit Mama" vs. "Streit in der Familie"). Wir gleichen
    ueber die inhaltstragenden Woerter ab, damit "neu" auch wirklich neu bedeutet.
    """
    words = set(_content_words(theme))
    for prev in prev_themes:
        prev_words = set(_content_words(prev))
        if words & prev_words:
            return prev
    return None


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
    # 1) Eintraege bestimmen: explizit uebergeben ODER aus der DB.
    #    `entries` = reiner Text (fuer die Haeufigkeitszaehlung),
    #    `entries_text` = derselbe Text MIT Datum/Wochentag (fuer den Prompt, damit
    #    das Modell zeitliche Aussagen nicht erfinden muss).
    if input.entries:
        entries = [e for e in input.entries if e and e.strip()]
        entries_text = "\n---\n".join(entries)
        sentiment_hint = ""
    else:
        rows = get_entries_since(_since(input.days))
        rows = [r for r in rows if r.get("content", "").strip()]
        entries = [r["content"] for r in rows]
        entries_text = "\n---\n".join(_with_date(r) for r in rows)
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
    prompt = build_pattern_prompt(entries_text, sentiment_hint)

    try:
        response_text = await _ollama_generate(prompt)
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)

        if json_match:
            try:
                pattern_data = json.loads(json_match.group())
            except Exception:
                logger.warning("JSON parse failed, returning empty result")
                pattern_data = empty_patterns()
        else:
            logger.warning("No JSON in response, returning empty result")
            pattern_data = empty_patterns()

        # Defensiv normalisieren (Modell haelt sich nicht immer ans Schema)
        pattern_data = _normalize(pattern_data)

        # Halluzinationen entfernen: nur Inhalte behalten, die wirklich in den
        # Eintraegen stehen und oft genug wiederkehren.
        theme_counts = _theme_counts(pattern_data["recurring_themes"], entries)
        pattern_data = _filter_hallucinations(pattern_data, theme_counts, entries)
        theme_counts = pattern_data.pop("_kept_counts")

        # Vergleich mit der VORHERIGEN Analyse (echtes Zeitfenster, nicht die
        # Analyse von vor 5 Minuten): neue Themen + Anstieg/Rueckgang. Wir nehmen
        # die letzte Analyse, die aelter als das aktuelle Fenster ist.
        prev = _previous_pattern(input.days)
        prev_counts = prev.get("theme_counts", {}) if prev else {}
        prev_themes = list(prev_counts.keys()) if prev else []
        new_themes = [t for t in pattern_data["recurring_themes"]
                      if not _matches_any(t, prev_themes)]
        theme_changes = {}
        for theme in pattern_data["recurring_themes"]:
            match = _matches_any(theme, prev_themes)
            if match is None:
                theme_changes[theme] = "neu"
                continue
            count, prev_count = theme_counts.get(theme, 0), prev_counts.get(match, 0)
            if count > prev_count:
                theme_changes[theme] = "gestiegen"
            elif count < prev_count:
                theme_changes[theme] = "gesunken"
            else:
                theme_changes[theme] = "gleich"

        pattern_data["theme_counts"] = theme_counts
        pattern_data["new_themes"] = new_themes
        pattern_data["theme_changes"] = theme_changes
        logger.info("Patterns detected: %d themes after filtering",
                    len(pattern_data["recurring_themes"]))

        # Leerfall: bleibt nach dem Filtern nichts Belastbares uebrig, geben wir
        # ehrlich "kein Muster" zurueck - und speichern NICHT (ein leerer Eintrag
        # wuerde den naechsten Wochenvergleich verfaelschen).
        if not pattern_data["recurring_themes"] and not pattern_data["recurring_people"]:
            logger.info("No grounded pattern after filtering, returning no_pattern")
            return {"status": "no_pattern", "entry_count": len(entries)}

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
