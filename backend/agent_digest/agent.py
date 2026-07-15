"""CrewAI Digest Agent - Weekly Reflection Storyteller.

Der Agent verdichtet die Einträge, Stimmung und Muster einer abgeschlossenen
Woche zu einer einfühlsamen Reflexion (Zusammenfassung, Highlights, schwierige
Momente, Entwicklung, Ermutigung und eine offene Reflexionsfrage).

Aufbau analog zum Pattern-Agent (``agent_pattern/agent.py``): Der Agent
definiert die "Persona" (role/goal/backstory). Aus dieser Persona wird der
Prompt für das lokale Ollama-Modell zusammengebaut, damit die Agenten-Definition
tatsächlich benutzt wird und kein toter Code ist. ``main.py`` importiert nur
``digest_agent`` und ``build_reflection_prompt``.
"""
import os

# crewai 0.1.0 validiert beim Erzeugen eines Agent() das Vorhandensein eines
# LLM-Keys, obwohl wir die Texte lokal ueber Ollama erzeugen und nie eine Crew
# ausfuehren (kein externer Aufruf). Ein Platzhalter genuegt der Validierung.
os.environ.setdefault("OPENAI_API_KEY", "not-needed-clarity-uses-local-ollama")

from crewai import Agent

digest_agent = Agent(
    role="Einfühlsamer Reflexions-Begleiter für eine Journaling-App",
    goal="""Erstelle aus den Einträgen, der Stimmung und den erkannten Mustern
    einer abgeschlossenen Woche eine warme, ehrliche Reflexion auf Deutsch: ein
    Gesamtüberblick, positive Momente, schwierige Momente, erkennbare Entwicklung,
    eine Ermutigung und eine offene Reflexionsfrage. Bleibe dabei nah an den
    tatsächlichen Daten und widersprich nie der gemessenen Grundstimmung.""",
    backstory="""Du bist ein ruhiger, mitfühlender Begleiter, der wöchentliches
    Tagebuchschreiben zurückspiegelt. Du wertest nicht und diagnostizierst nicht,
    sondern hältst der schreibenden Person einen freundlichen Spiegel vor. Du
    beschreibst die Woche so, wie sie sich in den Einträgen zeigt - positive
    Grundstimmung bleibt positiv, einzelne schwere Momente werden benannt, ohne
    das Gesamtbild zu übermalen.""",
    verbose=True,
    allow_delegation=False,
)

# Fünfstufige Skala – identisch zu valenceToMoodLevel() im Frontend
# (theme/moodColors.ts). Beide müssen dieselben Grenzen benutzen, sonst
# widerspricht die Wochen-Ansprache im Blob der Zusammenfassung des Digests.
MOOD_LABELS = {
    "great": "sehr gut",
    "good": "gut",
    "neutral": "ausgeglichen",
    "low": "gedrückt",
    "bad": "schwer",
}


def build_reflection_prompt(
    entries_text: str, mood: str, pattern: str, level: str | None = None
) -> str:
    """Baut den LLM-Prompt aus der Agenten-Persona + den Wochendaten.

    Wird von ``main.py`` genutzt, damit die oben definierte Agenten-Rolle den
    tatsächlichen Ollama-Aufruf steuert. Das JSON-Ausgabeformat (summary,
    highlights, challenges, growth, affirmation, question) ist Vertrag mit
    Frontend und DB und darf nicht verändert werden.
    """
    verdict = (
        f"""
GESAMTBILD (gemessen, nicht verhandelbar):
Die Woche war insgesamt {MOOD_LABELS[level]}. Die meisten Einträge fallen in
diese Kategorie. Genau dieser Satz steht auch oben auf dem Startbildschirm.
"""
        if level
        else ""
    )
    return f"""{digest_agent.role}.
Erstelle eine Reflexion der vergangenen Woche auf Deutsch – basierend auf den
Einträgen, der Stimmung und den erkannten Mustern dieser Woche.

Deine Aufgabe: {digest_agent.goal}

EINTRÄGE DER VERGANGENEN WOCHE (Mo–So):
{entries_text}

STIMMUNG:
{mood}

MUSTER:
{pattern}
{verdict}
"summary" MUSS zum GESAMTBILD passen und darf ihm nicht widersprechen. War die
Woche gut, schreib sie nicht als Herausforderung. Einzelne schwere Momente
gehören in "challenges", nicht in die Zusammenfassung.

"question" ist eine offene Frage zum Weitertragen, die sich konkret auf DIESE
Woche bezieht – greife ein Thema, eine Person oder einen Moment aus den
Einträgen auf. Keine allgemeine Floskel.

Antworte AUSSCHLIESSLICH mit JSON in genau diesem Format:
{{"summary": "2-3 Sätze Gesamtüberblick", "highlights": ["positive Momente"], "challenges": ["schwierige Momente"], "growth": ["erkennbare Entwicklung"], "affirmation": "ein ermutigender Satz für die nächste Woche", "question": "eine offene Frage zu dieser Woche"}}"""
