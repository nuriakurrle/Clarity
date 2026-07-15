"""Orchestriert die anderen Agents fuer den Prompt-Kontext.

Pro Komponente gilt die Leiter:
  1. Override aus dem Request (Client hat den Kontext schon)
  2. LIVE-Analyse beim jeweiligen Agent mit persist=false
  3. Zuletzt gespeichertes Ergebnis ueber die lesenden Endpoints
  4. None -> die Generierung laeuft ohne diesen Kontext weiter (Offline-Modus)

WICHTIG (Koordination, siehe README): Die persist-Flag ist eine additive
Aenderung, die jede Agent-Ownerin selbst in ihrem main.py ergaenzt. Solange
ein Endpoint die Flag NICHT anbietet, wuerde Pydantic sie stillschweigend
ignorieren und der Aufruf wuerde trotzdem speichern - beim Sentiment-Agent
entstuende ein Geister-Eintrag in `entries`. Deshalb wird vor jedem
Live-Aufruf ueber /openapi.json geprueft, ob `persist` im Request-Schema
existiert; wenn nicht, wird der Agent uebersprungen (Stufe 3 greift).
"""

import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)

# Defaults = Service-Namen aus docker-compose (clarity-network)
SENTIMENT_AGENT_URL = (
    os.getenv("SENTIMENT_URL")
    or os.getenv("SENTIMENT_AGENT_URL", "http://agent_sentiment:8000")
)
PATTERN_AGENT_URL = (
    os.getenv("PATTERN_URL")
    or os.getenv("PATTERN_AGENT_URL", "http://agent_pattern:8000")
)
DIGEST_AGENT_URL = (
    os.getenv("DIGEST_URL")
    or os.getenv("DIGEST_AGENT_URL", "http://agent_digest:8000")
)

# Live-Analysen laufen durchs LLM und brauchen Zeit; lesende Aufrufe nicht.
LIVE_TIMEOUT_SECONDS = 45.0
READ_TIMEOUT_SECONDS = 5.0

# Nur positive Probe-Ergebnisse cachen: hat eine Kollegin die Flag einmal
# deployt, bleibt sie; ein "noch nicht" darf sich pro Request selbst heilen.
_persist_ok: dict[str, bool] = {}


async def _supports_persist(client: httpx.AsyncClient, base_url: str, path: str) -> bool:
    """Prueft via OpenAPI-Schema, ob der Endpoint eine persist-Flag hat."""
    key = f"{base_url}{path}"
    if _persist_ok.get(key):
        return True
    try:
        response = await client.get(f"{base_url}/openapi.json", timeout=READ_TIMEOUT_SECONDS)
        spec = response.json()
        body = spec["paths"][path]["post"]["requestBody"]["content"]["application/json"]["schema"]
        if "$ref" in body:
            schema = spec["components"]["schemas"][body["$ref"].split("/")[-1]]
        else:
            schema = body
        supported = "persist" in (schema.get("properties") or {})
        if supported:
            _persist_ok[key] = True
        else:
            logger.info(
                f"ℹ️ {base_url}{path} hat noch keine persist-Flag – "
                "Live-Aufruf uebersprungen, nutze gespeicherten Kontext"
            )
        return supported
    except Exception as e:
        logger.warning(f"⚠️ OpenAPI-Probe fehlgeschlagen ({base_url}): {e}")
        return False


async def _get_json(client: httpx.AsyncClient, url: str) -> dict | None:
    try:
        response = await client.get(url, timeout=READ_TIMEOUT_SECONDS)
        if response.status_code == 200:
            return response.json()
        logger.info(f"ℹ️ Kontext {url}: HTTP {response.status_code}")
    except Exception as e:
        logger.warning(f"⚠️ Kontext-Agent nicht erreichbar ({url}): {e}")
    return None


async def _post_json(client: httpx.AsyncClient, url: str, payload: dict) -> dict | None:
    try:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.warning(f"⚠️ Live-Analyse uebersprungen ({url}): {e}")
    return None


# --- Normalisierung auf {sentiment, emotions} / {top_themes, mood_trend, triggers} ---

def _normalize_live_sentiment(data: dict | None) -> dict | None:
    """POST /analyze (persist=false) -> {sentiment, emotions}."""
    if not data:
        return None
    analysis = data.get("analysis") if isinstance(data.get("analysis"), dict) else data
    if not analysis.get("sentiment"):
        # z. B. {"entry_id":..,"status":"queued"} -> keine verwertbare Analyse
        return None
    emotions = analysis.get("emotions") or [
        e for e in [analysis.get("primary_emotion"), *(analysis.get("secondary_emotions") or [])] if e
    ]
    return {"sentiment": analysis["sentiment"], "emotions": emotions}


def _normalize_stored_sentiment(data: dict | None) -> dict | None:
    """GET /emotional-summary -> {sentiment, emotions}."""
    if not data:
        return None
    summary = data.get("summary") or {}
    distribution = summary.get("sentiment_distribution") or {}
    top_emotions = summary.get("top_emotions") or []
    if not distribution and not top_emotions:
        return None
    return {
        "sentiment": max(distribution, key=distribution.get) if distribution else None,
        "emotions": [e.get("emotion") for e in top_emotions[:3] if e.get("emotion")],
    }


def _normalize_pattern(data: dict | None) -> dict | None:
    """POST /detect-patterns bzw. GET /patterns/latest -> {top_themes, ...}."""
    if not data or data.get("status") in ("no_data", "insufficient_data"):
        return None
    themes = data.get("recurring_themes") or data.get("top_themes") or []
    if not themes and not data.get("mood_trend"):
        return None
    return {
        "top_themes": themes,
        "mood_trend": data.get("mood_trend"),
        "triggers": data.get("triggers") or {},
    }


def _normalize_digest(data: dict | None) -> dict | None:
    """POST /create-digest bzw. GET /digest/latest -> Digest mit Summary."""
    if not data or not data.get("summary"):
        return None
    return data


# --- Komponenten-Leitern (Override -> live -> gespeichert -> None) -----------

async def _sentiment_context(client, text: str) -> tuple[dict | None, str | None]:
    if text.strip() and await _supports_persist(client, SENTIMENT_AGENT_URL, "/analyze"):
        live = _normalize_live_sentiment(
            await _post_json(client, f"{SENTIMENT_AGENT_URL}/analyze",
                             {"text": text, "persist": False})
        )
        if live:
            return live, "live"
    stored = _normalize_stored_sentiment(
        await _get_json(client, f"{SENTIMENT_AGENT_URL}/emotional-summary?period=week")
    )
    return stored, "stored" if stored else None


async def _pattern_context(client, entries: list[str]) -> tuple[dict | None, str | None]:
    if len(entries) >= 2 and await _supports_persist(client, PATTERN_AGENT_URL, "/detect-patterns"):
        live = _normalize_pattern(
            await _post_json(client, f"{PATTERN_AGENT_URL}/detect-patterns",
                             {"entries": entries, "persist": False})
        )
        if live:
            return live, "live"
    stored = _normalize_pattern(
        await _get_json(client, f"{PATTERN_AGENT_URL}/patterns/latest")
    )
    return stored, "stored" if stored else None


async def _digest_context(client, entries: list[str]) -> tuple[dict | None, str | None]:
    if entries and await _supports_persist(client, DIGEST_AGENT_URL, "/create-digest"):
        live = _normalize_digest(
            await _post_json(client, f"{DIGEST_AGENT_URL}/create-digest",
                             {"entries": entries, "persist": False})
        )
        if live:
            return live, "live"
    stored = _normalize_digest(
        await _get_json(client, f"{DIGEST_AGENT_URL}/digest/latest")
    )
    return stored, "stored" if stored else None


async def _skip() -> tuple[None, None]:
    return None, None


async def gather_context(
    text: str,
    entries: list[str],
    use_sentiment: bool = True,
    use_pattern: bool = True,
    use_digest: bool = False,
    sentiment_override: dict | None = None,
    pattern_override: dict | None = None,
    digest_override: dict | None = None,
) -> tuple[dict | None, dict | None, dict | None, dict[str, str]]:
    """Sammelt den Kontext parallel; Ausfaelle degradieren pro Komponente.

    Gibt (sentiment, pattern, digest, modes) zurueck. modes nennt pro
    gelieferter Komponente die Quelle: "override" | "live" | "stored".
    """
    async with httpx.AsyncClient(timeout=LIVE_TIMEOUT_SECONDS) as client:
        results = await asyncio.gather(
            _sentiment_context(client, text)
            if use_sentiment and sentiment_override is None else _skip(),
            _pattern_context(client, entries)
            if use_pattern and pattern_override is None else _skip(),
            _digest_context(client, entries)
            if use_digest and digest_override is None else _skip(),
        )

    values, modes = {}, {}
    for name, override, (fetched, mode) in (
        ("sentiment", sentiment_override, results[0]),
        ("pattern", pattern_override, results[1]),
        ("digest", digest_override, results[2]),
    ):
        values[name] = override or fetched
        if override:
            modes[name] = "override"
        elif mode:
            modes[name] = mode

    return values["sentiment"], values["pattern"], values["digest"], modes
