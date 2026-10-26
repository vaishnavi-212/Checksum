"""Regression tests for the audit-correctness fixes (perturbation direction,
grouping, small groups, matched-pair coverage, mitigation measurement, SSRF)."""

from __future__ import annotations

import random
from urllib.parse import urlparse

import pytest

from agents.audit_agent import AuditAgent
from agents.fairness_stats import cmh_test, group_label, holm_adjust
from core.model_registry import get_hiring_agent, reset_hiring_agent_cache
from interface.model_interface import ScoreResult


@pytest.fixture(autouse=True)
def reset_model():
    reset_hiring_agent_cache()
    yield
    reset_hiring_agent_cache()


def _decisions(n=400, seed=0, tier3_penalty=0.0):
    rng = random.Random(seed)
    rows = []
    for i in range(n):
        tier = rng.choice([1, 2, 3])
        score = rng.gauss(68, 12)
        selected = score - (tier3_penalty if tier == 3 else 0) + rng.gauss(0, 6) > 70
        rows.append({
            "candidate_id": f"C{i}",
            "age": rng.randint(21, 45),
            "gender": rng.choice(["male", "female"]),
            "college_tier": tier,
            "is_metro": rng.randint(0, 1),
            "career_gap_months": rng.choice([0, 0, 3, 6, 12, 18]),
            "screening_score": round(score, 1),
            "shortlisted": "yes" if selected else "no",
        })
    return rows


# --- grouping -----------------------------------------------------------

def test_continuous_fields_are_binned_and_categories_normalized():
    assert group_label("age", 23) == "under 25"
    assert group_label("age", "37") == "35-44"
    assert group_label("career_gap_months", 0) == "no gap"
    assert group_label("career_gap_months", 18) == "over 12 months"
    assert group_label("college_tier", "1.0") == group_label("college_tier", 1) == "1"
    assert group_label("gender", "Male") == "male"
    assert group_label("college_tier", "") is None


def test_age_is_not_split_into_one_group_per_year():
    result = AuditAgent(model=None).run_statistical_audit(_decisions(), group_field="age")
    assert result["n_groups"] <= 4


# --- small groups / zero selections -------------------------------------

def test_four_fifths_ignores_tiny_groups():
    result = AuditAgent.four_fifths_rule(
        {"big": 0.4, "tiny": 1.0}, group_sizes={"big": 200, "tiny": 1}, min_group_size=30
    )
    assert result["flag"] is False
    assert result["insufficient_sample_groups"] == ["tiny"]


def test_four_fifths_does_not_flag_when_nobody_selected():
    result = AuditAgent.four_fifths_rule({"a": 0.0, "b": 0.0})
    assert result["flag"] is False
    assert "No candidates were selected" in result["note"]


def test_no_bias_data_raises_no_flags():
    result = AuditAgent(model=None).run_multi_field_statistical_audit(_decisions(seed=1))
    assert result["fields_flagged"] == []


def test_real_tier_bias_is_caught_by_all_three_tests():
    result = AuditAgent(model=None).run_multi_field_statistical_audit(_decisions(seed=2, tier3_penalty=12))
    assert result["fields_flagged"] == ["college_tier"]
    assert "3" in result["four_fifths_rule"]["flagged_groups"]
    assert result["demographic_parity"]["flag"] is True
    mp = result["matched_pair"]
    assert mp["flag"] is True and mp["comparison_group"] == "3"


# --- matched pair -------------------------------------------------------

def test_matched_pair_compares_every_group_with_reference():
    result = AuditAgent.simplified_matched_pair(_decisions(seed=3, tier3_penalty=12))
    compared = {c["comparison_group"] for c in result["comparisons"]}
    assert compared == {"1", "2", "3"} - {result["reference_group"]}


def test_cmh_and_holm_helpers():
    assert cmh_test([])["p_value"] == 1.0
    strong = cmh_test([[[30, 5], [5, 30]], [[25, 10], [8, 27]]])
    assert strong["p_value"] < 1e-6 and strong["common_odds_ratio"] > 1
    assert holm_adjust([0.01, 0.04, 0.03]) == pytest.approx([0.03, 0.06, 0.06])


# --- perturbation -------------------------------------------------------

def _path1_records(n=150, seed=4):
    rng = random.Random(seed)
    return [{
        "candidate_id": f"P{i}",
        "gender": rng.choice(["male", "female"]),
        "age": rng.randint(22, 45),
        "screening_score": rng.uniform(50, 95),
        "college_tier": str(rng.choice([1, 2, 3])),
        "is_metro": rng.randint(0, 1),
        "career_gap_months": rng.choice([0, 0, 6, 12]),
        "experience_years": rng.randint(0, 10),
    } for i in range(n)]


def test_perturbation_moves_groups_into_most_favoured_group():
    results = AuditAgent(model=get_hiring_agent()).run_perturbation_suite(_path1_records())
    tier = next(r for r in results if r["field_tested"] == "college_tier")
    assert tier["status"] == "tested"
    assert tier["to_group"] == "1" and tier["from_group"] in {"2", "3"}
    assert tier["avg_delta_pts"] > 20 and tier["severity"] == "HIGH"
    assert {c["from_group"] for c in tier["comparisons"]} == {"2", "3"}


def test_result_does_not_depend_on_row_order():
    records = _path1_records()
    a = AuditAgent(model=get_hiring_agent()).run_perturbation_suite(records)
    b = AuditAgent(model=get_hiring_agent()).run_perturbation_suite(list(reversed(records)))
    pick = lambda rs: next(r for r in rs if r["field_tested"] == "college_tier")  # noqa: E731
    assert pick(a)["comparison_label"] == pick(b)["comparison_label"]
    assert pick(a)["avg_delta_pts"] == pytest.approx(pick(b)["avg_delta_pts"])


def test_fields_the_model_does_not_use_are_reported_not_tested():
    results = AuditAgent(model=get_hiring_agent()).run_perturbation_suite(_path1_records())
    status = {r["field_tested"]: r["status"] for r in results}
    assert status["gender"] == "not_model_input"
    assert status["age"] == "not_model_input"


class _CountingModel:
    model_source = "external:counting"
    feature_columns: list = []
    skill_fields: list = []
    pedigree_fields: list = []
    supports_native_explainability = False

    def __init__(self):
        self.calls = 0

    def score(self, candidate):
        self.calls += 1
        tier = str(candidate.features.get("college_tier"))
        return ScoreResult(candidate_id=candidate.candidate_id, score=80.0 if tier == "1" else 40.0)

    def score_batch(self, candidates):
        return [self.score(c) for c in candidates]


def test_original_scores_are_computed_once_not_once_per_field():
    records = [{"candidate_id": f"X{i}", "college_tier": str(1 + i % 3), "is_metro": i % 2}
               for i in range(30)]
    model = _CountingModel()
    AuditAgent(model=model).run_perturbation_suite(records, fields=["college_tier", "is_metro"])
    # 30 originals + 20 non-reference tier candidates + 15 non-reference metro candidates
    assert model.calls == 30 + 20 + 15


# --- mitigation ---------------------------------------------------------

def test_fix_measures_before_and_after_the_same_way():
    from orchestration.graph import node_fix, node_audit_full

    records = _path1_records(120)
    state = {"path": "1", "records": records, "audit_mode": "perturbation"}
    state.update(node_audit_full(state))
    fb = node_fix(state)["fix_before_after"]
    assert fb["measurement_method"] == "kernel_shap_approx"
    assert fb["before_summary"]["method"] == fb["after_summary"]["method"]
    assert set(fb["shortlist_rates_before"]) == set(fb["shortlist_rates_after"])
    assert fb["group_field"] == "college_tier"


# --- SSRF allowlist -----------------------------------------------------

@pytest.mark.parametrize("url,entry,allowed", [
    ("https://api.vendor.com.attacker.net/score", "https://api.vendor.com", False),
    ("https://api.vendor.com/score", "https://api.vendor.com", True),
    ("https://api.vendor.com/v10/score", "https://api.vendor.com/v1", False),
    ("http://api.vendor.com/score", "https://api.vendor.com", False),
])
def test_allowlist_matches_host_exactly(url, entry, allowed):
    from core.security import _matches_allowlist_entry

    assert _matches_allowlist_entry(urlparse(url), entry) is allowed


def test_external_adapter_never_follows_redirects(monkeypatch):
    import interface.external_model_adapter as ema
    from interface.model_interface import Candidate

    seen = {}

    class _Redirect:
        status_code = 302

        def raise_for_status(self):
            pass

        def json(self):
            return {}

    def fake_post(*args, **kwargs):
        seen.update(kwargs)
        return _Redirect()

    monkeypatch.setattr(ema, "validate_external_model_url", lambda url: url)
    monkeypatch.setattr(ema.requests, "post", fake_post)
    adapter = ema.ExternalHTTPModelAdapter("https://vendor.test/score")
    result = adapter.score_batch([Candidate(candidate_id="c", features={})])[0]
    assert seen["allow_redirects"] is False
    assert result.score is None and "redirect" in result.error
