"""CrewAI Sentiment Agent - Emotional Tone Analyst.

Der Agent analysiert die emotionale Tönung einzelner Journal-Einträge:
Sentiment, Valenz, Intensität sowie primäre und sekundäre Emotionen.

Aufbau analog zu Pattern- und Digest-Agent (``agent_pattern/agent.py``,
``agent_digest/agent.py``): Der Agent definiert die "Persona"
(role/goal/backstory). Aus dieser Persona baut ``build_sentiment_prompt`` den
Prompt für das lokale Ollama-Modell zusammen, damit die Agenten-Definition
tatsächlich benutzt wird und kein toter Code ist. ``main.py`` importiert nur
``build_sentiment_prompt``.
"""
import os

# crewai 0.1.0 validiert beim Erzeugen eines Agent() das Vorhandensein eines
# LLM-Keys, obwohl wir die Texte lokal ueber Ollama erzeugen und nie eine Crew
# ausfuehren (kein externer Aufruf). Ein Platzhalter genuegt der Validierung.
os.environ.setdefault("OPENAI_API_KEY", "not-needed-clarity-uses-local-ollama")

from crewai import Agent

sentiment_agent = Agent(
    role="Emotional Analyst & Mood Tracking Specialist",
    goal="""Analyze emotional tone, valence, and intensity in journal entries.
    Identify the primary and secondary emotions and describe the emotional tone
    precisely, so a longitudinal mood profile can be built over time.""",
    backstory="""You are an empathetic psychological analyst with deep expertise in:
    - Emotional intelligence and sentiment analysis
    - Understanding emotional valence (positivity spectrum) and intensity
    - Classifying primary and secondary emotions
    - Providing compassionate, evidence-based emotional insights

    Your role is to help users understand their emotional journey by analyzing
    their journal entries and building a comprehensive mood profile over time.""",
    verbose=True,
    allow_delegation=False,
)

# Selbsteinschätzung (5-stufige Skala der App) → Kontext für das LLM
MOOD_DESCRIPTIONS = {
    "great": "very positive (valence around +0.8)",
    "good": "positive (valence around +0.4)",
    "neutral": "neutral (valence around 0)",
    "low": "somewhat negative (valence around -0.4)",
    "bad": "very negative (valence around -0.8)",
}


def build_sentiment_prompt(text: str, self_reported_mood: str | None = None) -> str:
    """Baut den LLM-Prompt aus der Agenten-Persona + dem Eintrag.

    Wird von ``main.py`` genutzt, damit die oben definierte Agenten-Rolle den
    tatsächlichen Ollama-Aufruf steuert. Das JSON-Ausgabeformat (sentiment,
    valence, intensity, tone, primary_emotion, secondary_emotions, confidence,
    reasoning) ist Vertrag mit DB und Frontend und darf nicht verändert werden.
    """
    mood_hint = ""
    mood_description = MOOD_DESCRIPTIONS.get(self_reported_mood or "")
    if mood_description:
        mood_hint = (
            f"\nWhile writing, the user self-reported their mood as: {mood_description}. "
            "Treat this as helpful additional context, but base your analysis primarily "
            "on the text itself. If text and self-report disagree, mention it in the reasoning.\n"
        )

    return f"""{sentiment_agent.role}.

Your goal: {sentiment_agent.goal}

Analyze the emotional content of this journal entry deeply.

Entry: "{text}"
{mood_hint}

Respond ONLY with valid JSON (no markdown, no explanations) in exactly this structure:
{{
    "sentiment": "<positive, neutral or negative>",
    "valence": <number between -1.0 and 1.0>,
    "intensity": <number between 0 and 100>,
    "tone": "<short description of the emotional tone>",
    "primary_emotion": "<single strongest emotion>",
    "secondary_emotions": ["<emotion>", "<emotion>"],
    "confidence": <number between 0 and 100>,
    "reasoning": "<brief explanation>"
}}

Rules:
- valence measures positivity: -1.0 = very negative, 0.0 = neutral, +1.0 = very positive.
- valence MUST be consistent with sentiment: positive sentiment requires valence > 0, negative sentiment requires valence < 0.
- intensity measures emotional strength: 0 = minimal, 100 = maximum emotional energy.
- Derive every value from the actual entry text. Never output placeholder or example values.
"""
