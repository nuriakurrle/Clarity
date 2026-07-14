"""Holt optionalen Kontext von den anderen Agents (Sentiment / Pattern / Digest).

Alle Aufrufe sind best-effort mit kurzem Timeout: Ist ein Agent nicht
erreichbar (Offline-Modus), liefert die jeweilige Funktion None und die
Prompt-Generierung laeuft einfach ohne diesen Kontext weiter. Es werden nur
lesende Endpoints genutzt – es entstehen keine neuen Eintraege.
"""

import asyncio
import logging
import os

import httpx

logger = logging.getLogger(__name__)

# Defaults = Service-Namen aus docker-compose (clarity-network)
SENTIMENT_AGENT_URL = os.getenv("SENTIMENT_AGENT_URL", "http://agent_sentiment:8000")
PATTERN_AGENT_URL = os.getenv("PATTERN_AGENT_URL", "http://agent_pattern:8000")
DIGEST_AGENT_URL = os.getenv("DIGEST_AGENT_URL", "http://agent_digest:8000")

# Kurz halten: der Nutzer wartet im Editor auf seine Fragen.
CONTEXT_TIMEOUT_SECONDS = 5.0


async def _get_json(client: httpx.AsyncClient, url: str) -> dict | None:
    try:
        response = await client.get(url)
        if response.status_code == 200:
            return response.json()
        logger.info(f"ℹ️ Kontext {url}: HTTP {response.status_code}")
    except Exception as e:
        logger.warning(f"⚠️ Kontext-Agent nicht erreichbar ({url}): {e}")
    return None


def _normalize_sentiment(data: dict | None) -> dict | None:
    """GET /emotional-summary -> {sentiment, emotions} fuer den Prompt-Kontext."""
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
    """GET /patterns/latest -> {top_themes, mood_trend, triggers}."""
    if not data or data.get("status") in ("no_data", "insufficient_data"):
        return None
    return {
        "top_themes": data.get("recurring_themes") or [],
        "mood_trend": data.get("mood_trend"),
        "triggers": data.get("triggers") or {},
    }


def _normalize_digest(data: dict | None) -> dict | None:
    """GET /digest/latest -> unveraendert, sofern eine Summary existiert."""
    if not data or not data.get("summary"):
        return None
    return data


async def fetch_context(
    need_sentiment: bool = True,
    need_pattern: bool = True,
    need_digest: bool = True,
) -> tuple[dict | None, dict | None, dict | None]:
    """Sammelt fehlenden Kontext parallel von den anderen Agents.

    Gibt (sentiment, pattern, digest) zurueck; jede Komponente ist None,
    wenn sie nicht angefragt wurde oder der Agent offline ist.
    """
    if not (need_sentiment or need_pattern or need_digest):
        return None, None, None

    async with httpx.AsyncClient(timeout=CONTEXT_TIMEOUT_SECONDS) as client:
        tasks = {}
        if need_sentiment:
            tasks["sentiment"] = _get_json(
                client, f"{SENTIMENT_AGENT_URL}/emotional-summary?period=week"
            )
        if need_pattern:
            tasks["pattern"] = _get_json(client, f"{PATTERN_AGENT_URL}/patterns/latest")
        if need_digest:
            tasks["digest"] = _get_json(client, f"{DIGEST_AGENT_URL}/digest/latest")

        values = await asyncio.gather(*tasks.values())
        results = dict(zip(tasks.keys(), values))

    return (
        _normalize_sentiment(results.get("sentiment")),
        _normalize_pattern(results.get("pattern")),
        _normalize_digest(results.get("digest")),
    )
