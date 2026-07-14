"""Seed-Daten für Clarity – füllt die SQLite-DB mit realistischen Einträgen.

Erzeugt rückdatierte Journal-Einträge über die letzten ~7 Monate, jeweils mit
passender Sentiment-Analyse (valence/intensity/emotion) und einem Eintrag im
Stimmungsprofil (mood_profile). Damit sind Stimmungsverlauf (Woche/Monat/Jahr),
Key Themes und die Kennzahlen (Einträge, Tage in Folge) sofort gefüllt.

Bewusst nur Python-Standardbibliothek (sqlite3), damit es ohne Docker direkt auf
dem Host läuft:

    python scripts/seed_data.py                # an bestehende Daten anfügen
    python scripts/seed_data.py --reset        # vorher Einträge/Analysen leeren
    docker compose --profile demo up seed      # dasselbe ohne Host-Python

Die Schlagwörter (Arbeit, Schlaf, Mama, müde, dankbar, überfordert,
Spaziergang, Freunde, Sport, Familie, Stress ...) wiederholen sich bewusst,
damit der Keyword-Endpoint des Pattern-Agents sinnvolle "Key Themes" liefert.
"""
import argparse
import json
import random
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Standard-Pfad: <repo>/data/clarity.db (relativ zu diesem Script).
DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "clarity.db"

# (Text, valence [-1..1], primary_emotion, intensity [0..100], secondary_emotions)
POSITIVE = [
    ("Heute war ein richtig schöner Tag mit meinen Freunden. Wir waren spazieren "
     "und ich bin so dankbar für diese Menschen.", 0.72, "freude", 70, ["dankbarkeit"]),
    ("Langer Spaziergang in der Natur gemacht, der Kopf ist endlich frei. Ich "
     "fühle mich ruhig und dankbar.", 0.6, "ruhe", 58, ["gelassenheit"]),
    ("Sport gemacht und danach richtig gut geschlafen. Der Schlaf tut meinem "
     "Körper so gut.", 0.5, "zufriedenheit", 55, ["stolz"]),
    ("Zeit mit der Familie verbracht, Mama hat gekocht. Solche Abende mit Freunden "
     "und Familie machen mich dankbar.", 0.78, "dankbarkeit", 72, ["freude", "liebe"]),
    ("Das Projekt bei der Arbeit läuft endlich rund, ich bin stolz und motiviert.",
     0.58, "stolz", 64, ["motivation"]),
    ("Ein ruhiger Sonntag mit einem langen Spaziergang und einem guten Buch. Ich "
     "bin dankbar für die Ruhe.", 0.55, "gelassenheit", 50, ["dankbarkeit"]),
]
NEUTRAL = [
    ("Normaler Tag. Viel Arbeit, aber nichts Besonderes. Abends noch kurz "
     "spazieren gewesen.", 0.05, "neutral", 40, []),
    ("Wieder viel am Projekt gesessen. Der Schlaf war okay, die Stimmung mittel.",
     0.0, "neutral", 38, []),
    ("Habe mit Mama telefoniert und danach etwas Sport gemacht. Ein ruhiger Tag "
     "ohne große Höhen und Tiefen.", 0.15, "neutral", 42, ["ruhe"]),
    ("Viel erledigt bei der Arbeit. Bin müde, aber zufrieden genug.", 0.1,
     "neutral", 44, []),
]
NEGATIVE = [
    ("So müde heute. Die Arbeit war stressig und ich fühle mich überfordert.",
     -0.6, "erschöpfung", 68, ["stress"]),
    ("Schlecht geschlafen, der Stress bei der Arbeit wächst mir über den Kopf. Ich "
     "bin überfordert und müde.", -0.7, "überforderung", 76, ["angst", "erschöpfung"]),
    ("Streit in der Familie, das belastet mich. Ich bin traurig und müde.", -0.55,
     "traurigkeit", 62, ["enttäuschung"]),
    ("Zu viel Stress mit dem Projekt, kaum Schlaf. Ich brauche dringend Ruhe.",
     -0.5, "anspannung", 66, ["stress"]),
    ("Fühle mich einsam, obwohl ich Freunde habe. Die Arbeit frisst meine ganze "
     "Energie.", -0.45, "einsamkeit", 58, ["traurigkeit"]),
]


def sentiment_label(valence: float) -> str:
    if valence > 0.15:
        return "positive"
    if valence < -0.15:
        return "negative"
    return "neutral"


def ensure_schema(conn: sqlite3.Connection) -> None:
    """Legt die benötigten Tabellen an, falls die DB noch leer ist."""
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sentiment_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER,
            sentiment TEXT, valence REAL, intensity INTEGER, tone TEXT,
            primary_emotion TEXT, secondary_emotions TEXT, confidence INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS mood_profile (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER, date DATE, daily_valence REAL, daily_intensity INTEGER,
            dominant_emotions TEXT, mood_shift TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )


def pick_template(day_offset: int, total_days: int) -> tuple:
    """Wählt einen Eintrag; eine langsame Grundstimmung erzeugt einen Verlauf.

    Vor einigen Wochen eher belastet, zuletzt spürbar aufgehellt – so hat der
    Stimmungsverlauf eine erkennbare Tendenz statt reinem Rauschen.
    """
    progress = 1 - (day_offset / total_days)  # 0 = alt, 1 = heute
    # Basiswahrscheinlichkeit für "gut" steigt zum Jetzt hin an.
    p_good = 0.25 + 0.45 * progress
    p_bad = 0.45 - 0.30 * progress
    r = random.random()
    if r < p_good:
        return random.choice(POSITIVE)
    if r < p_good + p_bad:
        return random.choice(NEGATIVE)
    return random.choice(NEUTRAL)


def insert_entry(conn: sqlite3.Connection, when: datetime, template: tuple) -> None:
    text, valence, emotion, intensity, secondary = template
    valence += random.uniform(-0.08, 0.08)
    valence = max(-1.0, min(1.0, round(valence, 3)))
    # created_at ist in der App-DB immer UTC (CURRENT_TIMESTAMP der Container);
    # `when` ist lokale Zeit → konvertieren. `date` bleibt der lokale Kalendertag.
    created = when.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    date_only = when.strftime("%Y-%m-%d")

    cur = conn.cursor()
    cur.execute(
        "INSERT INTO entries (content, created_at) VALUES (?, ?)", (text, created)
    )
    entry_id = cur.lastrowid
    cur.execute(
        """INSERT INTO sentiment_analysis
           (entry_id, sentiment, valence, intensity, tone, primary_emotion,
            secondary_emotions, confidence, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (entry_id, sentiment_label(valence), valence, intensity, emotion, emotion,
         json.dumps(secondary), random.randint(75, 95), created),
    )
    cur.execute(
        """INSERT INTO mood_profile
           (entry_id, date, daily_valence, daily_intensity, dominant_emotions,
            mood_shift, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (entry_id, date_only, valence, intensity,
         json.dumps([emotion, *secondary]), "stable", created),
    )


def seed(db_path: Path, reset: bool, days_back: int = 210) -> None:
    conn = sqlite3.connect(str(db_path))
    ensure_schema(conn)

    if reset:
        conn.executescript(
            "DELETE FROM mood_profile; DELETE FROM sentiment_analysis; "
            "DELETE FROM entries;"
        )
        print("[reset] Bestehende Eintraege/Analysen geloescht.")

    random.seed(42)
    today = datetime.now().replace(hour=20, minute=0, second=0, microsecond=0)
    created = 0

    for day_offset in range(days_back, -1, -1):
        day = today - timedelta(days=day_offset)
        # Letzte 6 Tage garantiert je ein Eintrag (schöner Streak).
        force = day_offset <= 5
        if not force and random.random() > 0.42:
            continue

        entries_today = 1 + (1 if random.random() < 0.25 else 0)
        for _ in range(entries_today):
            hour = random.randint(7, 22)
            minute = random.randint(0, 59)
            when = day.replace(hour=hour, minute=minute)
            insert_entry(conn, when, pick_template(day_offset, days_back))
            created += 1

    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
    conn.close()
    print(f"[ok] {created} Eintraege erzeugt. Eintraege gesamt in der DB: {total}")
    print(f"     DB: {db_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clarity-DB mit Demo-Daten füllen.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="Pfad zur clarity.db")
    parser.add_argument("--reset", action="store_true",
                        help="Vorhandene Einträge vorher löschen")
    args = parser.parse_args()
    seed(args.db, reset=args.reset)
