"""
Score-adjustment wrapper for mitigation before/after comparison (Section 5.5).

Applies per-group additive adjustments toward the global mean score —
a lightweight threshold-style mitigation that does not retrain the model.
"""

from __future__ import annotations

from dataclasses import replace

from interface.model_interface import (
    Candidate,
    ScoreResult,
    ScoringModel,
)


class GroupAdjustedModel(ScoringModel):
    """Wraps a ScoringModel and applies per-group score offsets after scoring."""

    def __init__(
        self,
        inner: ScoringModel,
        group_adjustments: dict[str, float],
        group_field: str = "college_tier",
    ):
        self._inner = inner
        self._group_adjustments = group_adjustments
        self._group_field = group_field

    def score(self, candidate: Candidate) -> ScoreResult:
        base = self._inner.score(candidate)
        tier = str(candidate.features.get(self._group_field, ""))
        adjustment = self._group_adjustments.get(tier, 0.0)
        adjusted_score = round(max(0.0, min(100.0, base.score + adjustment)), 2)
        probability = adjusted_score / 100.0
        decision = "Shortlisted" if probability >= 0.5 else "Not Shortlisted"
        return replace(
            base,
            score=adjusted_score,
            decision=decision,
            raw_output={
                **(base.raw_output or {}),
                "mitigation_adjustment_pts": adjustment,
                "pre_mitigation_score": base.score,
            },
        )

    def score_batch(self, candidates: list[Candidate]) -> list[ScoreResult]:
        return [self.score(candidate) for candidate in candidates]

    @property
    def supports_native_explainability(self) -> bool:
        # Deliberately always False, even though the wrapped inner model
        # (e.g. HiringAgent) supports native TreeExplainer: after wrapping,
        # score() includes a post-hoc per-group additive adjustment that is
        # NOT part of the underlying tree structure. TreeExplainer only
        # ever sees the raw tree (via __getattr__'s "_model" passthrough
        # below), so it would silently ignore the mitigation adjustment
        # entirely — producing a "before vs after" SHAP comparison that
        # never actually reflects the mitigation, no matter how much the
        # scores themselves changed. Forcing the KernelSHAP (black-box)
        # path instead ensures the comparison calls THIS wrapper's own
        # .score() for every sample, so the adjustment is correctly
        # measured rather than silently bypassed.
        return False

    @property
    def model_source(self) -> str:
        return f"{self._inner.model_source}_mitigated"

    @property
    def feature_columns(self) -> list[str]:
        return self._inner.feature_columns

    @property
    def skill_fields(self) -> list[str]:
        return self._inner.skill_fields

    @property
    def pedigree_fields(self) -> list[str]:
        return self._inner.pedigree_fields

    def __getattr__(self, name: str):
        # Allow SHAP TreeExplainer to reach the underlying estimator.
        # No longer reached by skill_vs_pedigree_split for THIS wrapper
        # (supports_native_explainability is forced False above), but left
        # in place in case anything else legitimately needs the raw
        # estimator (e.g. debugging, future callers).
        if name == "_model":
            return getattr(self._inner, "_model", None)
        raise AttributeError(name)


def compute_group_mean_adjustments(
    model: ScoringModel,
    records: list[dict],
    group_field: str = "college_tier",
    blend: float = 0.5,
) -> tuple[dict[str, float], dict]:
    """
    Compute additive score adjustments that move each group's mean halfway
    toward the global mean (blend=0.5 by default).

    Returns (adjustments, meta). `meta` discloses how many candidates were
    actually scorable, so a record that's missing a required feature (or an
    external model call that fails) is never silently absorbed without a
    trace — it's dropped from the mean calculation and counted, not allowed
    to abort mitigation for the whole batch.

    Scores via model.score_batch(), not model.score() per record: every
    ScoringModel implementation already isolates per-candidate failures
    there (missing required features, external HTTP timeouts, malformed
    responses — see ScoringModel.score_batch's docstring in
    interface/model_interface.py). Calling score() directly per-record, as
    this function previously did, bypassed that protection, so a single
    record missing a required feature (a routine, expected occurrence —
    orchestration/graph.py's node_score already anticipates and excludes
    such records from Hiring Agent scoring) would raise and abort
    mitigation for every other candidate in the batch too.
    """
    from interface.model_interface import candidate_from_record

    candidates_by_tier: dict[str, list] = {}
    n_total = 0
    for record in records:
        candidate = candidate_from_record(record)
        tier = str(candidate.features.get(group_field, ""))
        if not tier:
            continue
        candidates_by_tier.setdefault(tier, []).append(candidate)
        n_total += 1

    if not candidates_by_tier:
        raise ValueError(
            f"Mitigation requires '{group_field}' on records; none found."
        )

    tier_scores: dict[str, list[float]] = {}
    n_scoring_errors = 0
    groups_dropped: list[str] = []
    for tier, candidates in candidates_by_tier.items():
        results = model.score_batch(candidates)
        scored = [r.score for r in results if r.score is not None]
        n_scoring_errors += len(results) - len(scored)
        if scored:
            tier_scores[tier] = scored
        else:
            groups_dropped.append(tier)

    if not tier_scores:
        raise ValueError(
            "Mitigation requires at least one scorable candidate per group; "
            f"every candidate failed to score ({n_scoring_errors} scoring "
            f"error(s) out of {n_total} total)."
        )

    all_scores = [score for scores in tier_scores.values() for score in scores]
    global_mean = sum(all_scores) / len(all_scores)

    adjustments = {
        tier: (global_mean - (sum(scores) / len(scores))) * blend
        for tier, scores in tier_scores.items()
    }
    meta = {
        "n_total_candidates": n_total,
        "n_candidates_used": n_total - n_scoring_errors,
        "n_scoring_errors": n_scoring_errors,
        "groups_dropped": groups_dropped,
    }
    return adjustments, meta