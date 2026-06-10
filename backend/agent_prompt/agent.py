"""CrewAI Prompt Agent"""
from crewai import Agent

prompt_agent = Agent(
    role="Reflection Coach",
    goal="Generate reflection questions",
    backstory="You help with self-discovery"
)
