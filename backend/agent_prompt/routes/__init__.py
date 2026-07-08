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
        StarterPromptRequest,
        WeeklyReflectionRequest,
        HealthResponse,
    )
    from tools.prompt_library import get_prompt_by_category, PROMPT_LIBRARY
    from tools.context_analyzer import ContextAnalyzer
except ImportError:
    # Fallback for local development
    from backend.agent_prompt.schemas import (
        PromptRequest,
        PromptResponse,
        StarterPromptRequest,
        WeeklyReflectionRequest,
        HealthResponse,
    )
    from backend.agent_prompt.tools.prompt_library import get_prompt_by_category, PROMPT_LIBRARY
    from backend.agent_prompt.tools.context_analyzer import ContextAnalyzer

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
            prompts = get_prompt_by_category("starter", request.journal_text[:100] or "default")
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
