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

def _rows_to_dicts(rows):
    return [dict(row) for row in rows]

def get_recent_entries(limit: int = 7) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT id, content, created_at
           FROM entries
           ORDER BY created_at DESC, id DESC
           LIMIT ?""",
        (limit,)
    )
    rows = _rows_to_dicts(cursor.fetchall())
    conn.close()
    return rows

def get_recent_sentiments(limit: int = 7) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT sa.id, sa.entry_id, e.content, sa.sentiment, sa.confidence,
                  sa.emotions, sa.created_at
           FROM sentiment_analysis sa
           LEFT JOIN entries e ON e.id = sa.entry_id
           ORDER BY sa.created_at DESC, sa.id DESC
           LIMIT ?""",
        (limit,)
    )
    rows = _rows_to_dicts(cursor.fetchall())
    conn.close()
    return rows

def get_recent_patterns(limit: int = 3) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT id, top_themes, mood_trend, triggers, created_at
           FROM pattern_detection
           ORDER BY created_at DESC, id DESC
           LIMIT ?""",
        (limit,)
    )
    rows = _rows_to_dicts(cursor.fetchall())
    conn.close()
    return rows

def get_recent_prompts(limit: int = 7) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """SELECT gp.id, gp.entry_id, e.content, gp.prompts, gp.created_at
           FROM generated_prompts gp
           LEFT JOIN entries e ON e.id = gp.entry_id
           ORDER BY gp.created_at DESC, gp.id DESC
           LIMIT ?""",
        (limit,)
    )
    rows = _rows_to_dicts(cursor.fetchall())
    conn.close()
    return rows

if __name__ == "__main__":
    init_db()
    print("✅ Database initialized at /data/clarity.db")
