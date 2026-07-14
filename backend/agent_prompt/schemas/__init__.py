"""Schemas for Prompt Agent API."""

from pydantic import BaseModel
from typing import Optional


class SentimentData(BaseModel):
    """Sentiment analysis data from agent_sentiment."""
    label: str  # "positive", "negative", "neutral", "anxious", "sad"
    score: float  # 0.0 to 1.0
    distress_score: Optional[float] = None  # 0.0 to 1.0 for safety detection


class PromptRequest(BaseModel):
    """Request for prompt generation."""
    journal_text: str
    sentiment_data: Optional[SentimentData] = None
    detected_patterns: Optional[list[str]] = None  # ["work", "relationships", ...]
    context: str = "editor_open"  # "editor_open", "post_entry", "home_screen", "weekly"
    user_history_ids: Optional[list[str]] = None  # Already used prompts
    entry_id: Optional[int] = None
    streak_days: Optional[int] = 0


class GeneratedPrompt(BaseModel):
    """A single generated prompt."""
    id: str
    text: str
    category: str
    subcategory: Optional[str] = None
    language: str = "de"


class PromptResponse(BaseModel):
    """Response with generated prompts."""
    question: str
    prompt_type: str  # "starter", "sentiment_based", "pattern_based", "safety", etc.
    category: str  # For tracking
    subcategory: Optional[str] = None
    context_reason: str  # Why this prompt was chosen
    suggested_timing: Optional[str] = None
    entry_id: Optional[int] = None
    language: str = "de"


class StarterPromptRequest(BaseModel):
    """Request for blank-page prevention."""
    context: str = "editor_open"
    language: str = "de"


class WeeklyReflectionRequest(BaseModel):
    """Request for weekly reflection prompts."""
    user_id: Optional[str] = None
    week_number: Optional[int] = None
    language: str = "de"


class PromptsGenerateRequest(BaseModel):
    """Request for /generate-prompts (4 context-aware questions).

    sentiment/pattern/digest sind optionale Overrides. Fehlen sie, holt der
    Agent den Kontext selbst von den anderen Agents (best-effort; offline
    laeuft die Generierung ohne Kontext weiter).
    """
    text: str = ""                                # aktueller Entwurf (optional)
    entries: list[str] = []                       # bisherige Eintraege (optional)
    sentiment: Optional[dict] = None              # {sentiment, confidence, emotions}
    pattern: Optional[dict] = None                # {top_themes, mood_trend, triggers}
    digest: Optional[dict] = None                 # {summary, highlights, challenges, growth}
    blocked_topics: Optional[list[str]] = None
    entry_id: Optional[int] = None


class PromptsGenerateResponse(BaseModel):
    """Response for /generate-prompts."""
    prompts: list[str]
    mode: str    # "starter" | "reflection"
    source: str  # "ollama" | "library" | "mixed"


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    agent: str
    port: int = 8003
