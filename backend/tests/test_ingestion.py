"""Unit tests for pipeline ingestion."""

from __future__ import annotations

from pathlib import Path

from pipeline.ingestion import ingest

FIXTURES = Path(__file__).parent / "fixtures"


def test_ingest_assigns_candidate_ids():
    result = ingest(str(FIXTURES / "sample_candidates.csv"))
    assert len(result.records) == 10
    for record in result.records:
        assert record.get("candidate_id")


def test_ingest_decisions_only_no_model_access():
    result = ingest(
        str(FIXTURES / "sample_decisions_only.csv"),
        model_access_available=False,
    )
    assert result.availability is not None
    assert result.availability.audit_mode == "statistical_only"
    assert len(result.records) == 10


def test_ingest_derives_engineered_features_from_realistic_csv():
    """
    Regression test: a normal recruitment CSV won't ship pre-computed
    is_metro / career_gap_months / screening_score columns the way the demo
    fixtures do. This fixture instead has raw city / graduation-year /
    experience / component-score columns and confirms pipeline.
    feature_engineering derives all three, each tagged as inferred with a
    method and confidence rather than silently fabricated or left to crash
    downstream scoring.
    """
    result = ingest(str(FIXTURES / "realistic_recruitment_no_engineered_fields.csv"))
    assert len(result.records) == 5

    for record in result.records:
        assert record.get("is_metro") in (0, 1)
        assert record.get("career_gap_months") is not None
        assert record.get("screening_score") is not None

        meta = record["_inference_meta"]
        assert meta["is_metro"]["is_inferred"] is True
        assert meta["is_metro"]["inference_method"] == "city_metro_lookup"
        assert meta["career_gap_months"]["is_inferred"] is True
        assert meta["screening_score"]["is_inferred"] is True
        assert meta["screening_score"]["inference_method"] == "composite_component_average"

    # college_tier has no raw signal to derive it from in this fixture (no
    # college-ranking heuristic is implemented, by design) - it must be
    # reported as genuinely missing, never fabricated.
    availability = result.availability.as_dict()
    assert availability["fields"]["college_tier"]["missing"] == 5
