"""Clarity Sentiment Agent - Port 8001 - Emotional Tone Analysis with Longitudinal Mood Profile"""
import os, json, re, logging, sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx, uvicorn
from datetime import datetime, timedelta

# Add shared to path
sys.path.insert(0, '/app/shared')
from database import (
    init_db, save_sentiment, save_entry, get_mood_profile, 
    save_mood_profile, calculate_mood_trend, get_emotional_summary
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Sentiment Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                  allow_methods=["*"], allow_headers=["*"])

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = "phi3"

# Initialize DB on startup
@app.on_event("startup")
async def startup():
    init_db()
    logger.info("✅ Database initialized")

class TextInput(BaseModel):
    text: str
    entry_id: Optional[int] = None

class MoodProfileRequest(BaseModel):
    days: int = 7  # Last N days
    include_trend: bool = True

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "sentiment", "model": MODEL}

@app.post("/analyze")
async def analyze_sentiment(input: TextInput):
    """
    Comprehensive sentiment analysis including:
    - Emotional tone (emotional state)
    - Valence (positivity spectrum: -1 to +1)
    - Intensity (emotional strength: 0-100)
    - Emotions (discrete emotion categories)
    - Confidence level
    """
    logger.info(f"📊 Analyzing: {input.text[:50]}...")

    prompt = f"""Analyze the emotional content of this journal entry deeply:

Entry: "{input.text}"

Respond ONLY with valid JSON (no markdown, no explanations):
{{
    "sentiment": "positive/neutral/negative",
    "valence": -0.8,
    "intensity": 75,
    "tone": "description of emotional tone",
    "primary_emotion": "emotion name",
    "secondary_emotions": ["emotion1", "emotion2"],
    "confidence": 85,
    "reasoning": "brief explanation"
}}

Valence ranges from -1 (very negative) to +1 (very positive).
Intensity ranges from 0 (minimal) to 100 (maximum emotional energy).
"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={"model": MODEL, "prompt": prompt, "stream": False, "temperature": 0.3}
            )
            result = response.json()
            response_text = result.get("response", "")
            
            # Extract JSON from response
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text, re.DOTALL)

            if json_match:
                sentiment_data = json.loads(json_match.group())
                logger.info(f"✅ Sentiment detected - Valence: {sentiment_data.get('valence')}, Intensity: {sentiment_data.get('intensity')}")

                # 💾 SAVE TO DATABASE
                entry_id = input.entry_id or save_entry(input.text)
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

                return {
                    "entry_id": entry_id,
                    "analysis": sentiment_data
                }
            else:
                logger.error(f"Failed to extract JSON from: {response_text[:200]}")
                raise Exception("Could not parse sentiment analysis response as JSON")
                
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise

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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
