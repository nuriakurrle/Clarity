"""Schemas for Prompt Agent API."""

from pydantic import BaseModel
from typing import Optional


class PromptsGenerateRequest(BaseModel):
    """Request for /generate-prompts (4 context-aware questions).

    Der Agent orchestriert die anderen Agents selbst (live mit persist=false,
    sonst zuletzt gespeicherte Ergebnisse; offline laeuft die Generierung ohne
    Kontext weiter). Die use_*-Flags schalten Komponenten ab; sentiment/
    pattern/digest sind optionale Overrides, falls der Client den Kontext
    schon hat (z. B. Mood-Auswahl im Editor).
    """
    text: str = ""                                # aktueller Entwurf (optional)
    entries: list[str] = []                       # bisherige Eintraege (optional)
    use_sentiment: bool = True
    use_pattern: bool = True
    use_digest: bool = False                      # /create-digest ist teuer (LLM)
    sentiment: Optional[dict] = None              # Override {sentiment, emotions}
    pattern: Optional[dict] = None                # Override {top_themes, mood_trend, triggers}
    digest: Optional[dict] = None                 # Override {summary, ...}
    blocked_topics: Optional[list[str]] = None
    entry_id: Optional[int] = None


class PromptsGenerateResponse(BaseModel):
    """Response for /generate-prompts."""
    prompts: list[str]
    mode: str                     # "starter" | "reflection"
    source: str                   # "ollama" | "library" | "mixed"
    context_used: list[str] = []  # tatsaechlich eingeflossene Agents


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    agent: str
    port: int = 8003
