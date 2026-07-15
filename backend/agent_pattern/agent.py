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
    role="Detektiv fuer wiederkehrende Muster und Sprachanalyst",
    goal="""Erkenne wiederkehrende Themen, Personen, Situationen, Ausloeser und
    Sprachmuster ueber die Tagebucheintraege einer Person hinweg. Halte sie als
    neutrale Beobachtungen fest, die der schreibenden Person helfen zu bemerken,
    was immer wiederkehrt - niemals als Bewertung, Diagnose oder Ratschlag.""",
    backstory="""Du bist ein ruhiger, aufmerksamer Analyst persoenlicher Texte mit
    tiefer Erfahrung darin:
    - wiederkehrende Themen ueber viele Eintraege hinweg zu erkennen
    - die Personen und Situationen zu bemerken, die immer wieder auftauchen
    - emotionale Ausloeser zu erkennen (was Stress, Freude oder Sorge vorausgeht)
    - Verschiebungen in Sprache und Ton ueber Tage und Wochen wahrzunehmen
    - all das behutsam zu beschreiben, als Beobachtung statt als Urteil

    Du moralisierst nie und gibst keine Therapie. Du haeltst nur einen Spiegel hin,
    damit die schreibende Person ihre eigenen Muster klar sehen kann.""",
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

Dein Ziel: {pattern_agent.goal}

Analysiere die Tagebucheintraege unten. Jeder Eintrag beginnt mit seinem Datum und
Wochentag, in zeitlicher Reihenfolge (aeltester zuerst), getrennt durch '---'.
Suche QUER ueber alle Eintraege nach Dingen, die WIEDERKEHREN - keine einmaligen
Ereignisse.
{sentiment_hint}
Eintraege:
{entries_text}

Antworte AUSSCHLIESSLICH mit gueltigem JSON (kein Markdown, keine Erklaerungen) in
genau dieser Struktur (die Schluessel bleiben englisch, alle Werte auf Deutsch):
{{
    "recurring_themes": ["<Thema, das in mehreren Eintraegen vorkommt>"],
    "recurring_people": ["<Person/Rolle, die wiederholt genannt wird>"],
    "situations": ["<wiederkehrende Situation oder Kontext>"],
    "triggers": {{"<Ausloeser>": "<welche Emotion/Reaktion darauf meist folgt>"}},
    "language_shifts": ["<beobachtete Verschiebung in Ton oder Wortwahl ueber die Zeit>"],
    "observations": ["<ein kurzer, natuerlicher, neutraler Satz mit Einsicht>"],
    "mood_trend": "<improving, stable oder declining>",
    "summary": "<2-3 neutrale Saetze, die die Hauptmuster als Beobachtung beschreiben>"
}}

GRUNDREGELN (am wichtigsten - werden sie verletzt, ist die Ausgabe wertlos):
- Verwende NUR Woerter, die woertlich in den Eintraegen oben vorkommen. Erfinde nie
  ein Thema, eine Person oder ein Ereignis, das dort nicht steht. Setze keine Woerter
  zu neuen Komposita zusammen (steht in den Eintraegen "Uni" und "Abgabe", schreibe
  NICHT "Uniabgaben").
- Ein Thema gehoert nur dann in "recurring_themes", wenn es in mindestens ZWEI
  verschiedenen Eintraegen vorkommt. Einmalige Themen zaehlen nicht, egal wie stark
  sie klingen.
- Ein LEERES Array ist eine korrekte und erwartete Antwort. Kehrt nichts wirklich
  wieder, gib [] zurueck. Fuelle die Ausgabe nie kuenstlich auf.
- Jede Aussage ueber ZEIT (z.B. "am Anfang der Woche", "zum Wochenende") muss durch
  die Daten oben belegt sein. Belegen die Daten sie nicht, lass language_shifts leer.
- Behaupte nie einen Ursache-Wirkung-Zusammenhang ("X macht dich muede"), es sei denn,
  die Eintraege sagen das selbst. Beschreibe stattdessen das gemeinsame Auftreten
  ("X kam mehrmals zusammen mit Muedigkeit vor").

STILREGELN:
- Schreibe ALLE Textwerte ausschliesslich auf Deutsch - kein einziges englisches Wort,
  keine Mischung. Nur die JSON-Schluessel und der Wert von mood_trend bleiben englisch.
- Formuliere alles als neutrale Beobachtung, nie als Bewertung, Ratschlag oder Diagnose.
- mood_trend muss exakt einer dieser Werte sein: improving, stable, declining.
- observations: 1-3 kurze deutsche Saetze in der Perspektive der Leserin ("du"), jeder
  ein einzelnes konkretes Muster. Beispiele fuer den STIL (Inhalt nicht uebernehmen):
  "Arbeit kam mehrmals vor, oft verbunden mit Druck." /
  "Anfang der Woche nutztest du Woerter wie muede; zum Wochenende wurde der Ton dankbarer."
"""
