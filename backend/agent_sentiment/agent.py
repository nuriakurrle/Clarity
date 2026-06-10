"""CrewAI Sentiment Agent"""
from crewai import Agent

sentiment_agent = Agent(
    role="Emotional Analyst",
    goal="Analyze emotional tone",
    backstory="You are an empathetic analyst"
)
