"""
Wraps a third-party model (accessed via HTTP API, or any callable) so it
satisfies the ScoringModel contract, without the Audit Agent needing to
know anything about how that model actually works internally.

This is what makes Tier 2 (external model, access provided) possible: the
user supplies an endpoint + how to map fields, and this adapter does the
rest.
"""

from __future__ import annotations
from typing import Callable, Optional
import requests

from interface.model_interface import (
    Candidate,
    ScoreResult,
    ScoringModel,
    ExplainabilityMethod,
)


from core.security import validate_external_model_url


class ExternalHTTPModelAdapter(ScoringModel):
    """
    Wraps an external model that's reachable over HTTP.

    Expects the external endpoint to accept a JSON body of candidate
    features and return at least a score. feature_importances are read
    if present; if absent, supports_native_explainability is False and
    the Audit Agent should fall back to KernelSHAP.
    """

    def __init__(
        self,
        endpoint_url: str,
        model_name: str = "external_model",
        headers: Optional[dict] = None,
        response_field_map: Optional[dict] = None,
        timeout_seconds: float = 10.0,
        feature_columns: Optional[list[str]] = None,
        skill_fields: Optional[list[str]] = None,
        pedigree_fields: Optional[list[str]] = None,
    ):
        self.endpoint_url = validate_external_model_url(endpoint_url)
        self._model_name = model_name
        self.headers = headers or {}
        self.response_field_map = response_field_map or {
            "score": "score",
            "decision": "decision",
            "feature_importances": "feature_importances",
        }
        self.timeout_seconds = timeout_seconds
        self._native_explainability_checked = False
        self._native_explainability_available = False
        self._feature_columns = feature_columns or []
        self._skill_fields = skill_fields or []
        self._pedigree_fields = pedigree_fields or []

    def score(self, candidate: Candidate) -> ScoreResult:
        response = requests.post(
            self.endpoint_url,
            json={"candidate": candidate.features, "candidate_id": candidate.candidate_id},
            headers=self.headers,
            timeout=self.timeout_seconds,
        )
        response.raise_for_status()
        body = response.json()

        score_key = self.response_field_map["score"]
        decision_key = self.response_field_map["decision"]
        fi_key = self.response_field_map["feature_importances"]

        feature_importances = body.get(fi_key)
        method = (
            ExplainabilityMethod.NATIVE_SHAP
            if feature_importances
            else ExplainabilityMethod.NONE
        )
        self._native_explainability_checked = True
        self._native_explainability_available = feature_importances is not None

        return ScoreResult(
            candidate_id=candidate.candidate_id,
            score=float(body[score_key]),
            decision=body.get(decision_key),
            feature_importances=feature_importances,
            explainability_method=method,
            raw_output=body,
        )

    @property
    def supports_native_explainability(self) -> bool:
        # Best known answer before first call; refined after scoring starts.
        return self._native_explainability_available if self._native_explainability_checked else False

    @property
    def model_source(self) -> str:
        return f"external:{self._model_name}"

    @property
    def feature_columns(self) -> list[str]:
        return list(self._feature_columns)

    @property
    def skill_fields(self) -> list[str]:
        return list(self._skill_fields)

    @property
    def pedigree_fields(self) -> list[str]:
        return list(self._pedigree_fields)


# orchestration/graph.py (from the missing-pieces handoff) refers to this
# class as `ExternalModelAdapter`. Keep both names pointing at the same
# implementation rather than duplicating code or renaming the class the
# rest of this file already tested against.
ExternalModelAdapter = ExternalHTTPModelAdapter


class CallableModelAdapter(ScoringModel):
    """
    Lighter-weight adapter for in-process external models (e.g. a second
    model loaded in the same Python process, or a local function) — used
    for the external-model demo case (build step 9) where we don't need a
    real HTTP round trip.
    """

    def __init__(
        self,
        score_fn: Callable[[dict], dict],
        model_name: str,
        has_native_explainability: bool = False,
        feature_columns: Optional[list[str]] = None,
        skill_fields: Optional[list[str]] = None,
        pedigree_fields: Optional[list[str]] = None,
    ):
        self.score_fn = score_fn
        self._model_name = model_name
        self._has_native_explainability = has_native_explainability
        self._feature_columns = feature_columns or []
        self._skill_fields = skill_fields or []
        self._pedigree_fields = pedigree_fields or []

    def score(self, candidate: Candidate) -> ScoreResult:
        result = self.score_fn(candidate.features)
        feature_importances = result.get("feature_importances")
        method = (
            ExplainabilityMethod.NATIVE_SHAP
            if (self._has_native_explainability and feature_importances)
            else ExplainabilityMethod.NONE
        )
        return ScoreResult(
            candidate_id=candidate.candidate_id,
            score=float(result["score"]),
            decision=result.get("decision"),
            feature_importances=feature_importances,
            explainability_method=method,
            raw_output=result,
        )

    @property
    def supports_native_explainability(self) -> bool:
        return self._has_native_explainability

    @property
    def model_source(self) -> str:
        return f"external:{self._model_name}"

    @property
    def feature_columns(self) -> list[str]:
        return list(self._feature_columns)

    @property
    def skill_fields(self) -> list[str]:
        return list(self._skill_fields)

    @property
    def pedigree_fields(self) -> list[str]:
        return list(self._pedigree_fields)
