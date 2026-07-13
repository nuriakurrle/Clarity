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
EXPOSE 8000
