"""
Hiring Agent — the reference implementation of the ScoringModel interface
(interface/model_interface.py). Wraps the real, honestly-trained XGBoost
model (models/hiring_agent.json).

This class does NOT know it's being audited. It just answers "score(candidate)"
honestly, exactly like it would for a real user requesting a hiring decision.
The Audit Agent is the one that decides to perturb inputs and compare results —
that logic lives entirely outside this class, per the model-agnostic design.
"""

from __future__ import annotations
import json
import xgboost as xgb

from core.config import MODEL_PATH
from interface.model_interface import (
    Candidate,
    ScoreResult,
    ScoringModel,
    ExplainabilityMethod,
)

MODEL_PATH = MODEL_PATH  # re-export for callers that imported this name
FEATURE_COLS = ["screening_score", "college_tier", "is_metro", "career_gap_months", "experience_years"]
SKILL_FIELDS = ["screening_score", "experience_years"]
PEDIGREE_FIELDS = ["college_tier", "is_metro", "career_gap_months"]
SHORTLIST_THRESHOLD = 0.5  # matches the training's 60th-percentile binary label at decision time


class HiringAgent(ScoringModel):
    """
    Reference implementation. Own model, trained honestly on synthetic
    Recruitment Bias & Fairness data (Kaggle) + India-specific synthetic
    proxy columns (college_tier, is_metro), with a properly reconstructed
    skill-driven outcome label (shortlisted_v2).

    Model performance (from training run): accuracy 90.75%, AUC 0.98.
    """

    def __init__(self, model_path: str = MODEL_PATH):
        self._model = xgb.XGBClassifier()
        self._model.load_model(model_path)
        self._feature_cols = FEATURE_COLS

    @classmethod
    def load_default(cls) -> "HiringAgent":
        """Convenience constructor used by main.py/orchestration/graph.py so
        callers don't need to know the on-disk model path. Added when wiring
        the FastAPI + LangGraph layer up to this reference implementation;
        just forwards to the default MODEL_PATH."""
        return cls()

    def score(self, candidate: Candidate) -> ScoreResult:
        # Build the feature row in the exact order/names the model was trained on.
        row = {col: candidate.features.get(col) for col in self._feature_cols}
        missing = [col for col, val in row.items() if val is None]
        if missing:
            raise ValueError(
                f"HiringAgent cannot score candidate {candidate.candidate_id}: "
                f"missing required fields {missing}. Per the plan's 'never guess' "
                f"rule, this candidate should be excluded from Hiring Agent scoring "
                f"and flagged 'not scored — data unavailable', not silently filled in."
            )

        import pandas as pd
        X = pd.DataFrame([row], columns=self._feature_cols)
        # Records coming from the real ingestion pipeline (CSV/JSON uploads)
        # arrive as strings, not the already-numeric columns the original
        # synthetic_data_generator.py produced. XGBoost requires numeric
        # dtypes, so coerce here rather than pushing this cast onto every
        # caller.
        try:
            X = X.astype(float)
        except (TypeError, ValueError) as e:
            raise ValueError(
                f"HiringAgent cannot score candidate {candidate.candidate_id}: "
                f"non-numeric value in required fields {list(row.keys())}: {e}"
            ) from e
        prob = float(self._model.predict_proba(X)[:, 1][0])
        decision = "Shortlisted" if prob >= SHORTLIST_THRESHOLD else "Not Shortlisted"

        return ScoreResult(
            candidate_id=candidate.candidate_id,
            score=round(prob * 100, 2),  # 0-100 scale, consistent with plan's Section 9 output format
            decision=decision,
            feature_importances=None,  # native XGBoost feature_importances_ is global, not per-candidate;
                                        # per-candidate attribution needs SHAP -> handled by explainability_backend.py
            explainability_method=ExplainabilityMethod.NONE,
            raw_output={"probability": prob},
        )

    def score_batch(self, candidates: list[Candidate]) -> list[ScoreResult]:
        """
        Vectorized batch scoring - same results as repeated score() calls,
        but a single matrix predict_proba() call for speed on the common
        case (clean, complete data).

        Falls back to per-candidate scoring (isolating failures) if the
        vectorized path can't run for the batch as a whole - most commonly
        one row with a present-but-non-numeric value in a required field
        (e.g. a stray "N/A" in screening_score), which would otherwise make
        pandas' astype(float) - and this whole method - fail for every
        candidate in the batch, not just the bad one. node_score
        (orchestration/graph.py) already filters out candidates with
        MISSING required fields before calling this; this covers the
        separate "present but corrupted" case that filter can't catch.
        """
        if not candidates:
            return []

        import pandas as pd

        rows = []
        any_missing = False
        for candidate in candidates:
            row = {col: candidate.features.get(col) for col in self._feature_cols}
            if any(val is None for val in row.values()):
                any_missing = True
            rows.append(row)

        if any_missing:
            return self._score_batch_per_candidate(candidates)

        X = pd.DataFrame(rows, columns=self._feature_cols)
        try:
            X = X.astype(float)
        except (TypeError, ValueError):
            # At least one row has a present-but-non-numeric value; fall
            # back so only that row is excluded, not the whole batch.
            return self._score_batch_per_candidate(candidates)

        probs = self._model.predict_proba(X)[:, 1]
        results: list[ScoreResult] = []
        for candidate, prob in zip(candidates, probs):
            prob = float(prob)
            decision = "Shortlisted" if prob >= SHORTLIST_THRESHOLD else "Not Shortlisted"
            results.append(
                ScoreResult(
                    candidate_id=candidate.candidate_id,
                    score=round(prob * 100, 2),
                    decision=decision,
                    feature_importances=None,
                    explainability_method=ExplainabilityMethod.NONE,
                    raw_output={"probability": prob},
                )
            )
        return results

    def _score_batch_per_candidate(self, candidates: list[Candidate]) -> list[ScoreResult]:
        """Row-isolated fallback: score one at a time, catching failures per
        candidate rather than letting one bad row take the whole batch down."""
        results: list[ScoreResult] = []
        for candidate in candidates:
            try:
                results.append(self.score(candidate))
            except Exception as exc:  # noqa: BLE001
                results.append(ScoreResult(
                    candidate_id=candidate.candidate_id,
                    score=None,
                    decision="Not scored - data unavailable",
                    feature_importances=None,
                    explainability_method=ExplainabilityMethod.NONE,
                    raw_output=None,
                    error=str(exc),
                ))
        return results

    @property
    def supports_native_explainability(self) -> bool:
        # True in the sense that SHAP TreeExplainer works natively on XGBoost
        # (fast, exact) rather than falling back to KernelSHAP approximation.
        return True

    @property
    def model_source(self) -> str:
        return "checksum_hiring_agent"

    @property
    def feature_columns(self) -> list[str]:
        return list(self._feature_cols)

    @property
    def skill_fields(self) -> list[str]:
        return list(SKILL_FIELDS)

    @property
    def pedigree_fields(self) -> list[str]:
        return list(PEDIGREE_FIELDS)


def load_training_summary(path: str = "models/checksum_results_summary.json") -> dict:
    """
    Loads the training-time results (accuracy, AUC, SHAP importances, the
    validated perturbation test results) that were computed once during
    training. The Audit Agent's live perturbation tests are independent of
    this and will be re-computed per-audit-run, but this file is useful for
    populating dashboards/reports without re-running the full test every time.
    """
    with open(path) as f:
        return json.load(f)
