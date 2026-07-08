"""Context Analyzer - Determines which prompt category to use based on context."""

from typing import Optional


class ContextAnalyzer:
    """Analyzes context and sentiment data to determine prompt strategy."""
    
    @staticmethod
    def choose_prompt_type(
        context: str,
        sentiment: Optional[dict] = None,
        patterns: Optional[list] = None,
        streak_days: int = 0,
        user_history_ids: Optional[list] = None,
    ) -> tuple[str, Optional[str], str]:
        """
        Determine which prompt type to use.
        
        Args:
            context: One of ["editor_open", "post_entry", "home_screen", "weekly"]
            sentiment: Dict with sentiment analysis {label: str, score: float, distress_score: float}
            patterns: List of detected patterns ["work", "relationships", "sleep", etc.]
            streak_days: Current streak count
            user_history_ids: Already asked prompts to avoid repetition
        
        Returns:
            Tuple of (prompt_category, subcategory, reason)
        """
        
        # Safety check - highest priority
        if sentiment and sentiment.get("distress_score", 0) > 0.7:
            return ("safety", None, "Distress signal detected. Prioritizing emotional safety.")
        
        # Milestone check - celebratory
        if streak_days in [30, 60, 90]:
            return ("milestone", str(streak_days), f"Celebrating {streak_days}-day milestone!")
        
        # Streak break - gentle re-engagement
        if streak_days == 0 and _has_recent_entries_before_gap():
            return ("streak_break", None, "User is re-engaging after a break.")
        
        # Context-specific rules
        if context == "editor_open" and not (sentiment or patterns):
            return ("starter", None, "Blank page prevention - user just opened editor.")
        
        if context == "weekly":
            return ("temporal", "weekly_reflection", "Weekly reflection context requested.")
        
        if context == "morning":
            return ("temporal", "morning", "Morning journaling context.")
        
        if context == "evening":
            return ("temporal", "evening", "Evening reflection context.")
        
        # Pattern-based routing
        if patterns and len(patterns) > 0:
            primary_pattern = patterns[0]
            return ("pattern_based", primary_pattern, f"Detected recurring pattern: {primary_pattern}")
        
        # Sentiment-based routing
        if sentiment:
            label = sentiment.get("label", "neutral")
            return ("sentiment_based", label, f"Sentiment analysis: {label}")
        
        # Default fallback
        return ("starter", None, "No specific context - using starter prompt.")
    
    @staticmethod
    def analyze_sentiment_for_category(sentiment: dict) -> str:
        """Map sentiment scores to categories."""
        label = sentiment.get("label", "neutral")
        score = sentiment.get("score", 0.5)
        
        # Map labels to categories
        category_map = {
            "positive": "positive",
            "negative": "negative",
            "neutral": "neutral",
            "anxious": "anxious",
            "worried": "anxious",
            "sad": "sad",
            "happy": "positive",
            "angry": "negative",
        }
        
        return category_map.get(label, "neutral")
    
    @staticmethod
    def should_avoid_prompt(prompt_id: str, user_history_ids: Optional[list]) -> bool:
        """Check if this prompt was recently asked."""
        if not user_history_ids:
            return False
        return prompt_id in user_history_ids


def _has_recent_entries_before_gap() -> bool:
    """
    Helper: Check if user had entries before a gap.
    This would normally check the database.
    For now, return False (can be enhanced later with database integration).
    """
    return False
