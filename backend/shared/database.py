"""SQLite Database for Clarity - Shared by all agents"""
import sqlite3
from pathlib import Path
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

DB_PATH = Path("/data/clarity.db")

def get_db_connection():
    """Create or get SQLite connection"""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize database schema"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Journal Entries Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Enhanced Sentiment Analysis Results with Valence, Intensity, Tone
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sentiment_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER,
            sentiment TEXT,
            valence REAL,
            intensity INTEGER,
            tone TEXT,
            primary_emotion TEXT,
            secondary_emotions TEXT,
            confidence INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(entry_id) REFERENCES entries(id)
        )
    """)

    # Longitudinal Mood Profile - tracks mood over time
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mood_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER,
            date DATE,
            daily_valence REAL,
            daily_intensity INTEGER,
            dominant_emotions TEXT,
            mood_shift TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(entry_id) REFERENCES entries(id)
        )
    """)

    # Pattern Detection Results
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pattern_detection (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            top_themes TEXT,
            mood_trend TEXT,
            triggers TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Migration: Der Pattern-Agent liefert inzwischen reichere Muster
    # (Personen, Situationen, Sprachverschiebungen, Zusammenfassung). Spalten
    # werden nur ergänzt, wenn sie noch fehlen -> bricht bestehende DBs nicht.
    existing_pattern_cols = {
        row[1] for row in cursor.execute("PRAGMA table_info(pattern_detection)").fetchall()
    }
    for column in ("recurring_people", "situations", "language_shifts", "observations",
                   "theme_counts", "new_themes", "theme_changes", "summary"):
        if column not in existing_pattern_cols:
            cursor.execute(f"ALTER TABLE pattern_detection ADD COLUMN {column} TEXT")

    # Generated Prompts
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS generated_prompts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER,
            prompts TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(entry_id) REFERENCES entries(id)
        )
    """)

    # Weekly Digest
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS weekly_digest (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_start DATE,
            summary TEXT,
            highlights TEXT,
            challenges TEXT,
            growth TEXT,
            affirmation TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()

def save_entry(content: str) -> int:
    """Save new journal entry"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO entries (content) VALUES (?)", (content,))
    conn.commit()
    entry_id = cursor.lastrowid
    conn.close()
    return entry_id

def save_sentiment(
    entry_id: int, 
    sentiment: str, 
    valence: float,
    intensity: int,
    tone: str,
    primary_emotion: str,
    secondary_emotions: List[str],
    confidence: int
) -> None:
    """Save comprehensive sentiment analysis result with valence and intensity"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO sentiment_analysis
           (entry_id, sentiment, valence, intensity, tone, primary_emotion, secondary_emotions, confidence)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            entry_id, 
            sentiment, 
            valence, 
            intensity, 
            tone, 
            primary_emotion, 
            json.dumps(secondary_emotions), 
            confidence
        )
    )
    conn.commit()
    conn.close()

def save_mood_profile(entry_id: int, sentiment_data: Dict[str, Any]) -> None:
    """Save mood profile entry for longitudinal tracking"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    today = datetime.now().date()
    mood_shift = "stable"  # Default, can be computed from trend analysis
    
    cursor.execute(
        """INSERT INTO mood_profile
           (entry_id, date, daily_valence, daily_intensity, dominant_emotions, mood_shift)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            entry_id,
            today,
            sentiment_data.get("valence", 0),
            sentiment_data.get("intensity", 50),
            json.dumps([
                sentiment_data.get("primary_emotion", ""),
                *sentiment_data.get("secondary_emotions", [])
            ]),
            mood_shift
        )
    )
    conn.commit()
    conn.close()

def get_mood_profile(days: int = 7) -> Dict[str, Any]:
    """
    Get longitudinal mood profile for the last N days.
    Shows emotional trends and shifts over time.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    start_date = (datetime.now() - timedelta(days=days)).date()
    
    cursor.execute("""
        SELECT
            date,
            ROUND(AVG(daily_valence), 2) as average_valence,
            ROUND(AVG(daily_intensity), 1) as average_intensity,
            GROUP_CONCAT(dominant_emotions, '|') as dominant_emotions,
            mood_shift,
            COUNT(*) as entry_count
        FROM mood_profile
        WHERE date >= ?
        GROUP BY date
        ORDER BY date
    """, (start_date,))

    rows = cursor.fetchall()
    conn.close()

    daily_data = []
    for row in rows:
        # dominant_emotions ist pro Eintrag eine JSON-Liste; über den Tag
        # zusammenführen und Duplikate entfernen (Reihenfolge bleibt erhalten)
        emotions = []
        for chunk in (row[3] or "").split("|"):
            for emotion in json.loads(chunk) if chunk else []:
                if emotion and emotion not in emotions:
                    emotions.append(emotion)
        daily_data.append({
            "date": row[0],
            "average_valence": row[1],
            "average_intensity": row[2],
            "dominant_emotions": emotions,
            "mood_shift": row[4],
            "entry_count": row[5]
        })
    
    return {
        "period_days": days,
        "daily_breakdown": daily_data,
        "start_date": start_date.isoformat(),
        "end_date": datetime.now().date().isoformat()
    }

def calculate_mood_trend(days: int = 7) -> Dict[str, Any]:
    """
    Calculate mood trends over the specified period.
    Detects shifts and patterns in emotional state.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    
    start_date = (datetime.now() - timedelta(days=days)).date()
    
    cursor.execute("""
        SELECT 
            daily_valence,
            daily_intensity
        FROM mood_profile
        WHERE date >= ?
        ORDER BY date
    """, (start_date,))
    
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        return {
            "trend": "insufficient_data",
            "valence_change": 0,
            "intensity_change": 0,
            "pattern": "no_entries"
        }
    
    valences = [row[0] for row in rows]
    intensities = [row[1] for row in rows]
    
    valence_trend = "increasing" if valences[-1] > valences[0] else "decreasing" if valences[-1] < valences[0] else "stable"
    intensity_trend = "increasing" if intensities[-1] > intensities[0] else "decreasing" if intensities[-1] < intensities[0] else "stable"
    
    avg_valence = sum(valences) / len(valences)
    avg_intensity = sum(intensities) / len(intensities)
    
    return {
        "trend": "positive" if avg_valence > 0.3 else "negative" if avg_valence < -0.3 else "neutral",
        "valence_change": valences[-1] - valences[0],
        "valence_trend": valence_trend,
        "intensity_change": intensities[-1] - intensities[0],
        "intensity_trend": intensity_trend,
        "average_valence": avg_valence,
        "average_intensity": avg_intensity,
        "data_points": len(rows)
    }

def get_emotional_summary(period: str = "week") -> Dict[str, Any]:
    """
    Generate emotional summary highlighting patterns, shifts, and insights.
    """
    if period == "day":
        days = 1
    elif period == "week":
        days = 7
    elif period == "month":
        days = 30
    else:
        days = 7
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    start_date = (datetime.now() - timedelta(days=days)).date()
    
    cursor.execute("""
        SELECT 
            primary_emotion,
            COUNT(*) as frequency,
            AVG(valence) as avg_valence,
            AVG(intensity) as avg_intensity
        FROM sentiment_analysis
        WHERE created_at >= datetime('now', ? || ' days')
        GROUP BY primary_emotion
        ORDER BY frequency DESC
    """, (f'-{days}',))
    
    emotion_stats = cursor.fetchall()
    
    cursor.execute("""
        SELECT 
            sentiment,
            COUNT(*) as count
        FROM sentiment_analysis
        WHERE created_at >= datetime('now', ? || ' days')
        GROUP BY sentiment
    """, (f'-{days}',))
    
    sentiment_dist = cursor.fetchall()
    conn.close()
    
    top_emotions = [
        {
            "emotion": row[0],
            "frequency": row[1],
            "avg_valence": row[2],
            "avg_intensity": row[3]
        }
        for row in emotion_stats[:5]
    ]
    
    sentiment_distribution = {
        row[0]: row[1] for row in sentiment_dist
    }
    
    return {
        "period": period,
        "top_emotions": top_emotions,
        "sentiment_distribution": sentiment_distribution,
        "summary_generated": datetime.now().isoformat()
    }

def save_pattern(
    top_themes: list,
    mood_trend: str,
    triggers: dict,
    recurring_people: Optional[list] = None,
    situations: Optional[list] = None,
    language_shifts: Optional[list] = None,
    observations: Optional[list] = None,
    theme_counts: Optional[dict] = None,
    new_themes: Optional[list] = None,
    theme_changes: Optional[dict] = None,
    summary: str = "",
) -> None:
    """Save pattern detection result.

    Die zusätzlichen Felder sind optional, damit bestehende Aufrufer weiter
    funktionieren.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO pattern_detection
           (top_themes, mood_trend, triggers,
            recurring_people, situations, language_shifts, observations,
            theme_counts, new_themes, theme_changes, summary)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            json.dumps(top_themes),
            mood_trend,
            json.dumps(triggers),
            json.dumps(recurring_people or []),
            json.dumps(situations or []),
            json.dumps(language_shifts or []),
            json.dumps(observations or []),
            json.dumps(theme_counts or {}),
            json.dumps(new_themes or []),
            json.dumps(theme_changes or {}),
            summary,
        ),
    )
    conn.commit()
    conn.close()


def get_latest_pattern() -> Optional[Dict[str, Any]]:
    """Return the most recent pattern detection, with JSON fields decoded.

    Used by the pattern agent's GET /patterns/latest endpoint (app + digest).
    """
    conn = get_db_connection()
    row = conn.execute(
        "SELECT * FROM pattern_detection ORDER BY created_at DESC, id DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if row is None:
        return None
    pattern = dict(row)
    for field in ("top_themes", "recurring_people", "situations", "language_shifts",
                  "observations", "new_themes"):
        pattern[field] = json.loads(pattern[field]) if pattern.get(field) else []
    for field in ("triggers", "theme_counts", "theme_changes"):
        pattern[field] = json.loads(pattern[field]) if pattern.get(field) else {}
    return pattern

def save_prompts(entry_id: int, prompts: list) -> None:
    """Save generated prompts"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO generated_prompts
           (entry_id, prompts)
           VALUES (?, ?)""",
        (entry_id, json.dumps(prompts))
    )
    conn.commit()
    conn.close()

def save_digest(week_start: str, summary: str, highlights: list,
                challenges: list, growth: list, affirmation: str) -> None:
    """Save weekly digest"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO weekly_digest
           (week_start, summary, highlights, challenges, growth, affirmation)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (week_start, summary, json.dumps(highlights), json.dumps(challenges),
         json.dumps(growth), affirmation)
    )
    conn.commit()
    conn.close()

# --- Read helpers (used by the reflection/digest agent) ---------------------

def get_entries_since(since: str) -> list:
    """Return journal entries created on/after `since` (oldest first)."""
    conn = get_db_connection()
    rows = conn.execute(
        """SELECT id, content, created_at FROM entries
           WHERE created_at >= ? ORDER BY created_at""",
        (since,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_sentiments_since(since: str) -> list:
    """Return sentiment analyses on/after `since`, with secondary_emotions decoded."""
    conn = get_db_connection()
    rows = conn.execute(
        """SELECT sentiment, valence, intensity, tone, primary_emotion,
                  secondary_emotions, confidence, created_at
           FROM sentiment_analysis
           WHERE created_at >= ? ORDER BY created_at""",
        (since,)
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        item = dict(row)
        item["secondary_emotions"] = (
            json.loads(item["secondary_emotions"]) if item["secondary_emotions"] else []
        )
        result.append(item)
    return result

def get_patterns_since(since: str) -> list:
    """Return pattern detections on/after `since`, with JSON fields decoded."""
    conn = get_db_connection()
    rows = conn.execute(
        """SELECT top_themes, mood_trend, triggers, created_at FROM pattern_detection
           WHERE created_at >= ? ORDER BY created_at""",
        (since,)
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        item = dict(row)
        item["top_themes"] = json.loads(item["top_themes"]) if item["top_themes"] else []
        item["triggers"] = json.loads(item["triggers"]) if item["triggers"] else {}
        result.append(item)
    return result

def get_entries_with_sentiment() -> list:
    """Return all journal entries (newest first) with their latest sentiment.

    Used by the sentiment agent's /entries endpoint (history & search in the app).
    """
    conn = get_db_connection()
    rows = conn.execute(
        """SELECT e.id, e.content, e.created_at,
                  s.sentiment, s.valence, s.primary_emotion
           FROM entries e
           LEFT JOIN sentiment_analysis s ON s.id = (
               SELECT MAX(id) FROM sentiment_analysis WHERE entry_id = e.id
           )
           ORDER BY e.created_at DESC, e.id DESC"""
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_latest_digest() -> dict | None:
    """Return the most recently created weekly digest, with JSON fields decoded."""
    conn = get_db_connection()
    row = conn.execute(
        "SELECT * FROM weekly_digest ORDER BY created_at DESC LIMIT 1"
    ).fetchone()
    conn.close()
    if row is None:
        return None
    digest = dict(row)
    for field in ("highlights", "challenges", "growth"):
        digest[field] = json.loads(digest[field]) if digest[field] else []
    return digest

if __name__ == "__main__":
    init_db()
    print("✅ Database initialized at /data/clarity.db")
