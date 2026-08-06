"""
Model Interface — the standard contract the Audit Agent expects from ANY
model it audits, whether that's Checksum's own Hiring Agent or an external
third-party model.

Design principle: the Audit Agent must never import or depend on
hiring_agent.py directly. It only ever talks to something that satisfies
ScoringModel. The Hiring Agent is just the reference implementation.
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class ExplainabilityMethod(str, Enum):
    NATIVE_SHAP = "native_shap"          # model exposes true SHAP values
    KERNEL_SHAP_APPROX = "kernel_shap_approx"  # model-agnostic approximation
    NONE = "none"                        # no feature importance available at all


@dataclass
class Candidate:
    """
    A single standardized candidate record, already cleaned by the pipeline
    (translation layer + inference layer already applied). Field values are
    keyed by canonical field name (see pipeline/translation_layer.py).

    `available_fields` tracks which of the canonical bias-test fields are
    actually present/inferred vs missing for THIS candidate, per the
    "never guess, always disclose" rule.
    """
    candidate_id: str
    features: dict                                   # canonical_field_name -> value
    field_status: dict = field(default_factory=dict)  # canonical_field_name -> "present" | "inferred" | "missing"

    def with_perturbed_field(self, field_name: str, new_value) -> "Candidate":
        """Return a new Candidate with one field changed, everything else identical.
        This is the core primitive the perturbation test is built on."""
        new_features = dict(self.features)
        new_features[field_name] = new_value
        return Candidate(
            candidate_id=self.candidate_id,
            features=new_features,
            field_status=dict(self.field_status),
        )


@dataclass
class ScoreResult:
    """
    What ANY model — own or external — must return for a single candidate.
    `feature_importances` is optional: if the model can't provide it,
    the Audit Agent falls back to KernelSHAP (model-agnostic, query-only).

    `score` is Optional: a model implementation may fail to score an
    individual candidate (external HTTP timeout/500, malformed value, etc.)
    without that failure being allowed to take down the rest of the batch -
    see ScoringModel.score_batch below. A None score always means "this
    candidate could not be scored", never "scored zero".
    """
    candidate_id: str
    score: Optional[float]
    decision: Optional[str] = None                 # e.g. "Shortlisted" / "Rejected"
    feature_importances: Optional[dict] = None      # canonical_field_name -> importance weight
    explainability_method: ExplainabilityMethod = ExplainabilityMethod.NONE
    raw_output: Optional[dict] = None               # passthrough for anything model-specific
    error: Optional[str] = None                     # set when score is None because scoring failed


def candidate_from_record(record: dict) -> "Candidate":
    """
    Bridge between the pipeline's output (plain dicts, one per candidate,
    produced by pipeline/ingestion.py) and the Candidate object every
    ScoringModel expects. Added when wiring ingestion -> orchestration
    together, since the pipeline was built independently of this interface.

    Uses the record's `_inference_meta` block (set by
    pipeline/inference_layer.py) to mark inferred fields as "inferred"
    rather than "present", per the plan's "never silently guess" rule.
    """
    record = dict(record)
    candidate_id = str(record.pop("candidate_id", ""))
    inference_meta = record.pop("_inference_meta", {}) or {}

    features: dict = {}
    field_status: dict = {}
    for key, value in record.items():
        features[key] = value
        meta = inference_meta.get(key)
        if meta and meta.get("is_inferred"):
            field_status[key] = "inferred"
        elif value is None or value == "":
            field_status[key] = "missing"
        else:
            field_status[key] = "present"

    return Candidate(candidate_id=candidate_id, features=features, field_status=field_status)


class ScoringModel(ABC):
    """
    The contract. Any model — Checksum's own Hiring Agent, or an adapter
    wrapping a third-party model/API — implements this.

    The Audit Agent (agents/audit_agent.py) is written ONLY against this
    interface. It never knows or cares whether it's talking to our own
    model or someone else's.
    """

    @abstractmethod
    def score(self, candidate: Candidate) -> ScoreResult:
        """Score a single candidate. Must be safe to call repeatedly with
        perturbed versions of the same candidate (idempotent, no side effects
        that would make re-scoring an edited candidate behave differently)."""
        raise NotImplementedError

    def score_batch(self, candidates: list[Candidate]) -> list[ScoreResult]:
        """
        Default naive implementation; override for real batching/perf (e.g.
        HiringAgent vectorizes via XGBoost). This default is deliberately
        defensive: it calls self.score() per candidate and, per the "one bad
        record must not take down the batch" principle applied throughout
        the pipeline (see pipeline/ingestion.py, orchestration/graph.py),
        catches any exception from an individual candidate and returns a
        ScoreResult(score=None, error=...) for that one instead of letting
        it propagate and abort every other candidate in the batch. This is
        what makes external, network-backed models (interface/
        external_model_adapter.py) safe to audit at scale: one timeout or
        malformed response degrades gracefully instead of failing the job.
        """
        results: list[ScoreResult] = []
        for candidate in candidates:
            try:
                results.append(self.score(candidate))
            except Exception as exc:  # noqa: BLE001 - any model-specific failure
                results.append(ScoreResult(
                    candidate_id=candidate.candidate_id,
                    score=None,
                    decision="Not scored - model error",
                    feature_importances=None,
                    explainability_method=ExplainabilityMethod.NONE,
                    raw_output=None,
                    error=str(exc),
                ))
        return results

    @property
    def feature_columns(self) -> list[str]:
        """Canonical feature names this model expects for scoring and SHAP."""
        return []

    @property
    def skill_fields(self) -> list[str]:
        """Features treated as skill signals in skill-vs-pedigree analysis."""
        return []

    @property
    def pedigree_fields(self) -> list[str]:
        """Features treated as pedigree/proxy signals in skill-vs-pedigree analysis."""
        return []

    @property
    def supports_native_explainability(self) -> bool:
        """Whether this model can return feature_importances natively.
        If False, the Audit Agent will use KernelSHAP instead (slower,
        approximate, query-access-only)."""
        return False

    @property
    def model_source(self) -> str:
        """'checksum_hiring_agent' or an identifier for the external model.
        Flows straight into output JSON (Section 9 of the plan)."""
        return "unknown"
