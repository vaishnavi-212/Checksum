"""
Shared enums and constants used across the Checksum backend.
"""

from __future__ import annotations

from enum import Enum


class AuditPath(str, Enum):
    """Upload routing paths (Section 5.2 / 5.3)."""

    OWN_MODEL = "1"
    EXTERNAL_WITH_ENDPOINT = "2a"
    DECISIONS_ONLY = "2b"
    REUSE_PRIOR = "3"


class AuditMode(str, Enum):
    PERTURBATION = "perturbation"
    STATISTICAL_ONLY = "statistical_only"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class FixStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class FixStrategy(str, Enum):
    AUTO = "auto"
    REWEIGHT = "reweight"
    THRESHOLD_ADJUST = "threshold_adjust"
    DROP_TOP_FLAGGED_FEATURE = "drop_top_flagged_feature"
