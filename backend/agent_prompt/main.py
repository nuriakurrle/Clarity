"""Clarity Prompt Agent - Port 8003 - WITH DATABASE"""
import os, json, re, logging, sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx, uvicorn

sys.path.insert(0, '/app/shared')
from database import (
    init_db,
    save_prompts,
    save_entry,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Prompt Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                  allow_methods=["*"], allow_headers=["*"])

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("MODEL", "llama3.2:1b")

@app.on_event("startup")
async def startup():
    init_db()
    logger.info("✅ Database initialized")

class TextInput(BaseModel):
    text: str = ""
    entry_id: int | None = None

def parse_prompts(response_text: str) -> list[str]:
    json_match = re.search(r'\{.*?"prompts"\s*:\s*\[(.*?)\]\s*\}', response_text, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(f'{{"prompts":[{json_match.group(1)}]}}')
            prompts = parsed.get("prompts", [])
            return [prompt.strip() for prompt in prompts if str(prompt).strip()]
        except Exception:
            pass

    prompts: list[str] = []
    for raw_line in response_text.splitlines():
        line = raw_line.strip()
        line = re.sub(r"^[-*\d\.\)\s]+", "", line)
        line = line.strip('"')
        if line:
            prompts.append(line)
    return prompts[:3]

def fallback_prompts(text: str) -> list[str]:
    cleaned_text = text.strip()
    if not cleaned_text:
        return [
            "Was beschäftigt mich gerade am meisten?",
            "Welche Situation hat meine Stimmung heute verändert?",
            "Was brauche ich morgen mehr, damit es ruhiger wird?",
        ]

    return [
        f"Was an '{cleaned_text[:40]}' war heute am stärksten spürbar?",
        "Welche Gedanken oder Ereignisse haben die Stimmung am meisten beeinflusst?",
        "Was könnte ich beim nächsten Mal anders machen, damit der Tag leichter wird?",
    ]

@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "prompt"}

@app.post("/generate-prompts")
async def generate_prompts(input: TextInput):
    logger.info(f"💭 Generating prompts...")
    base_text = input.text.strip()

    prompt = f"""Generate 3 reflection questions from this journal entry.

"{base_text}"

Return three short questions on separate lines."""

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{OLLAMA_HOST}/api/generate",
                json={"model": MODEL, "prompt": prompt, "stream": False, "format": "json", "temperature": 0.5}
            )
            result = response.json()
            response_text = result.get("response", "")
            prompts = parse_prompts(response_text)

            if len(prompts) < 3:
                prompts = fallback_prompts(base_text)

            prompt_data = {"prompts": prompts[:3]}
            logger.info("✅ Prompts generated")

            # 💾 SAVE TO DATABASE
            entry_id = input.entry_id if input.entry_id is not None else save_entry(base_text)
            save_prompts(entry_id, prompt_data.get("prompts", []))
            logger.info(f"💾 Saved to DB (entry_id={entry_id})")

            prompt_data["entry_id"] = entry_id

            return prompt_data
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        raise

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
