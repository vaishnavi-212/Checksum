"""
Injectable resume parser for PDF/DOCX uploads (Section 2.7).

Default stub returns empty fields with a warning. Real LLM parsers can be
injected via CHECKSUM_RESUME_PARSER or passed directly to ingest().
"""

from __future__ import annotations

from typing import Callable, Optional


class StubResumeParser:
    """Default parser — returns empty dict and a warning message."""

    def __call__(self, file_path: str) -> dict:
        return {
            "_parse_warning": (
                f"Resume parsing not configured for {file_path}. "
                "Set CHECKSUM_RESUME_PARSER or provide a custom parser callable."
            ),
        }


def get_resume_parser() -> Optional[Callable[[str], dict]]:
    """
    Return a resume parser based on CHECKSUM_RESUME_PARSER env var.

    Values:
      - "none" (default): returns None — upload endpoint returns 400 for PDF/DOCX
      - "stub": returns StubResumeParser (empty fields + warning)
    """
    import os

    mode = os.environ.get("CHECKSUM_RESUME_PARSER", "none").lower()
    if mode == "none":
        return None
    if mode == "stub":
        return StubResumeParser()
    # Future: "llm" mode would return an LLM-backed parser here.
    return None
