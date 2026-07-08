"""Tests for context_analyzer.py"""

import sys
import pytest

sys.path.insert(0, '/home/nkurrle/4_Semester/Mobile_Anwendung/Clarity/Clarity')

from backend.agent_prompt.tools.context_analyzer import ContextAnalyzer


class TestContextAnalyzerSelection:
    """Test prompt type selection logic."""
    
    def test_safety_priority(self):
        """Safety should be highest priority."""
        sentiment = {
            "label": "anxious",
            "score": 0.9,
            "distress_score": 0.8,
        }
        prompt_type, subcat, reason = ContextAnalyzer.choose_prompt_type(
            context="editor_open",
            sentiment=sentiment,
        )
        assert prompt_type == "safety"
    
    def test_milestone_30_days(self):
        """30-day milestone should be recognized."""
        prompt_type, subcat, reason = ContextAnalyzer.choose_prompt_type(
            context="home_screen",
            streak_days=30,
        )
        assert prompt_type == "milestone"
        assert subcat == "30"
    
    def test_milestone_60_days(self):
        """60-day milestone should be recognized."""
        prompt_type, subcat, reason = ContextAnalyzer.choose_prompt_type(
            context="home_screen",
            streak_days=60,
        )
        assert prompt_type == "milestone"
        assert subcat == "60"
    
    def test_starter_for_blank_page(self):
        """Editor open with no sentiment -> starter."""
        prompt_type, subcat, reason = ContextAnalyzer.choose_prompt_type(
            context="editor_open",
            sentiment=None,
            patterns=None,
        )
        assert prompt_type == "starter"
    
    def test_weekly_context(self):
        """Weekly context should trigger weekly_reflection."""
        prompt_type, subcat, reason = ContextAnalyzer.choose_prompt_type(
            context="weekly",
        )
        assert prompt_type == "temporal"
        assert subcat == "weekly_reflection"
    
    def test_pattern_based_routing(self):
        """Pattern-based should route to pattern category."""
        prompt_type, subcat, reason = ContextAnalyzer.choose_prompt_type(
            context="post_entry",
            patterns=["work", "relationships"],
        )
        assert prompt_type == "pattern_based"
        assert subcat == "work"
    
    def test_sentiment_based_routing(self):
        """Sentiment should route to sentiment category."""
        sentiment = {
            "label": "positive",
            "score": 0.8,
        }
        prompt_type, subcat, reason = ContextAnalyzer.choose_prompt_type(
            context="post_entry",
            sentiment=sentiment,
        )
        assert prompt_type == "sentiment_based"
        assert subcat == "positive"


class TestSentimentAnalysis:
    """Test sentiment category mapping."""
    
    def test_map_positive(self):
        """Should map positive label correctly."""
        sentiment = {"label": "positive", "score": 0.9}
        category = ContextAnalyzer.analyze_sentiment_for_category(sentiment)
        assert category == "positive"
    
    def test_map_anxious(self):
        """Should map anxious/worried labels."""
        sentiment = {"label": "worried", "score": 0.7}
        category = ContextAnalyzer.analyze_sentiment_for_category(sentiment)
        assert category == "anxious"
    
    def test_map_sad(self):
        """Should map sad label."""
        sentiment = {"label": "sad", "score": 0.6}
        category = ContextAnalyzer.analyze_sentiment_for_category(sentiment)
        assert category == "sad"
    
    def test_default_neutral(self):
        """Unknown labels should default to neutral."""
        sentiment = {"label": "confused", "score": 0.5}
        category = ContextAnalyzer.analyze_sentiment_for_category(sentiment)
        assert category == "neutral"


class TestHistoryAvoidance:
    """Test duplicate prompt prevention."""
    
    def test_should_avoid_recent_prompt(self):
        """Should identify recently used prompts."""
        user_history = ["prompt_1", "prompt_2", "prompt_3"]
        assert ContextAnalyzer.should_avoid_prompt("prompt_1", user_history)
    
    def test_should_not_avoid_new_prompt(self):
        """Should not flag new prompts."""
        user_history = ["prompt_1", "prompt_2"]
        assert not ContextAnalyzer.should_avoid_prompt("prompt_99", user_history)
    
    def test_no_history(self):
        """Should handle empty history."""
        assert not ContextAnalyzer.should_avoid_prompt("any_prompt", None)
