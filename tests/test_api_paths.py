"""Integration tests for Path 1 upload → status → results."""

from __future__ import annotations

import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from core.model_registry import reset_hiring_agent_cache
from main import JOB_STORE, app

FIXTURES = Path(__file__).parent / "fixtures"
SAMPLE_CSV = FIXTURES / "sample_candidates.csv"
DECISIONS_CSV = FIXTURES / "sample_decisions_only.csv"


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


def _wait_for_job(client: TestClient, job_id: str, timeout_seconds: float = 60.0) -> dict:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        response = client.get(f"/audit/{job_id}/status")
        assert response.status_code == 200
        payload = response.json()
        if payload["status"] in ("done", "failed"):
            return payload
        time.sleep(0.25)
    raise TimeoutError(f"Job {job_id} did not finish within {timeout_seconds}s")


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "model_loaded" in body
    assert "calibration_loaded" in body


def test_path1_upload_to_results(client):
    assert SAMPLE_CSV.is_file(), "sample_candidates.csv fixture is required"

    with SAMPLE_CSV.open("rb") as handle:
        response = client.post(
            "/audit/upload",
            files={"file": ("sample_candidates.csv", handle, "text/csv")},
        )

    assert response.status_code == 200
    body = response.json()
    job_id = body["job_id"]
    assert body["path"] == "1"

    status = _wait_for_job(client, job_id)
    assert status["status"] == "done", status.get("error")
    assert status["audit_mode"] == "perturbation"
    assert status["fix_status"] == "idle"

    results = client.get(f"/audit/{job_id}/results")
    assert results.status_code == 200
    body = results.json()
    assert body["audit_mode"] == "perturbation"
    assert body["scores"]
    assert len(body["scores"]) == 10
    assert body["perturbation_results"] is not None
    assert body["shap_summary"] is not None
    assert body["explainability_method"] == "native_shap"


def test_path2b_decisions_only(client):
    assert DECISIONS_CSV.is_file()

    with DECISIONS_CSV.open("rb") as handle:
        response = client.post(
            "/audit/upload-external",
            files={"file": ("sample_decisions_only.csv", handle, "text/csv")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["path"] == "2b"
    job_id = body["job_id"]

    status = _wait_for_job(client, job_id)
    assert status["status"] == "done", status.get("error")
    assert status["audit_mode"] == "statistical_only"

    results = client.get(f"/audit/{job_id}/results")
    assert results.status_code == 200
    stats = results.json()["statistical_results"]
    assert stats is not None
    assert "four_fifths_rule" in stats
    assert "demographic_parity" in stats
    assert "matched_pair" in stats
    assert stats["four_fifths_rule"]["flag"] is True


def test_perturb_invalid_field_returns_422(client):
    with SAMPLE_CSV.open("rb") as handle:
        upload = client.post(
            "/audit/upload",
            files={"file": ("sample_candidates.csv", handle, "text/csv")},
        )
    job_id = upload.json()["job_id"]
    _wait_for_job(client, job_id)

    response = client.post(
        f"/audit/{job_id}/candidate/C00001/perturb",
        json={"field": "not_a_real_field", "new_value": 1},
    )
    assert response.status_code == 422


def test_rejects_invalid_upload_extension(client):
    response = client.post(
        "/audit/upload",
        files={"file": ("malware.exe", b"bad", "application/octet-stream")},
    )
    assert response.status_code == 400


def test_ssrf_blocks_localhost_external_endpoint(client):
    with SAMPLE_CSV.open("rb") as handle:
        response = client.post(
            "/audit/upload-external",
            data={"external_model_endpoint": "http://127.0.0.1:9999/score"},
            files={"file": ("sample_candidates.csv", handle, "text/csv")},
        )
    assert response.status_code == 400
