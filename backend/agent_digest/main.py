"""Clarity Digest Agent - Port 8004 - WITH DATABASE"""
import os
import json
import re
import logging
import sys
from datetime import datetime, timedelta
from typing import List

import httpx
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, "/app/shared")
from database import (  # noqa: E402
    init_db,
    save_digest,
    get_recent_entries,
    get_recent_sentiments,
    get_recent_patterns,
    get_recent_prompts,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Digest Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("MODEL", "llama3.2:1b")
SENTIMENT_AGENT_URL = os.getenv("SENTIMENT_AGENT_URL", "http://localhost:8001")
PROMPT_AGENT_URL = os.getenv("PROMPT_AGENT_URL", "http://localhost:8003")
PATTERN_AGENT_URL = os.getenv("PATTERN_AGENT_URL", "http://localhost:8002")


def fallback_digest(entries: list[str], week: str) -> dict:
    summary = f"{week}: {len(entries)} journal entries captured."
    highlights = [entry[:80].strip() for entry in entries[:3] if entry.strip()]

    return {
        "summary": summary,
        "highlights": highlights,
        "challenges": [],
        "growth": [],
        "affirmation": "Du bleibst dran, auch wenn es anstrengend ist.",
    }


@app.on_event("startup")
async def startup():
    init_db()
    logger.info("✅ Database initialized")


class DigestInput(BaseModel):
    entries: List[str] = []
    week: str = "this week"


class WorkflowInput(BaseModel):
    text: str
    week: str = "this week"
    recent_limit: int = 7


async def build_digest(entries: list[str], week: str = "this week") -> dict:
    entries_text = "\n---\n".join(entries)
    sentiment_text = json.dumps(get_recent_sentiments(), ensure_ascii=True, indent=2)
    pattern_text = json.dumps(get_recent_patterns(), ensure_ascii=True, indent=2)
    prompt_text = json.dumps(get_recent_prompts(), ensure_ascii=True, indent=2)

    digest_prompt = f"""Create weekly summary for {week}.

Recent journal entries:
{entries_text}

Recent sentiment analyses:
{sentiment_text}

Recent pattern detections:
{pattern_text}

Recent reflection prompts:
{prompt_text}

Format: Return ONLY valid JSON matching this schema:
{{"summary": string, "highlights": [string], "challenges": [string], "growth": [string], "affirmation": string}}

Example:
{{"summary":"This week I felt more focused and accomplished small wins.","highlights":["Completed project milestone","Managed stress with short breaks"],"challenges":["Evening fatigue"],"growth":["Improved time blocking"],"affirmation":"I make steady progress each day."}}

Synthesize the signals into a coherent weekly reflection and return the JSON only.
"""

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": MODEL,
                "prompt": digest_prompt,
                "stream": False,
                "format": "json",
                "temperature": 0.25,
            },
        )
        result = response.json()
        json_match = re.search(r"\{.*\}", result.get("response", ""), re.DOTALL)

        if not json_match:
            digest_data = fallback_digest(entries, week)
        else:
            try:
                digest_data = json.loads(json_match.group())
            except Exception:
                digest_data = fallback_digest(entries, week)
        logger.info("✅ Digest created")

        week_start = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime("%Y-%m-%d")
        save_digest(
            week_start,
            digest_data.get("summary", ""),
            digest_data.get("highlights", []),
            digest_data.get("challenges", []),
            digest_data.get("growth", []),
            digest_data.get("affirmation", ""),
        )
        logger.info("💾 Saved to DB")

        return digest_data


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "digest"}


@app.post("/create-digest")
async def create_digest(input: DigestInput):
    logger.info(f"📖 Creating digest for {len(input.entries)} entries...")
    entries = input.entries or [entry["content"] for entry in get_recent_entries()]
    return await build_digest(entries, input.week)


@app.post("/run-workflow")
async def run_workflow(input: WorkflowInput):
    logger.info("🔁 Running orchestrated workflow")

    async with httpx.AsyncClient(timeout=120) as client:
        sentiment_response = await client.post(
            f"{SENTIMENT_AGENT_URL}/analyze",
            json={"text": input.text},
        )
        sentiment_response.raise_for_status()
        sentiment_data = sentiment_response.json()

        prompt_response = await client.post(
            f"{PROMPT_AGENT_URL}/generate-prompts",
            json={"text": input.text, "entry_id": sentiment_data.get("entry_id")},
        )
        prompt_response.raise_for_status()
        prompt_data = prompt_response.json()

        recent_entries = get_recent_entries(input.recent_limit)
        pattern_response = await client.post(
            f"{PATTERN_AGENT_URL}/detect-patterns",
            json={"entries": [entry["content"] for entry in recent_entries]},
        )
        pattern_response.raise_for_status()
        pattern_data = pattern_response.json()

    digest_data = await build_digest(
        [entry["content"] for entry in get_recent_entries(input.recent_limit)],
        input.week,
    )

    return {
        "sentiment": sentiment_data,
        "prompts": prompt_data,
        "patterns": pattern_data,
        "digest": digest_data,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
