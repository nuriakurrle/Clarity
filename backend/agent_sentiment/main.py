"""Clarity Sentiment Agent - Port 8001 - WITH DATABASE"""
import os, json, re, logging, sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx, uvicorn

# Add shared to path
sys.path.insert(0, '/app/shared')
from database import init_db, save_sentiment, save_entry

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

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "sentiment", "model": MODEL}

@app.post("/analyze")
async def analyze_sentiment(input: TextInput):
    logger.info(f"📊 Analyzing: {input.text[:50]}...")

    prompt = f"""Analyze emotional tone:

"{input.text}"

Respond ONLY with JSON:
{{"sentiment": "positive", "confidence": 85, "emotions": ["freude"]}}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={"model": MODEL, "prompt": prompt, "stream": False, "temperature": 0.3}
            )
            result = response.json()
            json_match = re.search(r'\{[^{}]*\}', result.get("response", ""), re.DOTALL)

            if json_match:
                sentiment_data = json.loads(json_match.group())
                logger.info("✅ Sentiment detected")

                # 💾 SAVE TO DATABASE
                entry_id = save_entry(input.text)
                save_sentiment(
                    entry_id,
                    sentiment_data.get("sentiment", "neutral"),
                    sentiment_data.get("confidence", 0),
                    sentiment_data.get("emotions", [])
                )
                logger.info(f"💾 Saved to DB (entry_id={entry_id})")

                return sentiment_data
            raise Exception("No JSON")
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
