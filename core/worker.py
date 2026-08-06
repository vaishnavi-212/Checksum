"""
Background job execution abstraction (Section 4.1).

FastAPI BackgroundTasks use this entry point today; swap to Celery/RQ
later without touching graph logic.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

from core.constants import FixStatus, JobStatus
from core.job_store import JobStore

logger = logging.getLogger(__name__)


def run_audit_job(
    job_store: JobStore,
    job_id: str,
    initial_state: dict[str, Any],
    *,
    include_fix_step: bool = False,
) -> None:
    """Execute the LangGraph pipeline and persist results to the job store."""
    from orchestration.graph import run_job

    job_store.update(job_id, {"status": JobStatus.RUNNING.value})
    logger.info("job_start job_id=%s path=%s", job_id, initial_state.get("path"))

    try:
        final_state = run_job(initial_state, include_fix_step=include_fix_step)
        updates: dict[str, Any] = {"result": final_state}

        if final_state.get("error"):
            updates["status"] = JobStatus.FAILED.value
            updates["error"] = final_state["error"]
            logger.warning(
                "job_failed job_id=%s error=%s", job_id, final_state["error"]
            )
        else:
            updates["status"] = JobStatus.DONE.value
            logger.info(
                "job_done job_id=%s audit_mode=%s",
                job_id,
                final_state.get("audit_mode"),
            )

        job_store.update(job_id, updates)
    except Exception as exc:  # noqa: BLE001
        job_store.update(
            job_id,
            {"status": JobStatus.FAILED.value, "error": str(exc)},
        )
        logger.exception("job_exception job_id=%s", job_id)


def run_fix_job(
    job_store: JobStore,
    job_id: str,
    strategy: str,
    fix_fn: Callable[[dict[str, Any]], dict[str, Any]],
) -> None:
    """Apply mitigation under a per-job lock and update fix_status."""
    lock = job_store.lock(job_id)
    job_store.update(job_id, {"fix_status": FixStatus.RUNNING.value})

    with lock:
        job = job_store.get(job_id)
        if job is None:
            return

        try:
            state = dict(job.get("result") or {})
            state["fix_strategy"] = strategy
            updates = fix_fn(state)
            result = dict(job.get("result") or {})
            result.update(updates)
            job_store.update(
                job_id,
                {
                    "result": result,
                    "fix_status": FixStatus.DONE.value,
                },
            )
            logger.info("fix_done job_id=%s strategy=%s", job_id, strategy)
        except Exception as exc:  # noqa: BLE001
            job_store.update(
                job_id,
                {"fix_status": FixStatus.FAILED.value, "fix_error": str(exc)},
            )
            logger.exception("fix_failed job_id=%s", job_id)
