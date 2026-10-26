"""
Wraps a third-party model (accessed via HTTP API, or any callable) so it
satisfies the ScoringModel contract, without the Audit Agent needing to
know anything about how that model actually works internally.

This is what makes Tier 2 (external model, access provided) possible: the
user supplies an endpoint + how to map fields, and this adapter does the
rest.
"""

from __future__ import annotations

import math
import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Optional

import requests

from core.security import validate_external_model_url
from interface.model_interface import (
    Candidate,
    ExplainabilityMethod,
    ScoreResult,
    ScoringModel,
)

EXTERNAL_MAX_WORKERS = int(os.environ.get("CHECKSUM_EXTERNAL_MAX_WORKERS", "8"))
# Re-run the SSRF check (including a fresh DNS lookup) at most this often, so
# a hostname that later starts resolving to an internal address is caught.
REVALIDATE_SECONDS = float(os.environ.get("CHECKSUM_EXTERNAL_REVALIDATE_SECONDS", "60"))


class ExternalHTTPModelAdapter(ScoringModel):
    """
    Wraps an external model that's reachable over HTTP.

    Expects the external endpoint to accept a JSON body of candidate
    features and return at least a numeric score on a 0-100 scale.
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
        self._validated_at = time.monotonic()
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

    def _revalidate_if_stale(self) -> None:
        if time.monotonic() - self._validated_at > REVALIDATE_SECONDS:
            validate_external_model_url(self.endpoint_url)
            self._validated_at = time.monotonic()

    def score(self, candidate: Candidate) -> ScoreResult:
        self._revalidate_if_stale()
        response = requests.post(
            self.endpoint_url,
            json={"candidate": candidate.features, "candidate_id": candidate.candidate_id},
            headers=self.headers,
            timeout=self.timeout_seconds,
            # Never follow redirects: a redirect could point at an internal
            # address that the SSRF check above never saw.
            allow_redirects=False,
        )
        if 300 <= response.status_code < 400:
            raise ValueError(
                f"External model responded with a redirect ({response.status_code}); "
                f"redirects are not followed. Use the final URL directly."
            )
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, dict):
            raise ValueError("External model response must be a JSON object.")

        score_key = self.response_field_map["score"]
        decision_key = self.response_field_map["decision"]
        fi_key = self.response_field_map["feature_importances"]

        try:
            score = float(body[score_key])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"External model response has no numeric '{score_key}'.") from exc
        if math.isnan(score) or not 0.0 <= score <= 100.0:
            raise ValueError(f"External model score {score} is outside the expected 0-100 range.")

        feature_importances = body.get(fi_key)
        method = ExplainabilityMethod.NATIVE_SHAP if feature_importances else ExplainabilityMethod.NONE
        self._native_explainability_checked = True
        self._native_explainability_available = feature_importances is not None

        return ScoreResult(
            candidate_id=candidate.candidate_id,
            score=score,
            decision=body.get(decision_key),
            feature_importances=feature_importances,
            explainability_method=method,
            raw_output=body,
        )

    def score_batch(self, candidates: list[Candidate]) -> list[ScoreResult]:
        """Score in parallel (CHECKSUM_EXTERNAL_MAX_WORKERS threads), keeping
        input order and isolating per-candidate failures like the base class."""
        if len(candidates) <= 1 or EXTERNAL_MAX_WORKERS <= 1:
            return super().score_batch(candidates)
        with ThreadPoolExecutor(max_workers=EXTERNAL_MAX_WORKERS) as pool:
            return list(pool.map(lambda c: super(ExternalHTTPModelAdapter, self).score_batch([c])[0], candidates))

    @property
    def supports_native_explainability(self) -> bool:
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


# orchestration/graph.py refers to this class as `ExternalModelAdapter`.
ExternalModelAdapter = ExternalHTTPModelAdapter


class CallableModelAdapter(ScoringModel):
    """
    Lighter-weight adapter for in-process external models (e.g. a second
    model loaded in the same Python process, or a local function) — used
    for the external-model demo case where we don't need a real HTTP round trip.
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
