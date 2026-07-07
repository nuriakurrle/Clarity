"""Conftest - Shared pytest fixtures."""

import pytest
import sys

sys.path.insert(0, '/home/nkurrle/4_Semester/Mobile_Anwendung/Clarity/Clarity')


@pytest.fixture
def sample_sentiment():
    """Sample sentiment data."""
    return {
        "label": "neutral",
        "score": 0.5,
        "distress_score": 0.2,
    }


@pytest.fixture
def sample_patterns():
    """Sample detected patterns."""
    return ["work", "sleep"]


@pytest.fixture
def sample_entry():
    """Sample journal entry."""
    return "Heute war ein interessanter Tag. Ich habe viel gelernt und bin müde."
