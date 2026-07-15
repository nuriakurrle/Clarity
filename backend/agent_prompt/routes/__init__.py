"""API Routes for Prompt Agent."""

import logging
import json
import re
import random
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException

# Import schemas and tools - use relative import for Docker compatibility
try:
    from schemas import (
        PromptRequest,
        PromptResponse,
        PromptsGenerateRequest,
        PromptsGenerateResponse,
        StarterPromptRequest,
        WeeklyReflectionRequest,
        HealthResponse,
    )
    from tools.prompt_library import get_prompt_by_category, library_prompts, PROMPT_LIBRARY
    from tools.context_analyzer import ContextAnalyzer
    from tools.context_fetcher import gather_context
except ImportError:
    # Fallback for local development
    from backend.agent_prompt.schemas import (
        PromptRequest,
        PromptResponse,
        PromptsGenerateRequest,
        PromptsGenerateResponse,
        StarterPromptRequest,
        WeeklyReflectionRequest,
        HealthResponse,
    )
    from backend.agent_prompt.tools.prompt_library import get_prompt_by_category, library_prompts, PROMPT_LIBRARY
    from backend.agent_prompt.tools.context_analyzer import ContextAnalyzer
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


@router.post("/generate-prompt", response_model=PromptResponse)
async def generate_prompt(request: PromptRequest):
    """Generate a single contextual prompt.
    
    Uses Ollama + CrewAI to generate reflective questions.
    """
    try:
        # Determine prompt type based on context
        prompt_type, subcategory, reason = ContextAnalyzer.choose_prompt_type(
            context=request.context,
            sentiment=request.sentiment_data.model_dump() if request.sentiment_data else None,
            patterns=request.detected_patterns,
            streak_days=request.streak_days or 0,
            user_history_ids=request.user_history_ids,
        )
        
        logger.info(f"💭 Generating {prompt_type} prompt: {reason}")
        
        # Get prompts from library or generate with Ollama
        if prompt_type == "starter":
            # Zweiter Parameter ist die Sprache – hier stand versehentlich der
            # Journal-Text, wodurch die Liste leer blieb und immer derselbe
            # Fallback-String zurückkam statt der 5 kuratierten Starter-Fragen.
            prompts = get_prompt_by_category("starter", "de")
            question = random.choice(prompts) if prompts else "Was beschäftigt dich gerade?"
        elif prompt_type == "safety":
            prompts = get_prompt_by_category("safety")
            question = random.choice(prompts) if prompts else "Du bist nicht allein. Lass uns darüber sprechen."
        elif prompt_type == "streak_break":
            prompts = get_prompt_by_category("streak_break")
            question = random.choice(prompts) if prompts else "Willkommen zurück! Wie geht es dir?"
        elif prompt_type == "temporal" and subcategory:
            prompts = get_prompt_by_category("temporal", "de", subcategory)
            question = random.choice(prompts) if prompts else "Was beschäftigt dich?"
        elif prompt_type == "pattern_based" and subcategory:
            prompts = get_prompt_by_category("pattern_based", "de", subcategory)
            question = random.choice(prompts) if prompts else "Erzähl mir mehr darüber."
        elif prompt_type == "sentiment_based" and subcategory:
            prompts = get_prompt_by_category("sentiment_based", "de", subcategory)
            question = random.choice(prompts) if prompts else "Wie fühlst du dich?"
        else:
            # Fallback with Ollama generation
            question = await _generate_with_ollama(request.journal_text)
        
        logger.info(f"✅ Prompt generated: {question}")
        
        return PromptResponse(
            question=question,
            prompt_type=prompt_type,
            category=prompt_type,
            subcategory=subcategory,
            context_reason=reason,
            suggested_timing=_suggest_timing(prompt_type),
            entry_id=request.entry_id,
            language="de",
        )
    
    except Exception as e:
        logger.error(f"❌ Error generating prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Prompt generation failed: {str(e)}")


@router.post("/generate-starter", response_model=PromptResponse)
async def generate_starter(request: StarterPromptRequest):
    """Generate a starter prompt for blank page prevention.
    
    Returns one of the curated starter questions.
    """
    prompts = get_prompt_by_category("starter", request.language)
    
    if not prompts:
        prompts = ["Was beschäftigt dich gerade am meisten?"]
    
    question = random.choice(prompts)
    
    return PromptResponse(
        question=question,
        prompt_type="starter",
        category="starter",
        context_reason="Blank page prevention - curated starter question",
        suggested_timing="immediate",
        language=request.language,
    )


@router.post("/generate-weekly-reflection", response_model=dict)
async def generate_weekly_reflection(request: WeeklyReflectionRequest):
    """Generate 3-5 deep questions for weekly digest.
    
    Combines multiple prompt categories for deeper reflection.
    """
    prompts_set = []
    
    # Mix categories
    for category in ["sentiment_based", "pattern_based", "temporal"]:
        if category == "temporal":
            prompts = get_prompt_by_category(category, request.language, "weekly_reflection")
        else:
            # Get a random subcategory
            lib = PROMPT_LIBRARY.get(category, {})
            if lib:
                subcats = list(lib.keys())
                if subcats:
                    subcat = random.choice(subcats)
                    prompts = get_prompt_by_category(category, request.language, subcat)
            else:
                prompts = []
        
        if prompts:
            prompts_set.append(random.choice(prompts))
    
    return {
        "questions": prompts_set[:5],
        "prompt_type": "weekly_reflection",
        "context_reason": "Weekly deep reflection - mixed categories",
        "language": request.language,
    }


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
            f"\nVERMEIDE diese Themen komplett: "
            f"{', '.join(blocked_topics)}."
        )

    if is_starter:
        return (
            "Du bist eine sanfte Journaling-Begleiterin. Die Seite ist fast leer."
            f"{ctx_block}{avoid}\n"
            "Stelle 4 kurze, warme Einstiegsfragen auf Deutsch. Wenn Kontext "
            "(Stimmung, Themen, Wochenrückblick) gegeben ist, beziehe dich darauf.\n\n"
            'Antworte NUR mit JSON:\n{"prompts": ["F1?","F2?","F3?","F4?"]}'
        )
    return (
        "Du bist eine sanfte Journaling-Begleiterin. "
        f"Grundlage (Deutsch):\n\"{content}\"\n{ctx_block}{avoid}\n"
        "Stelle 4 kurze, tiefe Reflexionsfragen auf Deutsch. Beziehe dich, "
        "wo sinnvoll, auf Stimmung, wiederkehrende Themen und den "
        "Wochenrückblick.\n\n"
        'Antworte NUR mit JSON:\n{"prompts": ["F1?","F2?","F3?","F4?"]}'
    )


def _filter_blocked(prompts: list[str], blocked: Optional[list[str]]) -> list[str]:
    if not blocked:
        return prompts
    low = [b.lower() for b in blocked if b.strip()]
    return [p for p in prompts if not any(b in p.lower() for b in low)]


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
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{OLLAMA_HOST}/api/generate",
                    json={
                        "model": MODEL,
                        "prompt": _build_prompts_prompt(
                            content, sentiment, pattern, digest,
                            request.blocked_topics, is_starter,
                        ),
                        "stream": False,
                        "options": {"temperature": 0.6},
                    },
                )
                raw = response.json().get("response", "")
                match = re.search(r'\{.*?"prompts".*?\}', raw, re.DOTALL)
                if match:
                    prompts = json.loads(match.group()).get("prompts", [])
        except Exception as e:
            logger.error(f"❌ Ollama offline, nutze Bibliothek: {e}")

    prompts = [p for p in prompts if isinstance(p, str) and p.strip()]

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


async def _generate_with_ollama(text: str) -> str:
    """Generate prompt using Ollama (fallback)."""
    if not OLLAMA_HOST or not MODEL:
        return "Was beschäftigt dich gerade?"
    
    prompt_template = f"""Generiere EINE reflektive Frage aus diesem Journal-Eintrag.

"{text}"

Antwort: Nur die Frage, ohne Nummerierung."""
    
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={
                    "model": MODEL,
                    "prompt": prompt_template,
                    "stream": False,
                    "temperature": 0.7,
                }
            )
            result = response.json()
            return result.get("response", "Was beschäftigt dich?").strip()
    except Exception as e:
        logger.error(f"Ollama generation failed: {e}")
        return "Erzähl mir mehr darüber."


def _suggest_timing(prompt_type: str) -> str:
    """Suggest when to show this prompt."""
    timing_map = {
        "starter": "immediate",
        "sentiment_based": "post_entry",
        "pattern_based": "post_entry",
        "temporal": "context_dependent",
        "safety": "immediate",
        "streak_break": "gentle_reminder",
        "milestone": "celebration",
    }
    return timing_map.get(prompt_type, "post_entry")
