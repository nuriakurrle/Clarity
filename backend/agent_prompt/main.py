"""Clarity Prompt Agent - Port 8003 - WITH DATABASE"""
import os, json, re, logging, sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx, uvicorn

sys.path.insert(0, '/app/shared')
from database import init_db, save_prompts, save_entry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Prompt Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                  allow_methods=["*"], allow_headers=["*"])

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = "phi3"

@app.on_event("startup")
async def startup():
    init_db()
    logger.info("✅ Database initialized")

class TextInput(BaseModel):
    text: str

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "prompt"}

@app.post("/generate-prompts")
async def generate_prompts(input: TextInput):
    logger.info(f"💭 Generating prompts...")

    prompt = f"""Generate 3 reflection questions:

"{input.text}"

Respond with JSON:
{{"prompts": ["Q1?", "Q2?", "Q3?"]}}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={"model": MODEL, "prompt": prompt, "stream": False, "temperature": 0.5}
            )
            result = response.json()
            json_match = re.search(r'\{.*?"prompts".*?\}', result.get("response", ""), re.DOTALL)

            if json_match:
                prompt_data = json.loads(json_match.group())
                logger.info("✅ Prompts generated")

                # 💾 SAVE TO DATABASE
                entry_id = save_entry(input.text)
                save_prompts(entry_id, prompt_data.get("prompts", []))
                logger.info(f"💾 Saved to DB (entry_id={entry_id})")

                return prompt_data
            raise Exception("No JSON")
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
