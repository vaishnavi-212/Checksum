"""
Job store abstraction — in-memory for dev, swappable to PostgreSQL in production.
"""

from __future__ import annotations

import os
import threading
import time
from abc import ABC, abstractmethod
from typing import Any, Optional


class JobStore(ABC):
    """Abstract interface for audit job persistence."""

    @abstractmethod
    def get(self, job_id: str) -> Optional[dict[str, Any]]:
        ...

    @abstractmethod
    def set(self, job_id: str, job: dict[str, Any]) -> None:
        ...

    @abstractmethod
    def update(self, job_id: str, updates: dict[str, Any]) -> None:
        ...

    @abstractmethod
    def list_ids(self) -> list[str]:
        ...

    @abstractmethod
    def lock(self, job_id: str) -> threading.Lock:
        """Return a per-job lock for serializing fix mutations."""


class InMemoryJobStore(JobStore):
    """Thread-safe in-memory job store for development and demos.

    Jobs older than CHECKSUM_JOB_TTL_HOURS (default 24) are dropped, and at
    most CHECKSUM_MAX_JOBS (default 200) are kept, so a long-running server
    doesn't slowly run out of memory. Note: everything is lost on restart or
    redeploy - use one worker process only, since each process has its own
    store.
    """

    def __init__(self, ttl_seconds: Optional[float] = None, max_jobs: Optional[int] = None) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}
        self._created: dict[str, float] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()
        self._ttl = ttl_seconds if ttl_seconds is not None else float(
            os.environ.get("CHECKSUM_JOB_TTL_HOURS", "24")
        ) * 3600
        self._max_jobs = max_jobs if max_jobs is not None else int(
            os.environ.get("CHECKSUM_MAX_JOBS", "200")
        )

    def _purge_locked(self) -> None:
        now = time.time()
        expired = [j for j, t in self._created.items() if now - t > self._ttl]
        overflow = len(self._jobs) - len(expired) - self._max_jobs
        if overflow > 0:
            oldest = sorted(
                (j for j in self._created if j not in expired), key=self._created.get
            )[:overflow]
            expired.extend(oldest)
        for j in expired:
            self._jobs.pop(j, None)
            self._created.pop(j, None)
            self._locks.pop(j, None)

    def get(self, job_id: str) -> Optional[dict[str, Any]]:
        return self._jobs.get(job_id)

    def set(self, job_id: str, job: dict[str, Any]) -> None:
        with self._global_lock:
            self._purge_locked()
            self._jobs[job_id] = job
            self._created.setdefault(job_id, time.time())
            self._locks.setdefault(job_id, threading.Lock())

    def update(self, job_id: str, updates: dict[str, Any]) -> None:
        with self._global_lock:
            if job_id not in self._jobs:
                raise KeyError(f"job_id not found: {job_id}")
            self._jobs[job_id].update(updates)

    def list_ids(self) -> list[str]:
        return list(self._jobs.keys())

    def lock(self, job_id: str) -> threading.Lock:
        with self._global_lock:
            return self._locks.setdefault(job_id, threading.Lock())

    def clear(self) -> None:
        """Clear all jobs — useful in tests."""
        with self._global_lock:
            self._jobs.clear()
            self._created.clear()
            self._locks.clear()


class PostgresJobStore(JobStore):
    """
    PostgreSQL-backed job store (Section 10).

    Requires CHECKSUM_DATABASE_URL env var. Not wired by default — swap
    get_job_store() factory when deploying to Railway/Render.
    """

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._locks: dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()
        raise NotImplementedError(
            "PostgresJobStore requires psycopg2/sqlalchemy wiring. "
            "Use InMemoryJobStore for development."
        )

    def get(self, job_id: str) -> Optional[dict[str, Any]]:
        raise NotImplementedError

    def set(self, job_id: str, job: dict[str, Any]) -> None:
        raise NotImplementedError

    def update(self, job_id: str, updates: dict[str, Any]) -> None:
        raise NotImplementedError

    def list_ids(self) -> list[str]:
        raise NotImplementedError

    def lock(self, job_id: str) -> threading.Lock:
        with self._global_lock:
            return self._locks.setdefault(job_id, threading.Lock())


def get_job_store() -> JobStore:
    """Factory: returns InMemoryJobStore unless CHECKSUM_DATABASE_URL is set."""
    import os

    db_url = os.environ.get("CHECKSUM_DATABASE_URL")
    if db_url:
        return PostgresJobStore(db_url)
    return InMemoryJobStore()
