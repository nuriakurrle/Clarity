"""Clarity Prompt Agent - Port 8003
Advanced prompt generation with context-aware selection and LLM integration.
"""

import os
import sys
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Add shared module to path
sys.path.insert(0, '/app/shared')
try:
    from database import init_db
except ImportError:
    def init_db():
        logging.warning("⚠️  Database module not available (local dev mode)")

# Import routes - use relative import for Docker compatibility
try:
    from routes import router as prompt_router
    from routes import set_ollama_config
except ImportError:
    # Fallback for local development
    from backend.agent_prompt.routes import router as prompt_router
    from backend.agent_prompt.routes import set_ollama_config

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Config from environment
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL = os.getenv("MODEL", "llama3.2:1b")
PORT = int(os.getenv("PORT", 8000))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown event handler."""
    # Startup
    try:
        init_db()
        logger.info("✅ Database initialized")
    except Exception as e:
        logger.warning(f"⚠️  Database initialization failed: {e}")
    
    set_ollama_config(OLLAMA_HOST, MODEL)
    logger.info(f"🤖 Ollama configured: {OLLAMA_HOST}, Model: {MODEL}")
    logger.info(f"🚀 Prompt Agent starting on port {PORT}")
    
    yield
    
    # Shutdown
    logger.info("🛑 Prompt Agent shutting down")


# FastAPI app
app = FastAPI(
    title="Clarity Prompt Agent",
    description="Context-aware prompt generation for journaling",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(prompt_router, tags=["prompts"])


# Development/testing
if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=PORT,
        log_level="info",
    )
