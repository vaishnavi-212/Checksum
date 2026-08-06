"""
main.py
Section 11 (Backend Structure -> Core API endpoints) of the Checksum plan.

Exposes:
    POST /audit/upload                              (Path 1: candidates only -> own Hiring Agent)
    POST /audit/upload-external                      (Path 2: candidates + decisions + external model endpoint)
    GET  /audit/{job_id}/status
    GET  /audit/{job_id}/results
    POST /audit/{job_id}/candidate/{id}/perturb      (live single-field toggle, instant response)
    GET  /audit/{job_id}/explanation
    POST /audit/{job_id}/fix

Jobs run through the shared LangGraph pipeline (orchestration/graph.py) in a
background task so upload requests return immediately with a job_id, and
the frontend polls /status + /results - matching the "Score -> Audit" one-
click continuous flow described in Section 5.3b.
"""

from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from core.config import CHECKSUM_API_KEY, CHECKSUM_ENABLE_PDF, MAX_UPLOAD_BYTES, UPLOAD_DIR
from core.constants import FixStatus, FixStrategy
from core.job_store import get_job_store
from core.security import safe_stored_filename, validate_external_model_url, validate_upload_file
from core.thresholds import load_audit_thresholds
from core.worker import run_audit_job, run_fix_job
from pipeline.translation_layer import BIAS_FIELDS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Checksum Audit API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

JOB_STORE = get_job_store()


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """
    Safety net so no endpoint can ever return Starlette's default
    plain-text/HTML 500 body. Any exception that escapes a route handler
    (i.e. wasn't already turned into an HTTPException with a structured
    detail) is logged with a full traceback and reported to the client as
    valid, parseable JSON in the same shape as ErrorResponse, never as raw
    text the frontend can't decode.
    """
    logger.exception("unhandled_exception path=%s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_ERROR",
            "detail": "An unexpected error occurred while processing this request.",
        },
    )


@app.middleware("http")
async def optional_api_key_middleware(request: Request, call_next):
    """Optional X-API-Key gate when CHECKSUM_API_KEY is set."""
    if CHECKSUM_API_KEY and request.url.path not in ("/health", "/docs", "/openapi.json", "/redoc"):
        api_key = request.headers.get("X-API-Key")
        if api_key != CHECKSUM_API_KEY:
            raise HTTPException(status_code=401, detail="Invalid or missing X-API-Key.")
    return await call_next(request)


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class UploadResponse(BaseModel):
    job_id: str
    status: str
    path: str


class StatusResponse(BaseModel):
    job_id: str
    status: str
    path: Optional[str] = None
    audit_mode: Optional[str] = None
    fix_status: Optional[str] = None
    progress: Optional[str] = None
    warnings: list[str] = []
    error: Optional[str] = None


class PerturbRequest(BaseModel):
    field: str
    new_value: object

    @field_validator("field")
    @classmethod
    def validate_field(cls, value: str) -> str:
        allowed = set(BIAS_FIELDS)
        try:
            from core.model_registry import get_hiring_agent

            allowed.update(get_hiring_agent().feature_columns)
        except Exception:  # noqa: BLE001
            pass
        if value not in allowed:
            raise ValueError(
                f"field '{value}' is not allowed. Allowed: {sorted(allowed)}"
            )
        return value


class PerturbResponse(BaseModel):
    candidate_id: str
    field: str
    original_value: object
    new_value: object
    original_score: float
    perturbed_score: float
    delta: float


class FixRequest(BaseModel):
    strategy: FixStrategy = FixStrategy.AUTO


# Only the group-mean-adjustment mitigation (interface/mitigated_model.py) is
# actually implemented. REWEIGHT / THRESHOLD_ADJUST / DROP_TOP_FLAGGED_FEATURE
# exist as declared FixStrategy values (README: "Not yet built") but node_fix
# (orchestration/graph.py) has no implementation for them - accepting one
# would silently run group-mean adjustment anyway while telling the caller a
# different strategy ran. Reject them explicitly instead.
IMPLEMENTED_FIX_STRATEGIES = {FixStrategy.AUTO}


class ResultsResponse(BaseModel):
    """Layer 1–3 audit output (Section 9)."""

    job_id: str
    audit_mode: Optional[str] = None
    availability_report: Optional[dict[str, Any]] = None
    scores: Optional[list[dict[str, Any]]] = None
    perturbation_results: Optional[list[dict[str, Any]]] = None
    shap_summary: Optional[dict[str, Any]] = None
    statistical_results: Optional[dict[str, Any]] = None
    explainability_method: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
    fix_applied: Optional[bool] = None
    fix_before_after: Optional[dict[str, Any]] = None


class ErrorResponse(BaseModel):
    error_code: str
    detail: str
    job_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Upload helpers
# ---------------------------------------------------------------------------

def _save_upload(file: UploadFile) -> str:
    validate_upload_file(file)
    dest = UPLOAD_DIR / safe_stored_filename(file.filename)
    with dest.open("wb") as f:
        shutil.copyfileobj(file.file, f)
        if f.tell() > MAX_UPLOAD_BYTES:
            dest.unlink(missing_ok=True)
            raise HTTPException(
                status_code=413,
                detail=f"Upload exceeds maximum size of {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
            )
    return str(dest)


def _check_pdf_docx_allowed(file: UploadFile) -> None:
    extension = Path(file.filename or "").suffix.lower()
    if extension in (".pdf", ".docx") and not CHECKSUM_ENABLE_PDF:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "RESUME_PARSER_DISABLED",
                "detail": (
                    "PDF/DOCX uploads require CHECKSUM_ENABLE_PDF=true and a "
                    "configured resume parser (CHECKSUM_RESUME_PARSER)."
                ),
            },
        )


def _queue_job(background_tasks: BackgroundTasks, job_id: str, initial_state: dict) -> None:
    background_tasks.add_task(run_audit_job, JOB_STORE, job_id, initial_state)


# ---------------------------------------------------------------------------
# POST /audit/upload  - Path 1
# ---------------------------------------------------------------------------

@app.post("/audit/upload", response_model=UploadResponse)
async def upload_candidates_only(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    _check_pdf_docx_allowed(file)
    file_path = _save_upload(file)
    job_id = uuid.uuid4().hex

    JOB_STORE.set(
        job_id,
        {
            "status": "queued",
            "path": "1",
            "fix_status": FixStatus.IDLE.value,
        },
    )

    initial_state = {
        "job_id": job_id,
        "file_path": file_path,
        "path": "1",
        "model_access_available": True,
    }
    _queue_job(background_tasks, job_id, initial_state)

    return UploadResponse(job_id=job_id, status="queued", path="1")


# ---------------------------------------------------------------------------
# POST /audit/upload-external  - Path 2a / 2b
# ---------------------------------------------------------------------------

@app.post("/audit/upload-external", response_model=UploadResponse)
async def upload_candidates_and_external_model(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    external_model_endpoint: Optional[str] = Form(None),
):
    _check_pdf_docx_allowed(file)
    file_path = _save_upload(file)
    job_id = uuid.uuid4().hex
    path = "2a" if external_model_endpoint else "2b"

    validated_endpoint = None
    if external_model_endpoint:
        validated_endpoint = validate_external_model_url(external_model_endpoint)

    JOB_STORE.set(
        job_id,
        {
            "status": "queued",
            "path": path,
            "fix_status": FixStatus.IDLE.value,
        },
    )

    initial_state = {
        "job_id": job_id,
        "file_path": file_path,
        "path": path,
        "model_access_available": bool(validated_endpoint),
        "external_model_endpoint": validated_endpoint,
    }
    _queue_job(background_tasks, job_id, initial_state)

    return UploadResponse(job_id=job_id, status="queued", path=path)


# ---------------------------------------------------------------------------
# GET /audit/{job_id}/status
# ---------------------------------------------------------------------------

@app.get("/audit/{job_id}/status", response_model=StatusResponse)
async def get_status(job_id: str):
    job = JOB_STORE.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job_id not found")

    result = job.get("result", {})
    return StatusResponse(
        job_id=job_id,
        status=job["status"],
        path=job.get("path"),
        audit_mode=result.get("audit_mode"),
        fix_status=job.get("fix_status", FixStatus.IDLE.value),
        progress=result.get("last_completed_node"),
        warnings=result.get("warnings", []),
        error=job.get("error"),
    )


# ---------------------------------------------------------------------------
# GET /audit/{job_id}/results
# ---------------------------------------------------------------------------

@app.get("/audit/{job_id}/results", response_model=ResultsResponse)
async def get_results(job_id: str):
    job = JOB_STORE.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job_id not found")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail=f"job not finished (status={job['status']})")

    result = job["result"]
    shap_summary = result.get("shap_summary") or {}
    return ResultsResponse(
        job_id=job_id,
        audit_mode=result.get("audit_mode"),
        availability_report=result.get("availability_report"),
        scores=result.get("scores"),
        perturbation_results=result.get("perturbation_results"),
        shap_summary=shap_summary,
        statistical_results=result.get("statistical_results"),
        explainability_method=shap_summary.get("method"),
        warnings=result.get("warnings", []),
        fix_applied=result.get("fix_applied"),
        fix_before_after=result.get("fix_before_after"),
    )


# ---------------------------------------------------------------------------
# POST /audit/{job_id}/candidate/{candidate_id}/perturb
# ---------------------------------------------------------------------------

@app.post("/audit/{job_id}/candidate/{candidate_id}/perturb", response_model=PerturbResponse)
async def perturb_candidate(job_id: str, candidate_id: str, body: PerturbRequest):
    job = JOB_STORE.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job_id not found")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail=f"job not finished (status={job['status']})")

    state = job["result"]
    records = state.get("records") or []
    candidate = next((r for r in records if str(r.get("candidate_id")) == candidate_id), None)
    if candidate is None:
        raise HTTPException(status_code=404, detail="candidate_id not found in this job")

    from interface.model_interface import candidate_from_record
    from orchestration.graph import resolve_scoring_model

    # Use the SAME model that actually scored this job (own Hiring Agent,
    # or the uploaded external model for Path 2a) - never silently swap in
    # a different model than the one being audited.
    try:
        agent = resolve_scoring_model(state)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=502,
            detail={
                "error_code": "MODEL_UNAVAILABLE",
                "detail": f"Could not load the model used to score this job: {exc}",
            },
        ) from exc

    def _score_or_422(record: dict, context: str) -> float:
        """Score one record via `agent`, converting ANY scoring failure —
        a missing required feature, a non-numeric value, an external model
        timeout, a malformed external response — into a structured 422
        instead of letting it escape as an unhandled 500. A candidate
        legitimately can't be scored sometimes (that's exactly why
        ScoreResult.score is Optional); this endpoint has to report that
        cleanly rather than crash."""
        try:
            result = agent.score(candidate_from_record(record))
        except Exception as exc:  # noqa: BLE001 - any model-specific failure
            raise HTTPException(
                status_code=422,
                detail={
                    "error_code": "CANDIDATE_NOT_SCORABLE",
                    "detail": f"Model could not compute the {context} score: {exc}",
                    "candidate_id": candidate_id,
                },
            ) from exc
        if result.score is None:
            raise HTTPException(
                status_code=422,
                detail={
                    "error_code": "CANDIDATE_NOT_SCORABLE",
                    "detail": (
                        f"Model could not compute the {context} score"
                        + (f": {result.error}" if result.error else ".")
                    ),
                    "candidate_id": candidate_id,
                },
            )
        return result.score

    original_value = candidate.get(body.field)
    original_score = _score_or_422(candidate, "original")

    perturbed = dict(candidate)
    perturbed[body.field] = body.new_value
    perturbed_score = _score_or_422(perturbed, "perturbed")

    return PerturbResponse(
        candidate_id=candidate_id,
        field=body.field,
        original_value=original_value,
        new_value=body.new_value,
        original_score=original_score,
        perturbed_score=perturbed_score,
        delta=perturbed_score - original_score,
    )


# ---------------------------------------------------------------------------
# GET /audit/{job_id}/explanation
# ---------------------------------------------------------------------------

@app.get("/audit/{job_id}/explanation")
async def get_explanation(job_id: str):
    job = JOB_STORE.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job_id not found")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail=f"job not finished (status={job['status']})")

    return {"job_id": job_id, "explanation": job["result"].get("explanation_text")}


# ---------------------------------------------------------------------------
# POST /audit/{job_id}/fix
# ---------------------------------------------------------------------------

@app.post("/audit/{job_id}/fix")
async def apply_fix(job_id: str, body: FixRequest, background_tasks: BackgroundTasks):
    job = JOB_STORE.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job_id not found")
    if job["status"] != "done":
        raise HTTPException(status_code=409, detail=f"job not finished (status={job['status']})")
    if job.get("fix_status") == FixStatus.RUNNING.value:
        raise HTTPException(status_code=409, detail="fix already running for this job")
    if body.strategy not in IMPLEMENTED_FIX_STRATEGIES:
        raise HTTPException(
            status_code=422,
            detail={
                "error_code": "FIX_STRATEGY_NOT_IMPLEMENTED",
                "detail": (
                    f"Mitigation strategy '{body.strategy.value}' is not yet "
                    f"implemented. Supported strategies: "
                    f"{sorted(s.value for s in IMPLEMENTED_FIX_STRATEGIES)}."
                ),
            },
        )

    from orchestration.graph import node_fix

    background_tasks.add_task(
        run_fix_job,
        JOB_STORE,
        job_id,
        body.strategy.value,
        node_fix,
    )
    JOB_STORE.update(job_id, {"fix_status": FixStatus.RUNNING.value})

    return {
        "job_id": job_id,
        "fix_status": FixStatus.RUNNING.value,
        "strategy": body.strategy.value,
    }


@app.get("/health")
async def health():
    model_loaded = False
    calibration_loaded = False
    try:
        from core.model_registry import get_hiring_agent

        get_hiring_agent()
        model_loaded = True
    except Exception:  # noqa: BLE001
        pass

    thresholds = load_audit_thresholds()
    calibration_loaded = bool(thresholds.get("calibrated"))

    return {
        "status": "ok",
        "model_loaded": model_loaded,
        "calibration_loaded": calibration_loaded,
    }
