# Ein gemeinsames Image für alle Agenten. Welcher Agent im Container
# startet, entscheidet docker-compose per `command:` (z. B.
# `python agent_sentiment/main.py`).
FROM python:3.11-slim
WORKDIR /app
# Erst nur die Requirements kopieren und installieren: Docker cached diese
# Schicht, solange sich die requirements.txt nicht ändert – Code-Änderungen
# lösen dann keine Neuinstallation aller Pakete aus.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Nicht als root laufen (Security Best Practice): eigener Benutzer ohne
# Sonderrechte. /whisper-cache gehört ihm, damit der Transcribe-Agent die
# Whisper-Modelle dorthin laden kann (HF_HOME zeigt huggingface darauf).
RUN useradd --create-home appuser \
    && mkdir -p /whisper-cache \
    && chown appuser:appuser /whisper-cache
ENV HF_HOME=/whisper-cache
USER appuser
EXPOSE 8000
