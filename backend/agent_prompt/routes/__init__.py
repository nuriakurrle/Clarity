"""API Routes for Prompt Agent.

Zwei Endpoints: /health und /generate-prompts (Orchestrator). Die alten
Einzel-Endpoints (/generate-prompt, /generate-starter,
/generate-weekly-reflection) hatte kein Client mehr aufgerufen und wurden
entfernt – das Frontend nutzt ausschliesslich /generate-prompts.
"""

import logging
import json
import re
from typing import Optional

import httpx
from fastapi import APIRouter

# Import schemas and tools - use relative import for Docker compatibility
try:
    from schemas import (
        PromptsGenerateRequest,
        PromptsGenerateResponse,
        HealthResponse,
    )
    from tools.prompt_library import library_prompts
    from tools.context_fetcher import gather_context
except ImportError:
    # Fallback for local development
    from backend.agent_prompt.schemas import (
        PromptsGenerateRequest,
        PromptsGenerateResponse,
        HealthResponse,
    )
    from backend.agent_prompt.tools.prompt_library import library_prompts
    from backend.agent_prompt.tools.context_fetcher import gather_context

# Persistenz ist optional (lokale Entwicklung ohne shared/-Mount)
try:
    from database import save_prompts
except ImportError:
    def save_prompts(entry_id, prompts):
        logging.getLogger(__name__).warning("⚠️  save_prompts unavailable (local dev mode)")

logger = logging.getLogger(__name__)

router = APIRouter()

OLLAMA_HOST = None
MODEL = None

# Ollama laedt das Modell beim ersten Request in den RAM – auf CPU dauert das
# zusammen mit der Generierung deutlich laenger als eine warme Anfrage. 30s
# waren zu knapp und kippten jede kalte Anfrage in den Bibliotheks-Fallback.
GENERATE_TIMEOUT_SECONDS = 90

# Modell zwischen Requests im RAM behalten – das Standard-keep_alive (5m)
# entlaedt es im Leerlauf und jede Bubble-Anfrage zahlt den Kaltstart neu.
KEEP_ALIVE = "30m"

# JSON-Schema fuer Ollamas strukturierte Ausgabe: llama3.2 haelt sich ohne
# format-Zwang nicht zuverlaessig an {"prompts": [...]} (liefert z. B.
# {"prompt1": ..., "prompt2": ...}) und der Parser liefe ins Leere.
PROMPTS_SCHEMA = {
    "type": "object",
    "properties": {
        "prompts": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 4,
            "maxItems": 4,
        },
    },
    "required": ["prompts"],
}


def set_ollama_config(host: str, model: str):
    """Initialize Ollama config."""
    global OLLAMA_HOST, MODEL
    OLLAMA_HOST = host
    MODEL = model


@router.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "agent": "prompt",
        "port": 8003,
    }


@router.post("/generate-prompts", response_model=PromptsGenerateResponse)
async def generate_prompts(request: PromptsGenerateRequest):
    """Generate 4 context-aware reflection prompts (Orchestrator).

    Ruft die anderen Agents live mit persist=false auf (bzw. liest deren
    zuletzt gespeicherte Ergebnisse, solange ein Agent die Flag noch nicht
    anbietet) und generiert dann via Ollama. Faellt ein Agent oder Ollama aus
    (Offline-Modus), wird die Komponente uebersprungen bzw. kommen die Fragen
    aus der lokalen Bibliothek. Legt KEINE Eintraege an (nur save_prompts).
    """
    content = _prompts_content(request)
    is_starter = len(content) < 15
    source = "ollama"
    prompts: list[str] = []

    # 0) Kontext orchestrieren (Override -> live persist=false -> gespeichert)
    sentiment, pattern, digest, context_modes = await gather_context(
        text=request.text,
        entries=request.entries,
        use_sentiment=request.use_sentiment,
        use_pattern=request.use_pattern,
        use_digest=request.use_digest,
        sentiment_override=request.sentiment,
        pattern_override=request.pattern,
        digest_override=request.digest,
    )

    # 1) Versuch: Ollama-Generierung mit Kontext
    if OLLAMA_HOST and MODEL:
        try:
            async with httpx.AsyncClient(timeout=GENERATE_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{OLLAMA_HOST}/api/generate",
                    json={
                        "model": MODEL,
                        "prompt": _build_prompts_prompt(
                            content, sentiment, pattern, digest,
                            request.blocked_topics, is_starter,
                        ),
                        "stream": False,
                        "format": PROMPTS_SCHEMA,
                        "keep_alive": KEEP_ALIVE,
                        # num_predict: 4 kurze Fragen brauchen keine langen
                        # Antworten – auf CPU zaehlt jeder gesparte Token.
                        # temperature moderat: das 1b-Modell driftet bei 0.6
                        # oefter in Aussagesaetze statt Fragen ab.
                        "options": {"temperature": 0.4, "num_predict": 250},
                    },
                )
                prompts = _parse_prompts(response.json().get("response", ""))
        except Exception as e:
            # repr statt str: httpx.ReadTimeout hat eine leere Message
            logger.error(f"❌ Ollama offline, nutze Bibliothek: {e!r}")

    # Das 1b-Modell liefert gelegentlich Platzhalter ("F1?") oder JSON-Reste
    # ("}") statt echter Fragen – die duerfen nicht in der App landen,
    # sondern kippen in die Bibliotheks-Auffuellung.
    prompts = [p.strip() for p in prompts if _plausible_prompt(p)]

    # 2) Offline-Modus / Auffuellung aus der Bibliothek
    if len(prompts) < 4:
        source = "library" if not prompts else "mixed"
        for p in library_prompts(
            sentiment=sentiment,
            pattern=pattern,
            digest=digest,
            is_starter=is_starter,
            n=6,
        ):
            if p not in prompts:
                prompts.append(p)

    # 3) blockierte Themen filtern, auf 4 begrenzen
    prompts = _filter_blocked(prompts, request.blocked_topics)[:4]

    # 4) speichern (entry_id optional, KEIN save_entry)
    try:
        save_prompts(request.entry_id, prompts)
    except Exception as e:
        logger.error(f"⚠️ save_prompts non-fatal: {e}")

    logger.info(f"💾 {len(prompts)} prompts | source={source} | context={context_modes}")
    return PromptsGenerateResponse(
        prompts=prompts,
        mode="starter" if is_starter else "reflection",
        source=source,
        context_used=list(context_modes.keys()),
    )


def _plausible_prompt(p) -> bool:
    """Echte Frage statt Platzhalter, Fragment oder Aussagesatz."""
    if not isinstance(p, str):
        return False
    p = p.strip()
    return len(p) >= 10 and " " in p and p.endswith("?")


def _parse_prompts(raw: str) -> list[str]:
    """Zieht {"prompts": [...]} tolerant aus der Modell-Antwort."""
    try:
        data = json.loads(raw)
    except ValueError:
        match = re.search(r'\{.*?"prompts".*?\}', raw, re.DOTALL)
        if not match:
            return []
        try:
            data = json.loads(match.group())
        except ValueError:
            return []
    if not isinstance(data, dict):
        return []
    prompts = data.get("prompts")
    if isinstance(prompts, list):
        return prompts
    # Notnagel fuer {"prompt1": "...", "prompt2": "..."} und Aehnliches
    return [v for v in data.values() if isinstance(v, str)]


def _prompts_content(request: PromptsGenerateRequest) -> str:
    """Aktueller Entwurf oder – falls leer – bisherige Eintraege."""
    if request.text.strip():
        return request.text.strip()
    return "\n---\n".join(request.entries).strip()


def _prompts_context_lines(
    sentiment: Optional[dict], pattern: Optional[dict], digest: Optional[dict]
) -> str:
    """Baut den Kontextblock aus Sentiment / Pattern / Digest."""
    lines = []
    if sentiment:
        emo = ", ".join(sentiment.get("emotions", []) or [])
        lines.append(
            f"Stimmung: {sentiment.get('sentiment', '?')}"
            + (f" (Emotionen: {emo})" if emo else "")
        )
    if pattern:
        themes = ", ".join(pattern.get("top_themes", []) or [])
        if themes:
            lines.append(f"Wiederkehrende Themen: {themes}")
        if pattern.get("mood_trend"):
            lines.append(f"Stimmungstrend: {pattern['mood_trend']}")
    if digest and digest.get("summary"):
        lines.append(f"Wochenrückblick: {digest['summary'][:200]}")
    return "\n".join(lines)


def _build_prompts_prompt(
    content: str,
    sentiment: Optional[dict],
    pattern: Optional[dict],
    digest: Optional[dict],
    blocked_topics: Optional[list[str]],
    is_starter: bool,
) -> str:
    ctx = _prompts_context_lines(sentiment, pattern, digest)
    ctx_block = f"\nKontext:\n{ctx}\n" if ctx else ""
    avoid = ""
    if blocked_topics:
        avoid = (
            f" Vermeide diese Themen komplett: "
            f"{', '.join(blocked_topics)}."
        )

    # Prompt-Aufbau fuers 1b-Modell: keine Persona ("Du bist eine ...")
    # und kein JSON-Beispiel – beides echot das Modell als Antwort. Inhalt
    # zuerst, Aufgabe ans Ende, Fragen-Zwang explizit, sonst kommen
    # Aussagesaetze. Die JSON-Struktur erzwingt PROMPTS_SCHEMA via format.
    if is_starter:
        return (
            "Eine Person öffnet ihr Tagebuch, die Seite ist noch leer.\n"
            f"{ctx_block}\n"
            "Aufgabe: Formuliere 4 kurze, warme Einstiegsfragen auf Deutsch, "
            "die der Person den Start ins Schreiben erleichtern. Beziehe dich "
            "auf den Kontext, wenn er hilfreich ist. Sprich die Person mit du "
            "an. Jede Frage endet mit einem Fragezeichen. Schreibe keine "
            f"Aussagen, nur Fragen.{avoid}"
        )
    return (
        f"Tagebucheintrag:\n\"{content}\"\n"
        f"{ctx_block}\n"
        "Aufgabe: Formuliere 4 kurze, tiefe Reflexionsfragen auf Deutsch an "
        "die Person, die diesen Eintrag geschrieben hat. Beziehe dich auf "
        "den Eintrag und den Kontext. Sprich die Person mit du an. Jede "
        "Frage endet mit einem Fragezeichen. Schreibe keine Aussagen, nur "
        f"Fragen.{avoid}"
    )


def _filter_blocked(prompts: list[str], blocked: Optional[list[str]]) -> list[str]:
    if not blocked:
        return prompts
    low = [b.lower() for b in blocked if b.strip()]
    return [p for p in prompts if not any(b in p.lower() for b in low)]
