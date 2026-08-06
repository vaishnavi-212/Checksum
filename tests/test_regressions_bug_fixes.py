"""
Regression tests for five verified bugs found in review:

1. /fix and /perturb always used Checksum's own HiringAgent, silently
   ignoring the actual uploaded ExternalModelAdapter on Path 2a jobs.
2. FixRequest.strategy was accepted by the API but never consulted.
3. (covered in test_audit_agent.py) KernelSHAP discarded its entire result
   the moment a single underlying model call failed.
4. (covered in test_audit_agent.py) /fix crashed entirely if the dataset
   contained even one candidate that node_score had already, correctly,
   excluded from scoring due to a missing required feature.
5. /perturb raised an unhandled exception (bare 500) for a candidate that
   couldn't be scored, instead of a structured 4xx.

Each test names the exact bug it guards against so a future regression is
immediately traceable back to this list.
"""

from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from core.model_registry import reset_hiring_agent_cache
from interface.model_interface import ScoreResult
from main import JOB_STORE, app

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_CSV = FIXTURES / "sample_candidates.csv"
INCOMPLETE_CSV = FIXTURES / "sample_candidates_one_incomplete.csv"


@pytest.fixture(autouse=True)
def clear_job_store_and_model_cache():
    if hasattr(JOB_STORE, "clear"):
        JOB_STORE.clear()
    reset_hiring_agent_cache()
    yield
    if hasattr(JOB_STORE, "clear"):
        JOB_STORE.clear()
    reset_hiring_agent_cache()


@pytest.fixture
def client():
    return TestClient(app)


def _wait_for(client: TestClient, job_id: str, key: str, done_values, timeout_seconds: float = 60.0) -> dict:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        response = client.get(f"/audit/{job_id}/status")
        assert response.status_code == 200
        payload = response.json()
        if payload[key] in done_values:
            return payload
        time.sleep(0.25)
    raise TimeoutError(f"Job {job_id} did not reach {key} in {done_values} within {timeout_seconds}s")


def _wait_for_job(client: TestClient, job_id: str) -> dict:
    return _wait_for(client, job_id, "status", ("done", "failed"))


def _wait_for_fix(client: TestClient, job_id: str) -> dict:
    return _wait_for(client, job_id, "fix_status", ("done", "failed"))


class _FakeExternalModel:
    """Stand-in for interface.external_model_adapter.ExternalHTTPModelAdapter
    used to prove /fix and /perturb resolve the model that actually scored
    the job, without needing a real network call (which core/security.py's
    SSRF guard would block for localhost anyway)."""

    model_source = "external:fake"
    feature_columns = ["screening_score", "college_tier", "is_metro"]
    skill_fields = ["screening_score"]
    pedigree_fields = ["college_tier", "is_metro"]
    supports_native_explainability = False

    def score(self, candidate):
        tier = str(candidate.features.get("college_tier"))
        value = 40.0 if tier == "1" else 80.0
        return ScoreResult(candidate_id=candidate.candidate_id, score=value, decision="Shortlisted")

    def score_batch(self, candidates):
        return [self.score(c) for c in candidates]


# ---------------------------------------------------------------------------
# Bug 1: resolve_scoring_model() — the shared fix
# ---------------------------------------------------------------------------

def test_resolve_scoring_model_returns_hiring_agent_for_path_1():
    from orchestration.graph import resolve_scoring_model

    model = resolve_scoring_model({"path": "1"})
    assert model.model_source == "checksum_hiring_agent"


def test_resolve_scoring_model_returns_external_adapter_for_path_2a(monkeypatch):
    from interface import external_model_adapter as ema_module

    # Avoid a real DNS lookup/network call - core/security.py's SSRF guard
    # is unit-tested separately (test_ssrf_blocks_localhost_external_endpoint).
    monkeypatch.setattr(ema_module, "validate_external_model_url", lambda url: url)

    from orchestration.graph import resolve_scoring_model

    model = resolve_scoring_model(
        {"path": "2a", "external_model_endpoint": "https://fake-model.test/score"}
    )
    assert isinstance(model, ema_module.ExternalHTTPModelAdapter)
    assert model.endpoint_url == "https://fake-model.test/score"


def test_node_fix_uses_resolved_model_not_hardcoded_hiring_agent(monkeypatch):
    """Regression test for Bug 1 (node_fix half): previously node_fix always
    called get_hiring_agent(), even for a Path 2a job scored by an external
    model. It must now go through resolve_scoring_model()."""
    from core import model_registry
    from orchestration import graph as graph_module

    def _boom():
        raise AssertionError("node_fix must not fall back to get_hiring_agent() for a Path 2a job")

    monkeypatch.setattr(model_registry, "get_hiring_agent", _boom)

    resolved_with_paths = []

    def fake_resolve(state):
        resolved_with_paths.append(state.get("path"))
        return _FakeExternalModel()

    monkeypatch.setattr(graph_module, "resolve_scoring_model", fake_resolve)

    state = {
        "path": "2a",
        "external_model_endpoint": "https://fake-model.test/score",
        "audit_mode": "perturbation",
        "shap_summary": {"pedigree_reliance_pct": 50.0},
        "records": [
            {"candidate_id": "X1", "screening_score": 70, "college_tier": 1, "is_metro": 1},
            {"candidate_id": "X2", "screening_score": 60, "college_tier": 2, "is_metro": 0},
        ],
    }

    result = graph_module.node_fix(state)

    assert resolved_with_paths == ["2a"]
    assert result["fix_applied"] is True
    assert result["fix_before_after"]["strategy_applied"] == "group_mean_adjustment"


def test_perturb_endpoint_uses_resolved_model_not_hardcoded_hiring_agent(client, monkeypatch):
    """Regression test for Bug 1 (/perturb half): previously the endpoint
    always called get_hiring_agent(), even for a Path 2a job. Injects a
    finished Path 2a job directly into the job store (bypassing the real
    network call an actual external endpoint would need) and asserts the
    endpoint scores through the resolved (fake) external model instead."""
    from core import model_registry
    from orchestration import graph as graph_module

    def _boom():
        raise AssertionError("/perturb must not fall back to get_hiring_agent() for a Path 2a job")

    monkeypatch.setattr(model_registry, "get_hiring_agent", _boom)

    def fake_resolve(state):
        assert state.get("path") == "2a"
        return _FakeExternalModel()

    monkeypatch.setattr(graph_module, "resolve_scoring_model", fake_resolve)

    job_id = "fake-path-2a-job"
    JOB_STORE.set(
        job_id,
        {
            "status": "done",
            "path": "2a",
            "fix_status": "idle",
            "result": {
                "path": "2a",
                "external_model_endpoint": "https://fake-model.test/score",
                "records": [
                    {"candidate_id": "X1", "college_tier": 3, "screening_score": 70},
                ],
            },
        },
    )

    response = client.post(
        f"/audit/{job_id}/candidate/X1/perturb",
        json={"field": "college_tier", "new_value": 1},
    )

    assert response.status_code == 200
    body = response.json()
    # _FakeExternalModel scores tier "1" as 40.0 and every other tier as 80.0
    assert body["original_score"] == 80.0
    assert body["perturbed_score"] == 40.0
    assert body["delta"] == -40.0


# ---------------------------------------------------------------------------
# Bug 2: FixRequest.strategy was accepted but ignored
# ---------------------------------------------------------------------------

def test_fix_endpoint_rejects_unimplemented_strategy(client):
    with SAMPLE_CSV.open("rb") as handle:
        upload = client.post(
            "/audit/upload",
            files={"file": ("sample_candidates.csv", handle, "text/csv")},
        )
    job_id = upload.json()["job_id"]
    _wait_for_job(client, job_id)

    response = client.post(f"/audit/{job_id}/fix", json={"strategy": "reweight"})

    assert response.status_code == 422
    body = response.json()
    assert body["detail"]["error_code"] == "FIX_STRATEGY_NOT_IMPLEMENTED"

    # And crucially: no background job should have been scheduled.
    status = client.get(f"/audit/{job_id}/status").json()
    assert status["fix_status"] == "idle"


def test_fix_endpoint_auto_strategy_still_works(client):
    """Sanity/non-regression check: the default ('auto') strategy must
    keep working after adding the strategy gate."""
    with SAMPLE_CSV.open("rb") as handle:
        upload = client.post(
            "/audit/upload",
            files={"file": ("sample_candidates.csv", handle, "text/csv")},
        )
    job_id = upload.json()["job_id"]
    _wait_for_job(client, job_id)

    response = client.post(f"/audit/{job_id}/fix", json={})
    assert response.status_code == 200
    assert response.json()["strategy"] == "auto"

    fix_status = _wait_for_fix(client, job_id)
    assert fix_status["fix_status"] == "done", fix_status

    results = client.get(f"/audit/{job_id}/results").json()
    assert results["fix_applied"] is True
    assert results["fix_before_after"]["strategy_applied"] == "group_mean_adjustment"


# ---------------------------------------------------------------------------
# Bug 4 (endpoint-level) + Bug 5: full pipeline through the real API
# ---------------------------------------------------------------------------

def test_fix_endpoint_survives_dataset_with_excluded_candidate(client):
    """Regression test for Bug 4, exercised end-to-end: a dataset with one
    candidate missing a required feature (already excluded from normal
    scoring by node_score) must not crash /fix for the whole job."""
    assert INCOMPLETE_CSV.is_file()
    with INCOMPLETE_CSV.open("rb") as handle:
        upload = client.post(
            "/audit/upload",
            files={"file": ("sample_candidates_one_incomplete.csv", handle, "text/csv")},
        )
    job_id = upload.json()["job_id"]
    status = _wait_for_job(client, job_id)
    assert status["status"] == "done", status.get("error")

    response = client.post(f"/audit/{job_id}/fix", json={})
    assert response.status_code == 200

    fix_status = _wait_for_fix(client, job_id)
    assert fix_status["fix_status"] == "done", fix_status

    results = client.get(f"/audit/{job_id}/results").json()
    assert results["fix_applied"] is True
    meta = results["fix_before_after"]["mitigation_meta"]
    assert meta["n_scoring_errors"] >= 1
    assert meta["n_candidates_used"] >= 1


def test_perturb_endpoint_returns_422_for_candidate_missing_required_feature(client):
    """Regression test for Bug 5: previously agent.score() was called with
    no exception handling, so perturbing a candidate that node_score had
    already excluded (missing required feature) raised an unhandled
    exception -> a bare, non-JSON-structured 500."""
    with INCOMPLETE_CSV.open("rb") as handle:
        upload = client.post(
            "/audit/upload",
            files={"file": ("sample_candidates_one_incomplete.csv", handle, "text/csv")},
        )
    job_id = upload.json()["job_id"]
    _wait_for_job(client, job_id)

    # C00003 has a blank college_tier in the fixture - HiringAgent.score()
    # raises ValueError for it.
    response = client.post(
        f"/audit/{job_id}/candidate/C00003/perturb",
        json={"field": "is_metro", "new_value": 1},
    )

    assert response.status_code == 422
    body = response.json()
    assert body["detail"]["error_code"] == "CANDIDATE_NOT_SCORABLE"
    assert body["detail"]["candidate_id"] == "C00003"


# ---------------------------------------------------------------------------
# Global exception handler: no endpoint should ever return a raw 500
# ---------------------------------------------------------------------------

def test_unknown_job_id_status_returns_structured_404_not_raw_500(client):
    """Baseline sanity check that structured errors are the norm, not the
    exception, across the API surface touched by this review."""
    response = client.get("/audit/does-not-exist/status")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert "detail" in response.json()


def test_unhandled_exception_handler_returns_structured_json():
    """Directly exercises the new catch-all exception handler: simulate an
    unexpected (non-HTTPException) failure inside a route and confirm the
    response is still valid, parseable JSON rather than Starlette's default
    plain-text 500 body.

    Uses raise_server_exceptions=False: Starlette's ServerErrorMiddleware
    sends our handler's response and then re-raises the original exception
    by design (so test tools/servers can still log it) - raise_server_
    exceptions=False lets this test observe the actual HTTP response a real
    client would receive, instead of that re-raised exception.
    """
    from core.job_store import InMemoryJobStore

    def _boom(self, job_id):
        raise RuntimeError("simulated unexpected failure")

    original_get = InMemoryJobStore.get
    InMemoryJobStore.get = _boom
    try:
        no_raise_client = TestClient(app, raise_server_exceptions=False)
        response = no_raise_client.get("/audit/anything/status")
    finally:
        InMemoryJobStore.get = original_get

    assert response.status_code == 500
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert body["error_code"] == "INTERNAL_ERROR"
    assert "detail" in body
