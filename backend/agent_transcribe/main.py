"""Clarity Transcribe Agent - Port 8005 - Speech-to-Text (Whisper, lokal)

Nimmt eine Audio-Aufnahme aus der App entgegen (m4a von iOS/Android,
webm aus dem Browser) und transkribiert sie lokal mit faster-whisper.
Die Sprache (Deutsch/Englisch/…) erkennt Whisper automatisch – es geht
nichts an externe Dienste, passend zum Privacy-first-Ansatz der App.

Das Modell wird beim ersten Start heruntergeladen (Hugging Face) und im
Docker-Volume `whisper_models` gecacht; danach ist der Start schnell.
"""
import logging
import os
import tempfile
import threading

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clarity Transcribe Agent")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# "small" ist der beste Kompromiss für Deutsch auf CPU (~500 MB);
# "base" wäre schneller, macht im Deutschen aber deutlich mehr Fehler.
MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")

_model: WhisperModel | None = None
_model_lock = threading.Lock()


def get_model() -> WhisperModel:
    """Whisper-Modell lazy laden (thread-sicher, nur einmal)."""
    global _model
    with _model_lock:
        if _model is None:
            logger.info(f"⏳ Loading Whisper model '{MODEL_SIZE}' (first run downloads it) …")
            _model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
            logger.info("✅ Whisper model ready")
        return _model


@app.on_event("startup")
async def startup():
    # Modell im Hintergrund vorladen, damit die erste Aufnahme nicht auf
    # den Download warten muss (der Server bleibt währenddessen erreichbar).
    threading.Thread(target=get_model, daemon=True).start()


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": "transcribe",
        "model": MODEL_SIZE,
        "model_loaded": _model is not None,
    }


@app.post("/transcribe")
def transcribe(file: UploadFile = File(...), language: str | None = Form(None)):
    """Audio-Datei → Text. `language` optional ("de"/"en"), sonst Auto-Erkennung.

    Sync-Endpoint: FastAPI führt ihn im Threadpool aus, die (CPU-lastige)
    Whisper-Inferenz blockiert den Event-Loop damit nicht.
    """
    data = file.file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # faster-whisper liest am robustesten von einem Dateipfad (PyAV erkennt
    # das Containerformat m4a/webm/wav selbst).
    suffix = os.path.splitext(file.filename or "")[1] or ".m4a"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        path = tmp.name

    try:
        segments, info = get_model().transcribe(
            path,
            language=language,
            beam_size=5,
            # Stille/Atmer rausfiltern – weniger Whisper-Halluzinationen
            vad_filter=True,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        logger.info(
            f"🎙️ Transcribed {info.duration:.1f}s audio "
            f"({info.language}, p={info.language_probability:.2f}): {text[:60]}…"
        )
        return {
            "text": text,
            "language": info.language,
            "language_probability": info.language_probability,
            "duration": info.duration,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")
    finally:
        os.unlink(path)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
