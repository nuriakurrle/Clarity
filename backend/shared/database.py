"""SQLite Database for Clarity - Shared by all agents"""
import sqlite3
from pathlib import Path
import json
from datetime import datetime

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

    # Sentiment Analysis Results
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sentiment_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER,
            sentiment TEXT,
            confidence INTEGER,
            emotions TEXT,
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

def save_sentiment(entry_id: int, sentiment: str, confidence: int, emotions: list) -> None:
    """Save sentiment analysis result"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO sentiment_analysis
           (entry_id, sentiment, confidence, emotions)
           VALUES (?, ?, ?, ?)""",
        (entry_id, sentiment, confidence, json.dumps(emotions))
    )
    conn.commit()
    conn.close()

def save_pattern(top_themes: list, mood_trend: str, triggers: dict) -> None:
    """Save pattern detection result"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """INSERT INTO pattern_detection
           (top_themes, mood_trend, triggers)
           VALUES (?, ?, ?)""",
        (json.dumps(top_themes), mood_trend, json.dumps(triggers))
    )
    conn.commit()
    conn.close()

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
    """Return sentiment analyses on/after `since`, with emotions decoded."""
    conn = get_db_connection()
    rows = conn.execute(
        """SELECT sentiment, confidence, emotions, created_at FROM sentiment_analysis
           WHERE created_at >= ? ORDER BY created_at""",
        (since,)
    ).fetchall()
    conn.close()
    result = []
    for row in rows:
        item = dict(row)
        item["emotions"] = json.loads(item["emotions"]) if item["emotions"] else []
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
