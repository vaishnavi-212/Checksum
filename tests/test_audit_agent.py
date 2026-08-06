"""Unit tests for AuditAgent perturbation and SHAP on the reference model."""

from __future__ import annotations

import pytest

from agents.audit_agent import AuditAgent
from core.model_registry import get_hiring_agent, reset_hiring_agent_cache
from interface.model_interface import candidate_from_record


@pytest.fixture(autouse=True)
def reset_model():
    reset_hiring_agent_cache()
    yield
    reset_hiring_agent_cache()


SAMPLE_RECORD = {
    "candidate_id": "T001",
    "screening_score": 85,
    "college_tier": 1,
    "is_metro": 1,
    "career_gap_months": 0,
    "experience_years": 5,
}


def test_perturbation_suite_runs():
    agent = AuditAgent(model=get_hiring_agent())
    results = agent.run_perturbation_suite([SAMPLE_RECORD] * 5)
    assert isinstance(results, list)
    assert len(results) >= 1
    assert "field_tested" in results[0]


def test_shap_summary_native():
    agent = AuditAgent(model=get_hiring_agent())
    summary = agent.run_shap_summary([SAMPLE_RECORD] * 5)
    assert summary.get("method") == "native_shap"
    assert "skill_reliance_pct" in summary
    assert "pedigree_reliance_pct" in summary


def test_apply_mitigation_returns_wrapper():
    model = get_hiring_agent()
    agent = AuditAgent(model=model)
    records = [SAMPLE_RECORD] * 10
    mitigated = agent.apply_mitigation(model, records)
    candidate = candidate_from_record(SAMPLE_RECORD)
    before = model.score(candidate).score
    after = mitigated.score(candidate).score
    assert isinstance(after, float)


def test_apply_mitigation_survives_candidate_missing_required_feature():
    """
    Regression test: compute_group_mean_adjustments (interface/mitigated_model.py)
    previously called model.score() directly per record with no error
    handling. A single record missing a required HiringAgent feature (a
    routine, expected occurrence - orchestration/graph.py's node_score
    already anticipates and excludes exactly this case from normal scoring)
    raised and aborted mitigation for the ENTIRE batch, not just that one
    candidate.
    """
    model = get_hiring_agent()
    agent = AuditAgent(model=model)

    good_records = [{**SAMPLE_RECORD, "candidate_id": f"OK{i}"} for i in range(6)]
    bad_record = {"candidate_id": "BAD1", "college_tier": 1}  # missing screening_score etc.
    records = good_records + [bad_record]

    # Must not raise.
    mitigated = agent.apply_mitigation(model, records)

    meta = mitigated.mitigation_meta
    assert meta["n_total_candidates"] == 7
    assert meta["n_scoring_errors"] == 1
    assert meta["n_candidates_used"] == 6

    # The wrapper must still be a fully usable model afterwards.
    candidate = candidate_from_record(SAMPLE_RECORD)
    after = mitigated.score(candidate).score
    assert isinstance(after, float)


def test_apply_mitigation_raises_clearly_if_nothing_is_scorable():
    """
    Non-regression check for the total-failure path: if literally every
    candidate fails to score, apply_mitigation should still raise (so
    node_fix's existing try/except reports fix_applied=False), not return
    a wrapper built from zero data.
    """
    model = get_hiring_agent()
    agent = AuditAgent(model=model)
    records = [{"candidate_id": "BAD1", "college_tier": 1}]  # missing all other required fields

    with pytest.raises(ValueError):
        agent.apply_mitigation(model, records)


class _FlakyModel:
    """Simulates an external model (Path 2a) that fails intermittently -
    e.g. a timeout or a malformed response on some calls but not others."""

    model_source = "external:flaky"
    feature_columns = ["screening_score", "college_tier", "is_metro"]
    skill_fields = ["screening_score"]
    pedigree_fields = ["college_tier", "is_metro"]
    supports_native_explainability = False

    def __init__(self, fail_every: int = 4):
        self._calls = 0
        self._fail_every = fail_every

    def score(self, candidate):
        from interface.model_interface import ScoreResult

        self._calls += 1
        if self._calls % self._fail_every == 0:
            raise TimeoutError("simulated external model timeout")
        value = float(candidate.features.get("screening_score", 50))
        return ScoreResult(candidate_id=candidate.candidate_id, score=value, decision="Shortlisted")

    def score_batch(self, candidates):
        from interface.model_interface import ScoreResult

        results = []
        for c in candidates:
            try:
                results.append(self.score(c))
            except Exception as exc:  # noqa: BLE001
                results.append(ScoreResult(candidate_id=c.candidate_id, score=None, error=str(exc)))
        return results


def test_kernel_shap_survives_intermittent_model_failures():
    """
    Regression test: _kernel_shap_split's predict_fn previously called
    self.model.score(candidate).score directly with no error handling and
    no None-guard. Even though the surrounding try/except in
    _kernel_shap_split prevented a full job crash, ONE failed call among
    the many KernelSHAP makes internally discarded the ENTIRE explainability
    result (method='unavailable'), even when most calls succeeded. It must
    now degrade proportionally instead: complete the computation and
    disclose how many underlying calls failed.
    """
    records = [
        {
            "candidate_id": f"C{i}",
            "screening_score": 50 + i,
            "college_tier": (i % 3) + 1,
            "is_metro": i % 2,
        }
        for i in range(20)
    ]
    model = _FlakyModel(fail_every=4)
    agent = AuditAgent(model=model)

    summary = agent.run_shap_summary(
        records,
        feature_cols=model.feature_columns,
        skill_fields=model.skill_fields,
        pedigree_fields=model.pedigree_fields,
    )

    assert summary["method"] == "kernel_shap_approx"
    assert summary.get("n_model_scoring_errors", 0) > 0
    assert "skill_reliance_pct" in summary
    assert "pedigree_reliance_pct" in summary
