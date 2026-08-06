# Checksum — Backend

Model-agnostic hiring bias audit API. Shared pipeline → three paths → Model Interface → Audit Agent → tiered audit depth → explain → fix.

## Project layout

```
checksum-backend/
  main.py                          — FastAPI endpoints (thin router layer)
  pyproject.toml                   — editable package install (pip install -e .)
  core/
    config.py                      — env-driven settings, feature flags, sampling caps
    constants.py                   — shared enums (paths, audit modes, fix strategies)
    job_store.py                   — InMemoryJobStore (+ PostgresJobStore stub)
    model_registry.py              — cached HiringAgent singleton
    thresholds.py                  — calibrated_thresholds.json loader + severity bands
    worker.py                      — background job execution abstraction
    security.py                    — upload validation, SSRF guards
  orchestration/
    graph.py                       — LangGraph: ingest → score → route → audit → explain → (fix)
  agents/
    hiring_agent.py                — reference XGBoost ScoringModel
    audit_agent.py                 — perturbation + SHAP + Tier-3 stats + mitigation
    explanation_agent.py           — template explanations (LLM optional via CHECKSUM_LLM_ENABLED)
    demo_external_agent.py         — demo logistic model for Path 2a agnosticism proof
  interface/
    model_interface.py             — ScoringModel contract + Candidate bridge
    external_model_adapter.py      — HTTP + callable external model wrappers
    mitigated_model.py             — group-adjustment mitigation wrapper
  pipeline/
    ingestion.py                   — format detection + translation + inference
    resume_parser.py               — injectable PDF/DOCX parser stub
  models/
    hiring_agent.json              — trained XGBoost model
    calibrated_thresholds.json     — empirically calibrated severity thresholds
  tests/                           — pytest integration + unit tests
  scripts/
    calibrate_thresholds.py        — threshold calibration script
```

## Verified working (pytest + TestClient)

- **Path 1** — CSV upload → ingestion → scoring → perturbation audit → native SHAP → results
- **Path 2b** — decisions-only upload → Tier 3 (four-fifths + demographic parity + matched-pair)
- **Live perturb** — `POST /audit/{job_id}/candidate/{id}/perturb` with field validation (422 on invalid fields)
- **Fix** — `POST /audit/{job_id}/fix` with fix_status polling (group-adjustment mitigation MVP)
- **SSRF protection** — blocks localhost/private IP external model endpoints
- **Upload hardening** — extension whitelist, size limit, UUID-only storage paths, Windows-safe temp dir

## Setup

```bash
pip install -e ".[dev]"
# or: pip install -r requirements.txt

uvicorn main:app --reload
```

## Quick demo

```bash
# Path 1 — full perturbation audit
curl -F "file=@tests/fixtures/sample_candidates.csv" http://localhost:8000/audit/upload

# Path 2b — statistics-only (no model access)
curl -F "file=@tests/fixtures/sample_decisions_only.csv" http://localhost:8000/audit/upload-external

# Poll status + results
curl http://localhost:8000/audit/<job_id>/status
curl http://localhost:8000/audit/<job_id>/results
```

## Tests & CI

```bash
make test          # pytest tests/
make calibrate     # regenerate calibrated_thresholds.json
make lint          # ruff
```

GitHub Actions runs pytest + ruff on push.

## Key environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CHECKSUM_UPLOAD_DIR` | system temp | Upload storage directory |
| `CHECKSUM_MAX_UPLOAD_MB` | 10 | Max upload size |
| `CHECKSUM_API_KEY` | (none) | Optional X-API-Key middleware |
| `CHECKSUM_ENABLE_KERNEL_SHAP` | true | KernelSHAP for external models |
| `CHECKSUM_ENABLE_PDF` | false | Allow PDF/DOCX uploads |
| `CHECKSUM_REQUIRE_HTTPS_EXTERNAL` | false | Require https for external model URLs |
| `CHECKSUM_MAX_PERTURBATION_CANDIDATES` | 500 | Perturbation sampling cap |
| `CHECKSUM_MAX_SHAP_CANDIDATES` | 200 | SHAP sampling cap |

## Architecture notes

- **Default graph excludes fix** — mitigation runs only via explicit `POST /fix`, not on every upload.
- **Model registry** — HiringAgent loads once per process; perturb endpoint reuses cached model.
- **Job store abstraction** — swap `InMemoryJobStore` for `PostgresJobStore` via `CHECKSUM_DATABASE_URL`.
- **External model demo** — `agents/demo_external_agent.py` exposes a second model via `CallableModelAdapter`.

## Not yet built (post-hackathon)

- PostgreSQL job persistence (interface exists, implementation stubbed)
- Fairlearn ExponentiatedGradient reweight (Phase B mitigation)
- LLM explanation backend (`CHECKSUM_LLM_ENABLED=true` hook ready)
- Full propensity-score matched-pair (simplified bin-matching implemented instead)
