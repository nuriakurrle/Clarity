"""Tests for prompt_library.py"""

import sys

sys.path.insert(0, '/home/nkurrle/4_Semester/Mobile_Anwendung/Clarity/Clarity')

from backend.agent_prompt.tools.prompt_library import (
    PROMPT_LIBRARY,
    get_prompt_by_category,
    library_prompts,
)


class TestPromptLibraryStructure:
    """Test that the prompt library has all required categories."""

    def test_all_categories_exist(self):
        """Check all main categories exist."""
        for cat in ["starter", "sentiment_based"]:
            assert cat in PROMPT_LIBRARY, f"Missing category: {cat}"

    def test_sentiment_categories(self):
        """Check sentiment_based has all sub-categories."""
        required_sentiments = ["positive", "negative", "neutral", "anxious", "sad"]
        sentiment_lib = PROMPT_LIBRARY.get("sentiment_based", {})
        for sent in required_sentiments:
            assert sent in sentiment_lib, f"Missing sentiment: {sent}"

    def test_multilingual_support(self):
        """Check DE/EN support."""
        starter = PROMPT_LIBRARY.get("starter", {})
        assert "de" in starter and "en" in starter


class TestGetPromptByCategory:
    """Test get_prompt_by_category function."""

    def test_get_starter_de(self):
        """Should return German starter prompts."""
        prompts = get_prompt_by_category("starter", "de")
        assert isinstance(prompts, list)
        assert len(prompts) > 0
        assert all(isinstance(p, str) and len(p) > 0 for p in prompts)

    def test_get_starter_en(self):
        """Should return English starter prompts."""
        prompts = get_prompt_by_category("starter", "en")
        assert isinstance(prompts, list)
        assert len(prompts) > 0

    def test_get_nonexistent_category(self):
        """Should return empty list for invalid category."""
        assert get_prompt_by_category("nonexistent", "de") == []

    def test_get_with_subcategory(self):
        """Should retrieve subcategory prompts."""
        prompts = get_prompt_by_category("sentiment_based", "de", "sad")
        assert isinstance(prompts, list)
        assert len(prompts) > 0


class TestLibraryPrompts:
    """Test the offline selection used by /generate-prompts."""

    def test_starter_mode(self):
        """Blank page: draws from starter questions."""
        prompts = library_prompts(is_starter=True, n=4)
        assert 0 < len(prompts) <= 4
        assert all(isinstance(p, str) and p for p in prompts)

    def test_sentiment_context(self):
        """Sentiment context pulls matching subcategory questions in."""
        prompts = library_prompts(
            sentiment={"sentiment": "sehr schlecht", "emotions": ["Wut"]}, n=6
        )
        negative_pool = get_prompt_by_category("sentiment_based", "de", "negative")
        assert any(p in negative_pool for p in prompts)

    def test_pattern_context_fills_templates(self):
        """Pattern context fills {theme}/{trigger} templates."""
        prompts = library_prompts(
            pattern={"top_themes": ["Arbeit"], "triggers": {"Deadline": 3}}, n=6
        )
        assert any("Arbeit" in p or "Deadline" in p for p in prompts)

    def test_no_duplicates_and_limit(self):
        """Result is unique and respects n."""
        prompts = library_prompts(
            sentiment="positiv",
            pattern={"top_themes": ["Sport"]},
            digest={"summary": "Gute Woche"},
            n=4,
        )
        assert len(prompts) == len(set(prompts))
        assert len(prompts) <= 4
