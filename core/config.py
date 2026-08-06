"""
Environment-driven configuration shared across the backend.

Centralizes paths and limits so Windows/Linux deployments behave consistently
without scattering magic strings through main.py and agents/.
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

# checksum-backend/ project root (parent of core/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent


def _path_from_env(key: str, default: Path) -> Path:
    value = os.environ.get(key)
    return Path(value) if value else default


UPLOAD_DIR: Path = _path_from_env(
    "CHECKSUM_UPLOAD_DIR",
    Path(tempfile.gettempdir()) / "checksum_uploads",
)
MAX_UPLOAD_BYTES: int = int(os.environ.get("CHECKSUM_MAX_UPLOAD_MB", "10")) * 1024 * 1024
MODEL_PATH: str = os.environ.get(
    "CHECKSUM_MODEL_PATH",
    str(PROJECT_ROOT / "models" / "hiring_agent.json"),
)
CALIBRATED_THRESHOLDS_PATH: str = os.environ.get(
    "CHECKSUM_THRESHOLDS_PATH",
    str(PROJECT_ROOT / "models" / "calibrated_thresholds.json"),
)
ALLOWED_UPLOAD_EXTENSIONS: frozenset[str] = frozenset({".csv", ".json", ".pdf", ".docx"})

# Feature flags (Section 5 — gated rollout)
CHECKSUM_LLM_ENABLED: bool = os.environ.get("CHECKSUM_LLM_ENABLED", "false").lower() in (
    "1",
    "true",
    "yes",
)
CHECKSUM_ENABLE_KERNEL_SHAP: bool = os.environ.get(
    "CHECKSUM_ENABLE_KERNEL_SHAP", "true"
).lower() in ("1", "true", "yes")
CHECKSUM_ENABLE_PDF: bool = os.environ.get("CHECKSUM_ENABLE_PDF", "false").lower() in (
    "1",
    "true",
    "yes",
)
CHECKSUM_REQUIRE_HTTPS_EXTERNAL: bool = os.environ.get(
    "CHECKSUM_REQUIRE_HTTPS_EXTERNAL", "false"
).lower() in ("1", "true", "yes")
CHECKSUM_API_KEY: str | None = os.environ.get("CHECKSUM_API_KEY")

# Sampling caps for large batches (Section 4.3)
MAX_PERTURBATION_CANDIDATES: int = int(
    os.environ.get("CHECKSUM_MAX_PERTURBATION_CANDIDATES", "500")
)
MAX_SHAP_CANDIDATES: int = int(os.environ.get("CHECKSUM_MAX_SHAP_CANDIDATES", "200"))
MAX_KERNEL_SHAP_CANDIDATES: int = int(
    os.environ.get("CHECKSUM_MAX_KERNEL_SHAP_CANDIDATES", "50")
)
MAX_KERNEL_SHAP_BACKGROUND: int = int(
    os.environ.get("CHECKSUM_MAX_KERNEL_SHAP_BACKGROUND", "100")
)

# Tier 3 statistical thresholds
DEMOGRAPHIC_PARITY_THRESHOLD: float = float(
    os.environ.get("CHECKSUM_DEMOGRAPHIC_PARITY_THRESHOLD", "0.15")
)
