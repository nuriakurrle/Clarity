"""CrewAI Sentiment Agent - Emotional Analysis Specialist"""
from crewai import Agent, Task, Crew
from crewai_tools import tool

sentiment_agent = Agent(
    role="Emotional Analyst & Mood Tracking Specialist",
    goal="""Analyze emotional tone, valence, and intensity in journal entries.
    Build longitudinal mood profiles that track emotional shifts over time.
    Identify emotional patterns, triggers, and provide mood insights.""",
    backstory="""You are an empathetic psychological analyst with deep expertise in:
    - Emotional intelligence and sentiment analysis
    - Longitudinal mood tracking and trend analysis
    - Identifying emotional patterns and triggers
    - Understanding emotional valence (positivity spectrum) and intensity
    - Providing compassionate, evidence-based emotional insights
    
    Your role is to help users understand their emotional journey by analyzing
    their journal entries and building a comprehensive mood profile over time.""",
    verbose=True,
    allow_delegation=False
)

emotion_detector_agent = Agent(
    role="Discrete Emotion Classifier",
    goal="""Identify and classify specific emotions from journal entries.
    Map complex emotional states to primary and secondary emotions.
    Track emotional evolution throughout entries and over time.""",
    backstory="""You are an expert in emotion classification with knowledge of:
    - Primary vs. secondary emotions
    - Emotion theory and psychological models
    - Cultural nuances in emotional expression
    - Cross-domain emotional intelligence
    
    Your task is to provide precise emotion labeling to complement valence/intensity metrics.""",
    verbose=True,
    allow_delegation=False
)

mood_trend_agent = Agent(
    role="Longitudinal Mood Trend Analyzer",
    goal="""Analyze mood patterns across days, weeks, and months.
    Detect emotional shifts and state changes.
    Provide actionable insights about mood trajectory and stability.""",
    backstory="""You are a behavioral scientist specializing in:
    - Temporal mood patterns and trends
    - Mood stability and volatility assessment
    - Identifying recovery patterns and resilience
    - Connecting mood shifts to life events
    
    Your expertise helps users understand their emotional resilience and patterns.""",
    verbose=True,
    allow_delegation=False
)

def analyze_entry_sentiment(entry_text: str) -> dict:
    """Analyze a single journal entry for sentiment and emotion"""
    
    analyze_task = Task(
        description=f"""Analyze the following journal entry for emotional tone:
        
Entry: {entry_text}

Provide a detailed emotional analysis including:
1. Overall sentiment (positive/negative/neutral)
2. Emotional valence on a scale from -1 (very negative) to +1 (very positive)
3. Emotional intensity from 0 (minimal) to 100 (maximum)
4. Identified primary emotion
5. Secondary emotions present
6. Emotional tone description
7. Confidence level in the analysis""",
        agent=sentiment_agent,
        expected_output="Detailed sentiment analysis with all requested metrics"
    )
    
    crew = Crew(
        agents=[sentiment_agent],
        tasks=[analyze_task],
        verbose=True
    )
    
    result = crew.kickoff()
    return result

def identify_emotions(entry_text: str) -> dict:
    """Identify discrete emotions in a journal entry"""
    
    emotion_task = Task(
        description=f"""Classify emotions in this journal entry:

Entry: {entry_text}

Identify:
1. Primary emotion (main emotional state)
2. Secondary emotions (supporting emotions)
3. Emotion intensity levels
4. Emotional clusters and relationships
5. Any mixed or conflicting emotions""",
        agent=emotion_detector_agent,
        expected_output="Classified emotions with relationships and intensity"
    )
    
    crew = Crew(
        agents=[emotion_detector_agent],
        tasks=[emotion_task],
        verbose=True
    )
    
    result = crew.kickoff()
    return result

def analyze_mood_trend(entries_timeline: list) -> dict:
    """Analyze mood trends across multiple entries"""
    
    timeline_str = "\n---\n".join([
        f"Date: {e.get('date', 'N/A')}\nEntry: {e.get('text', '')[:200]}..."
        for e in entries_timeline
    ])
    
    trend_task = Task(
        description=f"""Analyze mood trends across these entries:

{timeline_str}

Provide:
1. Overall mood trajectory (improving/declining/stable)
2. Significant emotional shifts and their timing
3. Emotional patterns and recurring themes
4. Mood volatility and stability assessment
5. Recovery patterns and resilience indicators""",
        agent=mood_trend_agent,
        expected_output="Longitudinal mood trend analysis with insights"
    )
    
    crew = Crew(
        agents=[mood_trend_agent],
        tasks=[trend_task],
        verbose=True
    )
    
    result = crew.kickoff()
    return result
