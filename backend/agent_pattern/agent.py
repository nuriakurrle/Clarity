"""CrewAI Pattern Agent - Recurring Theme & Trigger Detective.

Der Agent erkennt wiederkehrende Themen, Personen, Situationen, Trigger und
Sprachmuster über mehrere Journal-Einträge hinweg. Er formuliert diese bewusst
als *Beobachtungen, nicht als Bewertungen* (siehe Aufgabenstellung "surfaces them
in the weekly digest as observations rather than judgements").

Aufbau analog zum Sentiment-Agent (``agent_sentiment/agent.py``): Der Agent
definiert die "Persona" (role/goal/backstory). Aus dieser Persona wird in
``main.py`` der Prompt für das lokale Ollama-Modell zusammengebaut, damit die
Agenten-Definition tatsächlich benutzt wird und kein toter Code ist.
"""
import os

# crewai 0.1.0 validiert beim Erzeugen eines Agent() das Vorhandensein eines
# LLM-Keys, obwohl wir die Texte lokal ueber Ollama erzeugen und nie eine Crew
# ausfuehren (kein externer Aufruf). Ein Platzhalter genuegt der Validierung.
os.environ.setdefault("OPENAI_API_KEY", "not-needed-clarity-uses-local-ollama")

from crewai import Agent

pattern_agent = Agent(
    role="Recurring Pattern Detective & Language Analyst",
    goal="""Identify recurring themes, people, situations, triggers and language
    patterns across a person's journal entries over time. Surface them as neutral
    observations that help the writer notice what keeps coming back - never as
    judgements, diagnoses or advice.""",
    backstory="""You are a calm, observant analyst of personal writing with deep
    expertise in:
    - Recognising recurring themes and topics across many entries
    - Spotting the people and situations that show up again and again
    - Detecting emotional triggers (what tends to precede stress, joy or worry)
    - Noticing shifts in language and tone over days and weeks
    - Describing all of this gently, as observations rather than verdicts

    You never moralise and you never give therapy. You simply hold up a mirror so
    the writer can see their own patterns clearly.""",
    verbose=True,
    allow_delegation=False,
)


def build_pattern_prompt(entries_text: str, sentiment_hint: str = "") -> str:
    """Baut den LLM-Prompt aus der Agenten-Persona + den Einträgen.

    Wird von ``main.py`` genutzt, damit die oben definierte Agenten-Rolle den
    tatsächlichen Ollama-Aufruf steuert.
    """
    return f"""{pattern_agent.role}.

Your goal: {pattern_agent.goal}

Analyse the following journal entries (separated by '---'). They span several
days. Look ACROSS all of them for things that recur - not one-off events.
{sentiment_hint}
Entries:
{entries_text}

Respond ONLY with valid JSON (no markdown, no explanations) in exactly this structure:
{{
    "recurring_themes": ["<theme that appears in several entries>"],
    "recurring_people": ["<person/role mentioned repeatedly>"],
    "situations": ["<recurring situation or context>"],
    "triggers": {{"<trigger>": "<what emotion/reaction it tends to precede>"}},
    "language_shifts": ["<observed shift in tone or wording over time>"],
    "mood_trend": "<improving, stable or declining>",
    "summary": "<2-3 neutral sentences describing the main patterns as observations>"
}}

Rules:
- Only include things that actually RECUR across entries; leave arrays empty if nothing recurs.
- Phrase everything as neutral observations, never as judgements, advice or diagnosis.
- Derive every value from the actual entries. Never output placeholder or example values.
- mood_trend must be one of exactly: improving, stable, declining.
"""
