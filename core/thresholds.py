"""
Load empirically calibrated severity thresholds (Section 5.8).

Falls back to documented defaults when the artifact is missing.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from core.config import CALIBRATED_THRESHOLDS_PATH

logger = logging.getLogger(__name__)

# Same defaults as agents/audit_agent.py — used only when JSON is absent.
FALLBACK_THRESHOLDS = {
    "p_value_cutoff": 0.05,
    "low_effect_pts": 5.0,
    "high_effect_pts": 15.0,
}


def load_audit_thresholds() -> dict:
    """
    Map calibrated_thresholds.json into the shape AuditAgent expects:
    { p_value_cutoff, low_effect_pts, high_effect_pts }.
    """
    path = Path(CALIBRATED_THRESHOLDS_PATH)
    if not path.is_file():
        logger.warning(
            "calibrated_thresholds.json not found at %s — using fallback defaults",
            path,
        )
        return dict(FALLBACK_THRESHOLDS)

    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)

    return {
        "p_value_cutoff": float(data.get("p_value_cutoff", FALLBACK_THRESHOLDS["p_value_cutoff"])),
        "low_effect_pts": float(data.get("med_lower", data.get("low_ceiling", FALLBACK_THRESHOLDS["low_effect_pts"]))),
        "high_effect_pts": float(data.get("high_threshold", FALLBACK_THRESHOLDS["high_effect_pts"])),
        "source": str(path),
        "calibrated": True,
    }


def severity_band(abs_delta: float, p_value: float, thresholds: dict | None = None) -> str:
    """Unified severity mapping for backend and frontend (Section 5.2)."""
    th = thresholds or load_audit_thresholds()
    significant = p_value < th["p_value_cutoff"]
    if not significant:
        return "LOW"
    if abs_delta >= th["high_effect_pts"]:
        return "HIGH"
    if abs_delta >= th["low_effect_pts"]:
        return "MED"
    return "LOW"
