"""Multilingual Prompt Library for Clarity Agent.

Categories:
- starter: Blank page prevention
- sentiment_based: Driven by emotional signals
- pattern_based: Response to recurring themes
- temporal: Context-specific (morning, evening, weekly)
- safety: For distress signals
- streak_break: Gentle re-engagement after pause
- milestone: Celebration of streaks (30/60/90 days)
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
    "pattern_based": {
        "work": {
            "de": [
                "Was war heute das Anspruchsvollste im Job?",
                "Welcher Kollege oder welche Kollegin hat dich heute unterstützt?",
                "Wenn du eines an deiner Arbeit ändern könntest — was wäre es?",
                "Wie könntest du morgen effizienter sein?",
                "Wann schaffst du dir bewusst Pausen?",
            ],
            "en": [
                "What was most challenging at work today?",
                "Which colleague supported you today?",
                "If you could change one thing about your work — what would it be?",
                "How could you be more efficient tomorrow?",
                "When do you consciously take breaks?",
            ],
        },
        "relationships": {
            "de": [
                "Mit welcher Person war ich heute verbunden?",
                "Gab es einen Konflikt, den ich gerne klären würde?",
                "Was schätze ich an dieser Person besonders?",
                "Wie kann ich meine Grenzen besser ausdrücken?",
                "Wen würde ich gerne öfter sehen?",
            ],
            "en": [
                "Which person did I feel connected to today?",
                "Was there a conflict I'd like to resolve?",
                "What do I appreciate most about this person?",
                "How can I express my boundaries better?",
                "Whom would I like to see more often?",
            ],
        },
        "sleep": {
            "de": [
                "Wie war deine Schlafqualität letzte Nacht?",
                "Was könnte dir morgen zu besserem Schlaf verhelfen?",
                "Welche Gedanken halten dich wach?",
                "Wann ziehst du dich am besten zurück?",
                "Was hilft dir, zur Ruhe zu kommen?",
            ],
            "en": [
                "How was your sleep quality last night?",
                "What could help you sleep better tomorrow?",
                "Which thoughts keep you awake?",
                "When do you best retreat?",
                "What helps you wind down?",
            ],
        },
        "family": {
            "de": [
                "Welcher Moment mit der Familie war heute schön?",
                "Gab es eine Herausforderung im Familienalltag?",
                "Wie zeigst du deiner Familie, dass sie dir wichtig ist?",
                "Welche Tradition vermisst du?",
                "Was würdest du gerne mit deiner Familie teilen?",
            ],
            "en": [
                "Which family moment was beautiful today?",
                "Was there a challenge in family life?",
                "How do you show your family they matter to you?",
                "Which tradition do you miss?",
                "What would you like to share with your family?",
            ],
        },
        "health": {
            "de": [
                "Wie ist dein Körper heute für dich?",
                "Welche Bewegung tut dir gut?",
                "Was nährst du heute mit Bewusstsein?",
                "Wann spürst du dich vitaler?",
                "Welche Selbstfürsorge vernachlässigst du gerade?",
            ],
            "en": [
                "How is your body today?",
                "Which movement feels good to you?",
                "What are you nourishing with awareness today?",
                "When do you feel more vital?",
                "Which self-care are you neglecting?",
            ],
        },
    },
    "temporal": {
        "morning": {
            "de": [
                "Was sind deine Gedanken beim Aufwachen?",
                "Wie möchtest du diesen Tag gestalten?",
                "Was setzt du dir heute vor?",
                "Welche Absicht begleitet dich heute?",
            ],
            "en": [
                "What's on your mind upon waking?",
                "How do you want to shape this day?",
                "What's your intention for today?",
                "Which purpose guides you today?",
            ],
        },
        "evening": {
            "de": [
                "Was nimmst du aus diesem Tag mit?",
                "Was bin ich heute stolz auf?",
                "Was hätte ich heute anders machen können?",
                "Was kann ich loslassen?",
            ],
            "en": [
                "What are you taking from this day?",
                "What am I proud of today?",
                "What could I have done differently?",
                "What can I let go of?",
            ],
        },
        "weekly_reflection": {
            "de": [
                "Welche Themen durchziehen diese Woche?",
                "Was hat sich diese Woche verändert?",
                "Welche Person oder Erfahrung war prägend?",
                "Was lerne ich diese Woche über mich?",
                "Was wünsche ich mir für die nächste Woche?",
            ],
            "en": [
                "Which themes run through this week?",
                "What changed this week?",
                "Which person or experience was formative?",
                "What am I learning about myself this week?",
                "What do I wish for next week?",
            ],
        },
    },
    "safety": {
        "de": [
            "Es ist sicher, darüber zu sprechen. Wer könnte dir zuhören?",
            "Deine Gefühle sind berechtigt. Was brauchst du jetzt?",
            "Du bist nicht allein. Wen möchtest du kontaktieren?",
            "Es gibt Hilfe. Möchtest du mit einem Therapeuten sprechen?",
            "Dieser Moment wird vorübergehen. Was könnte dir durchhelfen?",
        ],
        "en": [
            "It's safe to talk about this. Who could listen to you?",
            "Your feelings are valid. What do you need right now?",
            "You're not alone. Whom would you like to contact?",
            "There is help. Would you like to talk to a therapist?",
            "This moment will pass. What could help you through?",
        ],
    },
    "streak_break": {
        "de": [
            "Willkommen zurück! Was hat dich abgehalten?",
            "Kein Druck — was ist seit damals passiert?",
            "Lass uns einfach heute wieder anfangen. Wie geht es dir?",
            "Jeder Anfang ist schwer. Wie kann ich dich unterstützen?",
            "Das ist noch okay — komm wieder an Bord. Was beschäftigt dich?",
        ],
        "en": [
            "Welcome back! What kept you away?",
            "No pressure — what's happened since then?",
            "Let's just start again today. How are you?",
            "Every beginning is hard. How can I support you?",
            "That's okay — get back on board. What's on your mind?",
        ],
    },
    "milestone": {
        "de": {
            30: [
                "🎉 30 Tage! Du bist konsistent. Was hat dich motiviert?",
                "Ein Monat Kontinuität! Was hast du über dich gelernt?",
                "Du schreibst seit 30 Tagen! Wie fühlt sich das an?",
            ],
            60: [
                "🎊 2 Monate! Du hast eine echte Gewohnheit aufgebaut. Wie?",
                "60 Tage Reflexion! Was hat sich in dir verändert?",
                "Du bist hartnäckig. Welchen Impact siehst du?",
            ],
            90: [
                "🌟 3 Monate! Eine Transformation. Was hat sich alles verschoben?",
                "90 Tage kontinuierliche Selbstreflexion! Du bist beeindruckend.",
                "Dreieinhalb Monate — eine Reise. Was nächstes?",
            ],
        },
        "en": {
            30: [
                "🎉 30 days! You're consistent. What motivated you?",
                "One month of continuity! What have you learned about yourself?",
                "You've been writing for 30 days! How does that feel?",
            ],
            60: [
                "🎊 2 months! You've built a real habit. How?",
                "60 days of reflection! What has changed in you?",
                "You're persistent. What impact do you see?",
            ],
            90: [
                "🌟 3 months! A transformation. What has shifted?",
                "90 days of continuous self-reflection! You're amazing.",
                "Three and a half months — a journey. What's next?",
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
