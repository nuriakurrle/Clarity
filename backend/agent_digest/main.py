"""Clarity Digest Agent - Port 8004 - WITH DATABASE"""
import os, json, re, logging, sys
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx, uvicorn
from datetime import datetime, timedelta

sys.path.insert(0, '/app/shared')
from database import init_db, save_digest

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Digest Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                  allow_methods=["*"], allow_headers=["*"])

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = "phi3"

@app.on_event("startup")
async def startup():
    init_db()
    logger.info("✅ Database initialized")

class DigestInput(BaseModel):
    entries: List[str]
    week: str = "this week"

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "digest"}

@app.post("/create-digest")
async def create_digest(input: DigestInput):
    logger.info(f"📖 Creating digest for {len(input.entries)} entries...")
    entries_text = "\n---\n".join(input.entries)

    prompt = f"""Create weekly summary:

{entries_text}

Respond with JSON:
{{"summary": "...", "highlights": [], "challenges": [], "growth": [], "affirmation": "..."}}"""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={"model": MODEL, "prompt": prompt, "stream": False, "temperature": 0.4}
            )
            result = response.json()
            json_match = re.search(r'\{.*\}', result.get("response", ""), re.DOTALL)

            if json_match:
                digest_data = json.loads(json_match.group())
                logger.info("✅ Digest created")

                # 💾 SAVE TO DATABASE
                week_start = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime("%Y-%m-%d")
                save_digest(
                    week_start,
                    digest_data.get("summary", ""),
                    digest_data.get("highlights", []),
                    digest_data.get("challenges", []),
                    digest_data.get("growth", []),
                    digest_data.get("affirmation", "")
                )
                logger.info("💾 Saved to DB")

                return digest_data
            raise Exception("No JSON")
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
