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


def _language_directive(text: str) -> str:
    """Erzwingt IMMER deutsche Ausgabe.

    Clarity ist eine deutschsprachige App; das kleine Modell (llama3.2) mischt
    ansonsten gerne Englisch und Deutsch. Die Anweisung *auf Deutsch* ganz oben
    ist das staerkste Signal und wird daher unbedingt (nicht mehr nur bei genug
    deutschen Markern) vorangestellt. `text` bleibt als Parameter erhalten, damit
    die Aufrufstelle unveraendert bleibt.
    """
    return ("WICHTIG: Antworte AUSSCHLIESSLICH auf Deutsch. Alle Textwerte im "
            "JSON (recurring_themes, recurring_people, situations, triggers, "
            "language_shifts, observations, summary) muessen vollstaendig deutsch "
            "sein - kein einziges englisches Wort, keine Mischung. Nur die "
            "JSON-Schluessel und der Wert von mood_trend bleiben englisch.\n\n")


def build_pattern_prompt(entries_text: str, sentiment_hint: str = "") -> str:
    """Baut den LLM-Prompt aus der Agenten-Persona + den Einträgen.

    ``entries_text`` enthält die Einträge MIT Datum und Wochentag (siehe
    ``main.py``). Ohne Datumsangaben kann das Modell zeitliche Aussagen
    ("Anfang der Woche...") nur erfinden - genau das soll der Prompt verhindern.
    """
    return f"""{_language_directive(entries_text)}{pattern_agent.role}.

Your goal: {pattern_agent.goal}

Analyse the journal entries below. Each entry starts with its date and weekday,
in chronological order (oldest first), separated by '---'. Look ACROSS all of
them for things that RECUR - not one-off events.
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
    "observations": ["<one short, natural, neutral sentence a reader would find insightful>"],
    "mood_trend": "<improving, stable or declining>",
    "summary": "<2-3 neutral sentences describing the main patterns as observations>"
}}

GROUNDING RULES (most important - violating these makes the output useless):
- Use ONLY words that literally appear in the entries above. Never invent a topic,
  a person or an event that is not written there. Do not merge words into new
  compound nouns (if the entries say "Uni" and "Abgabe", do NOT write "Uniabgaben").
- A theme belongs in "recurring_themes" ONLY if it appears in at least TWO different
  entries. One-off topics do not count, no matter how strong they sound.
- An EMPTY array is a correct and expected answer. If nothing genuinely recurs, return
  []. Never pad the output to look useful.
- Every claim about TIME (e.g. "am Anfang der Woche", "zum Wochenende") must be backed
  by the dates shown above. If the dates do not support it, leave language_shifts empty.
- Never state a causal link ("X macht dich muede") unless the entries say so themselves.
  Describe co-occurrence instead ("X kam mehrmals zusammen mit Muedigkeit vor").

STYLE RULES:
- Write ALL text values in German only - no English words, no mixing. Only the JSON keys and mood_trend stay in English.
- Phrase everything as neutral observations, never as judgements, advice or diagnosis.
- mood_trend must be one of exactly: improving, stable, declining.
- observations: 1-3 short GERMAN sentences in the reader's own perspective ("du"), each a
  single concrete pattern. Examples of the STYLE (do not copy the content):
  "Arbeit kam mehrmals vor, oft verbunden mit Druck." /
  "Anfang der Woche nutztest du Woerter wie muede; zum Wochenende wurde der Ton dankbarer."
"""
