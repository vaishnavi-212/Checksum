"""
Job store abstraction — in-memory for dev, swappable to PostgreSQL in production.
"""

from __future__ import annotations

import threading
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
    """Thread-safe in-memory job store for development and demos."""

    def __init__(self) -> None:
        self._jobs: dict[str, dict[str, Any]] = {}
        self._locks: dict[str, threading.Lock] = {}
        self._global_lock = threading.Lock()

    def get(self, job_id: str) -> Optional[dict[str, Any]]:
        return self._jobs.get(job_id)

    def set(self, job_id: str, job: dict[str, Any]) -> None:
        with self._global_lock:
            self._jobs[job_id] = job
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
