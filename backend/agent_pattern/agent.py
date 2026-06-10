"""CrewAI Pattern Agent"""
from crewai import Agent

pattern_agent = Agent(
    role="Pattern Detective",
    goal="Find patterns in entries",
    backstory="You recognize behavioral patterns"
)
