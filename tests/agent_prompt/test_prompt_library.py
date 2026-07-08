"""Tests for prompt_library.py"""

import sys
import pytest

sys.path.insert(0, '/home/nkurrle/4_Semester/Mobile_Anwendung/Clarity/Clarity')

from backend.agent_prompt.tools.prompt_library import (
    PROMPT_LIBRARY,
    get_prompt_by_category,
)


class TestPromptLibraryStructure:
    """Test that the prompt library has all required categories."""
    
    def test_all_categories_exist(self):
        """Check all main categories exist."""
        required_categories = [
            "starter",
            "sentiment_based",
            "pattern_based",
            "temporal",
            "safety",
            "streak_break",
            "milestone",
        ]
        for cat in required_categories:
            assert cat in PROMPT_LIBRARY, f"Missing category: {cat}"
    
    def test_sentiment_categories(self):
        """Check sentiment_based has all sub-categories."""
        required_sentiments = ["positive", "negative", "neutral", "anxious", "sad"]
        sentiment_lib = PROMPT_LIBRARY.get("sentiment_based", {})
        for sent in required_sentiments:
            assert sent in sentiment_lib, f"Missing sentiment: {sent}"
    
    def test_pattern_categories(self):
        """Check pattern_based has key categories."""
        required_patterns = ["work", "relationships", "sleep", "family", "health"]
        pattern_lib = PROMPT_LIBRARY.get("pattern_based", {})
        for pat in required_patterns:
            assert pat in pattern_lib, f"Missing pattern: {pat}"
    
    def test_temporal_categories(self):
        """Check temporal has time-based categories."""
        required_temporal = ["morning", "evening", "weekly_reflection"]
        temporal_lib = PROMPT_LIBRARY.get("temporal", {})
        for temp in required_temporal:
            assert temp in temporal_lib, f"Missing temporal: {temp}"
    
    def test_multilingual_support(self):
        """Check DE/EN support for major categories."""
        for category in ["starter", "safety", "streak_break"]:
            cat_lib = PROMPT_LIBRARY.get(category, {})
            assert "de" in cat_lib, f"{category} missing 'de'"
            assert "en" in cat_lib, f"{category} missing 'en'"


class TestPromptLibraryContent:
    """Test that prompts are non-empty and valid."""
    
    def test_starter_prompts(self):
        """Starter prompts should be accessible."""
        prompts_de = get_prompt_by_category("starter", "de")
        assert len(prompts_de) > 0
        assert all(isinstance(p, str) and len(p) > 0 for p in prompts_de)
    
    def test_sentiment_prompts(self):
        """Sentiment subcategories should have prompts."""
        prompts = get_prompt_by_category("sentiment_based", "de", "positive")
        assert len(prompts) > 0
        assert all(isinstance(p, str) for p in prompts)
    
    def test_pattern_prompts(self):
        """Pattern subcategories should have prompts."""
        prompts = get_prompt_by_category("pattern_based", "de", "work")
        assert len(prompts) > 0
    
    def test_safety_prompts(self):
        """Safety prompts should exist."""
        prompts = get_prompt_by_category("safety", "de")
        assert len(prompts) > 0


class TestGetPromptByCategory:
    """Test get_prompt_by_category function."""
    
    def test_get_starter_de(self):
        """Should return German starter prompts."""
        prompts = get_prompt_by_category("starter", "de")
        assert isinstance(prompts, list)
        assert len(prompts) > 0
    
    def test_get_starter_en(self):
        """Should return English starter prompts."""
        prompts = get_prompt_by_category("starter", "en")
        assert isinstance(prompts, list)
        assert len(prompts) > 0
    
    def test_get_nonexistent_category(self):
        """Should return empty list for invalid category."""
        prompts = get_prompt_by_category("nonexistent", "de")
        assert prompts == []
    
    def test_get_with_subcategory(self):
        """Should retrieve subcategory prompts."""
        prompts = get_prompt_by_category("sentiment_based", "de", "sad")
        assert isinstance(prompts, list)
        assert len(prompts) > 0
