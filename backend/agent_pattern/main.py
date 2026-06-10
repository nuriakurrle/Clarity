"""Clarity Pattern Agent - Port 8002 - WITH DATABASE"""
import os, json, re, logging, sys
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx, uvicorn

sys.path.insert(0, '/app/shared')
from database import init_db, save_pattern

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Pattern Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                  allow_methods=["*"], allow_headers=["*"])

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = "phi3"

@app.on_event("startup")
async def startup():
    init_db()
    logger.info("✅ Database initialized")

class EntriesInput(BaseModel):
    entries: List[str]

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "pattern"}

@app.post("/detect-patterns")
async def detect_patterns(input: EntriesInput):
    logger.info(f"🔍 Analyzing {len(input.entries)} entries...")
    entries_text = "\n---\n".join(input.entries)

    prompt = f"""Analyze patterns:

{entries_text}

Respond with JSON:
{{"top_themes": [], "mood_trend": "improving", "triggers": {{}}}}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={"model": MODEL, "prompt": prompt, "stream": False, "temperature": 0.3}
            )
            result = response.json()
            json_match = re.search(r'\{.*\}', result.get("response", ""), re.DOTALL)

            if json_match:
                pattern_data = json.loads(json_match.group())
                logger.info("✅ Patterns detected")

                # 💾 SAVE TO DATABASE
                save_pattern(
                    pattern_data.get("top_themes", []),
                    pattern_data.get("mood_trend", "stable"),
                    pattern_data.get("triggers", {})
                )
                logger.info("💾 Saved to DB")

                return pattern_data
            raise Exception("No JSON")
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
