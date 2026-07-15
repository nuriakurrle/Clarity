"""Multilingual Prompt Library for Clarity Agent.

Categories:
- starter: Blank page prevention
- sentiment_based: Driven by emotional signals

Dazu die ergaenzenden Offline-Listen fuer /generate-prompts (REFLECTION_DE,
PATTERN_TEMPLATES_DE, DIGEST_DE). Weitere Kategorien (pattern_based/temporal/
safety/streak_break/milestone) gehoerten zu den entfernten Einzel-Endpoints
und liegen bei Bedarf in der Git-Historie.
"""

PROMPT_LIBRARY = {
    "starter": {
        "de": [
            "Was beschäftigt dich gerade am meisten?",
            "Wie fühlst du dich in diesem Moment?",
            "Gibt es etwas, das du heute loswerden möchtest?",
            "Welcher Gedanke ist dir gerade in den Sinn gekommen?",
            "Was hat dich heute überrascht?",
        ],
        "en": [
            "What's on your mind right now?",
            "How are you feeling at this moment?",
            "Is there something you want to get off your chest today?",
            "What thought just crossed your mind?",
            "What surprised you today?",
        ],
    },
    "sentiment_based": {
        "positive": {
            "de": [
                "Was hat dich heute am glücklichsten gemacht?",
                "Welcher Moment war besonders wertvoll?",
                "Mit wem hast du diese gute Laune geteilt?",
                "Was würdest du gerne festhalten von heute?",
                "Wie kannst du mehr solche Momente schaffen?",
            ],
            "en": [
                "What made you happiest today?",
                "Which moment felt particularly valuable?",
                "Who did you share this good mood with?",
                "What would you like to remember from today?",
                "How can you create more moments like this?",
            ],
        },
        "negative": {
            "de": [
                "Was war der schwierigste Moment heute?",
                "Welchen Gedanken möchtest du gerne überprüfen?",
                "Was würde dir jetzt helfen?",
                "Wenn dieser Tag vorbei ist — was brauchst du?",
                "Welche Person oder Aktivität könnte dich stützen?",
            ],
            "en": [
                "What was the most difficult moment today?",
                "Which thought would you like to examine?",
                "What would help you right now?",
                "Once this day is over — what do you need?",
                "Which person or activity could support you?",
            ],
        },
        "neutral": {
            "de": [
                "Was hat dich heute beschäftigt?",
                "Gab es einen Moment, der dich berührt hat?",
                "Welche Routinen begleiten dich heute?",
                "Was könnte den Tag noch interessanter machen?",
                "Welche Aufgabe möchtest du noch erledigen?",
            ],
            "en": [
                "What occupied your thoughts today?",
                "Was there a moment that touched you?",
                "Which routines accompanied you today?",
                "What could make the day more interesting?",
                "Which task would you still like to accomplish?",
            ],
        },
        "anxious": {
            "de": [
                "Was macht dir gerade Sorgen?",
                "Welche Sorge fühlt sich am stärksten an?",
                "Wenn diese Sorge vorbei wäre — wie würde sich das anfühlen?",
                "Was ist das Beste, das passieren könnte?",
                "Wer könnte dich verstehen?",
            ],
            "en": [
                "What's worrying you right now?",
                "Which worry feels strongest?",
                "If this worry disappeared — how would that feel?",
                "What's the best that could happen?",
                "Who could understand you?",
            ],
        },
        "sad": {
            "de": [
                "Was vermisst du gerade?",
                "Welcher Verlust bewegt dich?",
                "Was bedeutet dir besonders?",
                "Welche Erinnerung möchtest du festhalten?",
                "Wie können andere dich jetzt unterstützen?",
            ],
            "en": [
                "What do you miss right now?",
                "Which loss is moving you?",
                "What matters most to you?",
                "Which memory would you like to preserve?",
                "How can others support you now?",
            ],
        },
    },
}


# --- Offline-Auswahl fuer /generate-prompts -------------------------------
# Ergaenzende Listen, die es in PROMPT_LIBRARY (Einzelfragen-Kategorien) nicht
# gibt: generische Reflexion, Pattern-Templates mit {theme}/{trigger} und
# Wochenrueckblick-Fragen passend zum Digest-Agent.

REFLECTION_DE = [
    "Was steckt wirklich hinter diesem Gefühl?",
    "Was würdest du einer Freundin in dieser Situation raten?",
    "Was nimmst du aus diesem Moment mit?",
    "Was brauchst du gerade am meisten?",
]

PATTERN_TEMPLATES_DE = [
    "Das Thema „{theme}“ kommt öfter vor – was bedeutet es dir?",
    "Wenn „{theme}“ zurückkehrt: was löst es in dir aus?",
    "Rund um „{trigger}“ wirkst du besonders bewegt – woran liegt das?",
    "Welche Gewohnheit rund um „{theme}“ tut dir gut, welche nicht?",
]

DIGEST_DE = [
    "Was war das Herz dieser Woche für dich?",
    "Worauf bist du diese Woche stolz – auch wenn es klein war?",
    "Welche Herausforderung hat dir diese Woche etwas gezeigt?",
    "Was möchtest du aus dieser Woche mitnehmen?",
]


def _sentiment_subcategory(sentiment) -> str:
    """Mappt freien Sentiment-Text auf eine sentiment_based-Subkategorie."""
    s = sentiment.get("sentiment") if isinstance(sentiment, dict) else sentiment
    emotions = sentiment.get("emotions", []) if isinstance(sentiment, dict) else []
    text = " ".join([(s or "")] + [e for e in emotions if e]).lower()

    if any(w in text for w in ["angst", "sorge", "anxious", "worried", "überforder"]):
        return "anxious"
    if any(w in text for w in ["trau", "sad", "verlust", "nieder"]):
        return "sad"
    if any(w in text for w in ["pos", "gut", "freu", "liebe", "dankbar", "happy"]):
        return "positive"
    if any(w in text for w in ["neg", "schlecht", "wut", "frust", "müde", "stress", "angry"]):
        return "negative"
    return "neutral"


def _fill_templates(templates: list[str], theme: str | None, trigger: str | None) -> list[str]:
    out = []
    for t in templates:
        try:
            out.append(t.format(theme=theme or "das", trigger=trigger or "diesem Thema"))
        except Exception:
            out.append(t)
    return out


def library_prompts(
    sentiment=None,
    pattern: dict | None = None,
    digest: dict | None = None,
    is_starter: bool = False,
    n: int = 4,
    language: str = "de",
) -> list[str]:
    """Waehlt kontextpassende Prompts aus der Bibliothek (Offline-Modus).

    Wird genutzt, wenn Ollama nicht erreichbar ist oder zu wenige Fragen
    liefert. sentiment/pattern/digest sind die optionalen Ergebnisse der
    anderen Agents – es findet KEIN Aufruf anderer Agents statt.
    """
    import random

    pool: list[str] = list(
        get_prompt_by_category("starter", language) if is_starter else REFLECTION_DE
    )

    if sentiment:
        subcat = _sentiment_subcategory(sentiment)
        pool += get_prompt_by_category("sentiment_based", language, subcat)

    if pattern:
        theme = (pattern.get("top_themes") or [None])[0]
        triggers = pattern.get("triggers") or {}
        trigger = next(iter(triggers.keys()), None)
        pool += _fill_templates(PATTERN_TEMPLATES_DE, theme, trigger)

    if digest:
        pool += DIGEST_DE

    seen, uniq = set(), []
    for p in pool:
        if p not in seen:
            seen.add(p)
            uniq.append(p)
    random.shuffle(uniq)
    return uniq[:n]


def get_prompt_by_category(category: str, language: str = "de", subcategory: str | None = None) -> list[str]:
    """Get prompts by category.
    
    Args:
        category: Main category (starter, sentiment_based, etc.)
        language: "de" or "en"
        subcategory: Optional sub-category (e.g., "positive" for sentiment_based)
    
    Returns:
        List of prompt strings
    """
    if category not in PROMPT_LIBRARY:
        return []
    
    data = PROMPT_LIBRARY[category]
    
    # If language key exists directly
    if language in data:
        return data[language]
    
    # If subcategory is specified
    if subcategory and subcategory in data:
        sub_data = data[subcategory]
        if isinstance(sub_data, dict) and language in sub_data:
            return sub_data[language]
    
    return []
