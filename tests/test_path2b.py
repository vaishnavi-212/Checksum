"""Unit tests for AuditAgent Tier 3 statistics and Path 2b scoring helpers."""

from __future__ import annotations

import json

from orchestration.graph import _scores_from_uploaded_decisions
from agents.audit_agent import AuditAgent


def test_path2b_scores_from_decisions_only():
    records = [
        {"candidate_id": "C1", "shortlisted": "1", "screening_score": 85},
        {"candidate_id": "C2", "shortlisted": "0"},
        {"candidate_id": "C3", "shortlisted": "yes", "screening_score": 72},
    ]
    scores = _scores_from_uploaded_decisions(records)
    assert len(scores) == 3
    assert scores[0]["decision"] == "Shortlisted"
    assert scores[0]["score"] == 85.0
    assert scores[1]["decision"] == "Not Shortlisted"
    assert scores[1]["score"] == 0.0


def test_four_fifths_rule_flags_adverse_impact():
    rates = {"1": 0.8, "3": 0.2}
    result = AuditAgent.four_fifths_rule(rates)
    assert result["flag"] is True
    assert "3" in result["flagged_groups"]


def test_demographic_parity():
    rates = {"1": 0.8, "3": 0.2}
    result = AuditAgent.demographic_parity(rates, threshold=0.15)
    assert result["flag"] is True
    assert result["difference"] == 0.6


def test_simplified_matched_pair():
    records = [
        {"candidate_id": "A1", "college_tier": "1", "shortlisted": "1", "screening_score": 80},
        {"candidate_id": "A2", "college_tier": "1", "shortlisted": "1", "screening_score": 82},
        {"candidate_id": "B1", "college_tier": "3", "shortlisted": "0", "screening_score": 81},
        {"candidate_id": "B2", "college_tier": "3", "shortlisted": "0", "screening_score": 83},
    ]
    result = AuditAgent.simplified_matched_pair(records)
    assert result["method"] == "simplified_matched_pair"
    assert "p_value" in result


def test_simplified_matched_pair_flag_is_json_serializable():
    """
    Regression test for a numpy.bool_ serialization bug: with only 4 records
    (as in test_simplified_matched_pair above) scipy.stats.fisher_exact hits
    an edge case (p == 1.0) and happens to return a plain Python float, so
    `p_value < 0.05` produces a plain bool and the bug stayed hidden. With a
    larger, more realistic sample the p-value lands away from 0/1, scipy
    returns numpy.float64, and an un-cast comparison produces numpy.bool_,
    which json.dumps (and FastAPI/pydantic) cannot serialize. This test
    forces that non-degenerate path so the regression can't reappear silently.
    """
    records = []
    for i in range(6):
        records.append({
            "college_tier": "tier_1",
            "shortlisted": "yes" if i < 5 else "no",
            "screening_score": 70,
        })
    for i in range(6):
        records.append({
            "college_tier": "tier_3",
            "shortlisted": "yes" if i < 2 else "no",
            "screening_score": 71,
        })

    result = AuditAgent.simplified_matched_pair(records)
    assert isinstance(result["flag"], bool), (
        f"'flag' must be a native bool, got {type(result['flag'])}"
    )
    json.dumps(result)  # raises TypeError if any value is a numpy scalar


def test_run_statistical_audit_reports_missing_column_explicitly():
    """
    Whole-column-missing regression test: previously, if college_tier (or
    any group_field) was absent from every record, run_statistical_audit
    silently returned an empty-but-well-formed-looking report (n_groups: 0,
    selection_rates: {}) instead of telling the user their upload is
    missing a required column.
    """
    records = [
        {"candidate_id": f"C{i}", "shortlisted": "yes" if i % 2 == 0 else "no"}
        for i in range(20)
    ]  # no college_tier anywhere
    agent = AuditAgent(model=None)
    result = agent.run_statistical_audit(records)
    assert "error" in result
    assert "college_tier" in result["error"]
