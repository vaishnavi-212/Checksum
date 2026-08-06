"""
Process-wide cache for expensive model instances (XGBoost load from disk).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from agents.hiring_agent import HiringAgent

_hiring_agent: "HiringAgent | None" = None


def get_hiring_agent() -> "HiringAgent":
    """Return a cached HiringAgent, loading the model once per process."""
    global _hiring_agent
    if _hiring_agent is None:
        from agents.hiring_agent import HiringAgent

        _hiring_agent = HiringAgent.load_default()
    return _hiring_agent


def reset_hiring_agent_cache() -> None:
    """Clear cached model — useful in tests."""
    global _hiring_agent
    _hiring_agent = None
