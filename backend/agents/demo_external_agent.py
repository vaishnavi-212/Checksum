"""
Demo external model for build step 9 — proves model-agnostic auditing.

A lightweight logistic regression trained on a subset of features, exposed
via CallableModelAdapter. This is the "model we didn't build" demo case.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

from core.config import PROJECT_ROOT
from interface.external_model_adapter import CallableModelAdapter
from interface.model_interface import ScoringModel

# Different feature set from HiringAgent — heavier pedigree weighting for demo.
DEMO_FEATURE_COLS = ["screening_score", "college_tier", "is_metro"]
DEMO_SKILL_FIELDS = ["screening_score"]
DEMO_PEDIGREE_FIELDS = ["college_tier", "is_metro"]

_MODEL: LogisticRegression | None = None


def _load_training_data() -> tuple[np.ndarray, np.ndarray]:
    """Build a small training set from the sample fixture or synthetic defaults."""
    fixture = PROJECT_ROOT / "tests" / "fixtures" / "sample_candidates.csv"
    if fixture.is_file():
        import pandas as pd

        df = pd.read_csv(fixture)
        X = df[DEMO_FEATURE_COLS].astype(float).values
        y = df["shortlisted"].astype(int).values
        return X, y

    # Fallback synthetic data
    rng = np.random.default_rng(42)
    n = 100
    X = rng.uniform(0, 100, (n, 1))
    X = np.hstack([X, rng.integers(1, 4, (n, 1)), rng.integers(0, 2, (n, 1))])
    y = (X[:, 0] > 70).astype(int)
    return X, y


def _get_demo_model() -> LogisticRegression:
    global _MODEL
    if _MODEL is None:
        X, y = _load_training_data()
        model = LogisticRegression(max_iter=500)
        model.fit(X, y)
        _MODEL = model
    return _MODEL


def demo_score_fn(features: dict) -> dict:
    """Score function compatible with CallableModelAdapter."""
    model = _get_demo_model()
    row = np.array([[float(features.get(c, 0)) for c in DEMO_FEATURE_COLS]])
    prob = float(model.predict_proba(row)[:, 1][0])
    score = round(prob * 100, 2)
    decision = "Shortlisted" if prob >= 0.5 else "Not Shortlisted"
    return {
        "score": score,
        "decision": decision,
        "probability": prob,
    }


def load_demo_external_agent() -> ScoringModel:
    """Return a CallableModelAdapter wrapping the demo logistic model."""
    return CallableModelAdapter(
        score_fn=demo_score_fn,
        model_name="demo_logistic_external",
        has_native_explainability=False,
        feature_columns=DEMO_FEATURE_COLS,
        skill_fields=DEMO_SKILL_FIELDS,
        pedigree_fields=DEMO_PEDIGREE_FIELDS,
    )


def save_demo_model_artifact(path: str | None = None) -> str:
    """Optional: persist demo model coefficients for inspection."""
    model = _get_demo_model()
    out = path or str(PROJECT_ROOT / "models" / "demo_external_model.json")
    artifact = {
        "feature_columns": DEMO_FEATURE_COLS,
        "coefficients": model.coef_.tolist(),
        "intercept": model.intercept_.tolist(),
    }
    Path(out).write_text(json.dumps(artifact, indent=2), encoding="utf-8")
    return out
