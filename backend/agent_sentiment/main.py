"""Clarity Sentiment Agent - Port 8001 - Emotional Tone Analysis with Longitudinal Mood Profile"""
import os, json, re, logging, sys, uuid
from collections import defaultdict
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx, uvicorn
from datetime import datetime, timedelta

# Add shared to path
sys.path.insert(0, '/app/shared')
from database import (
    init_db, save_sentiment, save_entry, get_mood_profile,
    save_mood_profile, calculate_mood_trend, get_emotional_summary,
    get_entries_with_sentiment, get_db_connection, update_entry_content,
    delete_entry, save_entry_image, get_entry_images
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Sentiment Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                  allow_methods=["*"], allow_headers=["*"])

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("MODEL", "llama3.2:1b")

# Initialize DB on startup
@app.on_event("startup")
async def startup():
    init_db()
    logger.info("✅ Database initialized")

class TextInput(BaseModel):
    text: str
    entry_id: Optional[int] = None
    # Optionale Selbsteinschätzung aus der App (Stimmungs-Icons im Editor)
    self_reported_mood: Optional[str] = None

# Selbsteinschätzung (5-stufige Skala der App) → Kontext für das LLM
MOOD_DESCRIPTIONS = {
    "great": "very positive (valence around +0.8)",
    "good": "positive (valence around +0.4)",
    "neutral": "neutral (valence around 0)",
    "low": "somewhat negative (valence around -0.4)",
    "bad": "very negative (valence around -0.8)",
}

class MoodProfileRequest(BaseModel):
    days: int = 7  # Last N days
    include_trend: bool = True

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "sentiment", "model": MODEL}

@app.post("/analyze")
async def analyze_sentiment(input: TextInput, background_tasks: BackgroundTasks):
    """
    Save the entry immediately, then run the sentiment analysis as a
    background task. The entry is never lost when Ollama is slow or down,
    and the app gets an instant response ("Fertig" muss nicht aufs LLM warten).
    """
    logger.info(f"📊 Analyzing: {input.text[:50]}...")

    # Save-first: Text sofort persistieren, Analyse hängt nur Metadaten an.
    entry_id = input.entry_id or save_entry(input.text)
    background_tasks.add_task(run_analysis, entry_id, input)
    return {"entry_id": entry_id, "status": "queued"}


async def run_analysis(entry_id: int, input: TextInput):
    """LLM-Analyse + Speichern von Sentiment und Mood-Profil (Hintergrund).

    Schlägt die Analyse fehl, bleibt der Eintrag ohne valence erhalten –
    die App zeigt ihn dann als neutral.
    """
    mood_hint = ""
    mood_description = MOOD_DESCRIPTIONS.get(input.self_reported_mood or "")
    if mood_description:
        mood_hint = (
            f"\nWhile writing, the user self-reported their mood as: {mood_description}. "
            "Treat this as helpful additional context, but base your analysis primarily "
            "on the text itself. If text and self-report disagree, mention it in the reasoning.\n"
        )

    prompt = f"""You are an expert emotional analyst. Analyze the emotional content of this journal entry deeply.

Entry: "{input.text}"
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

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={"model": MODEL, "prompt": prompt, "stream": False, "format": "json", "options": {"temperature": 0.3}}
            )
            result = response.json()
            response_text = result.get("response", "")
            
            # Extract JSON from response
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)

            if json_match:
                sentiment_data = json.loads(json_match.group())
                logger.info(f"✅ Sentiment detected - Valence: {sentiment_data.get('valence')}, Intensity: {sentiment_data.get('intensity')}")

                # Eintrag könnte während der LLM-Analyse gelöscht worden sein –
                # dann nichts speichern, sonst entstehen verwaiste Analyse-Zeilen,
                # die die Mood-Statistiken verfälschen.
                conn = get_db_connection()
                exists = conn.execute("SELECT 1 FROM entries WHERE id = ?", (entry_id,)).fetchone()
                conn.close()
                if not exists:
                    logger.info(f"🗑️ Entry {entry_id} was deleted during analysis – skipping save")
                    return

                # 💾 SAVE TO DATABASE
                save_sentiment(
                    entry_id,
                    sentiment_data.get("sentiment", "neutral"),
                    sentiment_data.get("valence", 0),
                    sentiment_data.get("intensity", 50),
                    sentiment_data.get("tone", ""),
                    sentiment_data.get("primary_emotion", ""),
                    sentiment_data.get("secondary_emotions", []),
                    sentiment_data.get("confidence", 0)
                )
                logger.info(f"💾 Saved sentiment to DB (entry_id={entry_id})")

                # Update mood profile
                save_mood_profile(entry_id, sentiment_data)
            else:
                logger.error(f"Failed to extract JSON from: {response_text[:200]}")
    except Exception as e:
        # Kein Re-Raise: Hintergrund-Task, der Eintrag selbst ist gespeichert.
        logger.error(f"❌ Analysis failed for entry {entry_id}: {e}")

class UpdateEntryInput(BaseModel):
    text: str

@app.put("/entries/{entry_id}")
async def update_entry(entry_id: int, input: UpdateEntryInput, background_tasks: BackgroundTasks):
    """
    Update the text of an existing entry (edit from the app's detail view).
    Save-first like /analyze: the new text is persisted immediately, then the
    sentiment analysis re-runs as a background task so history/insights use
    the edited content.
    """
    if not input.text.strip():
        raise HTTPException(status_code=400, detail="Entry text must not be empty")
    if not update_entry_content(entry_id, input.text):
        raise HTTPException(status_code=404, detail=f"Entry {entry_id} not found")
    logger.info(f"✏️ Updated entry {entry_id}: {input.text[:50]}...")
    background_tasks.add_task(run_analysis, entry_id, TextInput(text=input.text, entry_id=entry_id))
    return {"entry_id": entry_id, "status": "queued"}

# --- Bilder zu Einträgen ------------------------------------------------------

# Dateien liegen im Docker-Volume neben der SQLite-DB (./data auf dem Host).
IMAGES_DIR = "/data/images"
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}

@app.post("/entries/{entry_id}/images")
async def upload_entry_image(entry_id: int, file: UploadFile = File(...)):
    """
    Attach an image to an entry. The file is stored under /data/images with a
    generated name (entryid_uuid.ext), the filename is recorded in the DB and
    returned so the app can display it via GET /images/{filename}.
    """
    conn = get_db_connection()
    exists = conn.execute("SELECT 1 FROM entries WHERE id = ?", (entry_id,)).fetchone()
    conn.close()
    if not exists:
        raise HTTPException(status_code=404, detail=f"Entry {entry_id} not found")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image file")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXT:
        ext = ".jpg"
    filename = f"{entry_id}_{uuid.uuid4().hex}{ext}"
    os.makedirs(IMAGES_DIR, exist_ok=True)
    with open(os.path.join(IMAGES_DIR, filename), "wb") as f:
        f.write(data)
    save_entry_image(entry_id, filename)
    logger.info(f"🖼️ Saved image for entry {entry_id}: {filename} ({len(data)} bytes)")
    return {"entry_id": entry_id, "filename": filename}

@app.get("/images/{filename}")
async def get_image(filename: str):
    """Serve an attached image. Filenames are generated (no user input paths)."""
    # Kein Pfad-Traversal: nur nackte Dateinamen zulassen.
    if os.path.basename(filename) != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = os.path.join(IMAGES_DIR, filename)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(path)

@app.delete("/entries/{entry_id}")
async def delete_entry_endpoint(entry_id: int):
    """
    Delete an entry including its sentiment analysis, mood profile rows,
    generated prompts and attached images (DB rows AND files), so history,
    calendar and insights stay consistent.
    """
    # Bild-Dateien zuerst einsammeln – delete_entry räumt die DB-Zeilen weg.
    filenames = get_entry_images(entry_id)
    if not delete_entry(entry_id):
        raise HTTPException(status_code=404, detail=f"Entry {entry_id} not found")
    for filename in filenames:
        try:
            os.unlink(os.path.join(IMAGES_DIR, filename))
        except OSError:
            pass  # Datei fehlt schon – DB ist die Quelle der Wahrheit
    logger.info(f"🗑️ Deleted entry {entry_id} (+{len(filenames)} images)")
    return {"entry_id": entry_id, "status": "deleted"}

@app.get("/entries")
async def list_entries():
    """
    All journal entries (newest first) with their latest sentiment.
    Used by the app for the history / search screen.
    """
    return {"entries": get_entries_with_sentiment()}

@app.get("/mood-profile")
async def get_mood_profile_endpoint(days: int = 7):
    """
    Get longitudinal mood profile for the last N days.
    Shows mood trends, emotional patterns, and shifts over time.
    """
    logger.info(f"📈 Fetching mood profile for last {days} days...")
    
    try:
        profile = get_mood_profile(days)
        trend = calculate_mood_trend(days)
        
        return {
            "period_days": days,
            "mood_profile": profile,
            "trend_analysis": trend,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Error fetching mood profile: {e}")
        raise

@app.get("/emotional-summary")
async def get_emotional_summary_endpoint(
    period: str = "week"  # "day", "week", "month"
):
    """
    Get emotional summary with mood shifts, common emotions,
    and insights about emotional patterns.
    """
    logger.info(f"📋 Generating emotional summary for {period}...")
    
    try:
        summary = get_emotional_summary(period)
        return {
            "period": period,
            "summary": summary,
            "generated_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Error generating summary: {e}")
        raise

# --- Key Themes (Schlagwörter) -----------------------------------------------

# Füllwörter, die als Thema nichts aussagen (Artikel, Pronomen, Hilfsverben,
# allgemeine Verben/Adjektive/Adverbien, generische Zeit-/Füllbegriffe).
# Bewusst großzügig, damit nur inhaltstragende Wörter als Thema übrig bleiben.
STOPWORDS = {
    # Artikel / Pronomen / Konjunktionen / Präpositionen
    "aber", "auch", "auf", "aus", "bei", "bin", "bist", "das", "dass", "dann",
    "dein", "deine", "dem", "den", "des", "die", "dies", "diese", "dieser",
    "dieses", "diesem", "doch", "dort", "durch", "ein", "eine", "einen", "einem",
    "einer", "eines", "etwas", "euch", "euer", "für", "fuer", "gegen", "hier",
    "ihr", "ihre", "immer", "jede", "jeden", "jetzt", "kein", "keine", "man",
    "mein", "meine", "meinem", "meinen", "mich", "mir", "mit", "nach", "nicht",
    "nichts", "noch", "nun", "oder", "ohne", "schon", "sehr", "sich", "sie",
    "sind", "sonst", "über", "ueber", "und", "uns", "unser", "unter", "viel",
    "viele", "vom", "von", "vor", "was", "weg", "weil", "weiter", "wenn", "wie",
    "wieder", "wir", "wird", "wirst", "wo", "zum", "zur", "zwar", "zwischen",
    # Hilfs-/Allerweltsverben
    "habe", "haben", "hab", "hat", "hatte", "hatten", "kann", "kannst", "konnte",
    "muss", "musste", "werde", "werden", "wurde", "wollen", "wollte", "würde",
    "wuerde", "gemacht", "macht", "machen", "geht", "gehen", "ging", "kam",
    "kommen", "kommt", "denke", "denken", "fühle", "fuehle", "fühlt", "fuehlt",
    "gewesen", "geworden", "verbracht", "verbringe", "brauche", "brauchen",
    "wächst", "waechst", "frisst", "sitzt", "sitze", "gesessen", "telefoniert",
    "getan", "läuft", "laeuft", "bleibt", "bleiben", "fällt", "faellt",
    "gekocht", "kochen", "gelesen", "lesen", "gesehen", "gesagt", "geredet",
    "gehört", "gehoert", "geschrieben",
    # Allgemeine Adjektive / Adverbien / Füllwörter
    "eigentlich", "wirklich", "ganz", "ganze", "ganzen", "gerade", "einfach",
    "gut", "guten", "gute", "guter", "schön", "schoen", "schöne", "richtig",
    "besonderes", "besondere", "okay", "mittel", "solche", "solcher", "solches",
    "genug", "kaum", "dringend", "endlich", "danach", "abend", "abends", "morgen",
    "gestern", "heute", "immer", "meist", "meistens", "langer", "langen", "lange",
    "kurz", "kurzer", "neuer", "neue", "voll", "voller", "mehr", "wenig",
    "ruhig", "ruhige", "ruhiger", "ruhigen", "ruhiges", "still", "stiller",
    # Generische Zeit-/Füllbegriffe (kein aussagekräftiges Thema)
    "tag", "tage", "tagen", "woche", "wochen", "zeit", "mal", "stimmung",
    "gefühl", "gefuehl", "dinge", "sachen", "menschen",
    # Englisch (falls englische Einträge dabei sind)
    "the", "and", "for", "that", "with", "this", "was", "have", "has", "are",
    "but", "not", "you", "your", "from", "they", "them", "just", "really",
    "about", "would", "could", "some", "very", "much", "more", "been", "being",
}


def _entries_with_valence(days: int) -> list:
    """Einträge der letzten `days` Tage mit der Valenz ihrer neuesten Analyse.

    Basis für die Key-Themes: pro Eintrag Text + Stimmungswert, damit jedes
    Schlagwort nach der durchschnittlichen Stimmung eingefärbt werden kann.
    """
    conn = get_db_connection()
    rows = conn.execute(
        """SELECT e.content, s.valence
           FROM entries e
           LEFT JOIN sentiment_analysis s ON s.id = (
               SELECT MAX(id) FROM sentiment_analysis WHERE entry_id = e.id
           )
           WHERE e.created_at >= datetime('now', ? || ' days')""",
        (f'-{days}',),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.get("/keywords")
async def keywords(days: int = 30, limit: int = 10, min_len: int = 4):
    """Häufigste, inhaltstragende Schlagwörter der letzten `days` Tage.

    Zählt Wörter nach der Zahl der Einträge, in denen sie vorkommen (ohne
    Stoppwörter), und färbt jedes Wort nach der durchschnittlichen Stimmung
    dieser Einträge ein. Rein deterministisch – kein LLM, also sofort da.
    """
    rows = _entries_with_valence(days)

    doc_freq = defaultdict(int)     # in wie vielen Einträgen kommt das Wort vor
    valence_sum = defaultdict(float)
    valence_n = defaultdict(int)

    for row in rows:
        content = (row.get("content") or "").lower()
        valence = row.get("valence")
        # Pro Eintrag jedes Wort nur einmal (Dokument-Frequenz), Stoppwörter raus.
        words = {
            w for w in re.split(r"[^a-zäöüß]+", content)
            if len(w) >= min_len and w not in STOPWORDS
        }
        for w in words:
            doc_freq[w] += 1
            if valence is not None:
                valence_sum[w] += valence
                valence_n[w] += 1

    # Nur Wörter, die in mindestens zwei Einträgen vorkommen -> echte "Themen".
    candidates = {w: c for w, c in doc_freq.items() if c >= 2} or dict(doc_freq)
    ranked = sorted(candidates.items(), key=lambda kv: (kv[1], kv[0]), reverse=True)[:limit]

    keywords_out = [
        {
            "word": word,
            "count": count,
            "valence": round(valence_sum[word] / valence_n[word], 3) if valence_n[word] else 0.0,
        }
        for word, count in ranked
    ]
    return {"days": days, "entry_count": len(rows), "keywords": keywords_out}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
