"""
translation_layer.py
Section 5.1 / Section 6 of the Checksum plan.

Turns arbitrary user-uploaded column names into Checksum's standard schema
using a static synonym dictionary. Falls back to an LLM call ONLY when a
column can't be resolved by the dictionary, and that fallback is batched
and non-critical (Section 6: "Column/schema mapping ... Rare fallback only,
batched").

Never guesses silently. Any column that can't be mapped is left unmapped and
reported to the Availability Checker (Section 7) so it can be labeled
"not tested - data unavailable" rather than fabricated.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Optional


# ---------------------------------------------------------------------------
# Standard schema Checksum operates on internally.
# Every downstream component (Hiring Agent, Audit Agent, inference layer)
# assumes candidate records use these exact keys once translation is done.
# ---------------------------------------------------------------------------
STANDARD_SCHEMA = [
    "candidate_id",
    "name",
    "gender",
    "age",
    "graduation_year",
    "college_tier",
    "college_name",
    "city",
    "region",
    "is_metro",
    "career_gap_months",
    "experience_years",
    "screening_score",
    "shortlisted",
    "resume_text",
    # --- Raw "component" fields (added for feature_engineering.py) ---
    # Real recruitment CSVs rarely ship a single "screening_score" or
    # "career_gap_months" column directly. These fields capture the raw
    # signals that pipeline/feature_engineering.py can deterministically
    # derive the standard bias-test fields FROM, so ingestion can accept
    # normal recruitment datasets rather than only pre-engineered demo data.
    "interview_score",
    "skill_score",
    "aptitude_score",
    "technical_score",
    "personality_score",
    "last_working_date",
    "next_joining_date",
]

# Bias-relevant fields specifically. These are the ones the Availability
# Checker (Section 7) cares about most, because a missing bias field means
# a specific bias test gets skipped, not the whole record.
BIAS_FIELDS = [
    "gender",
    "age",
    "college_tier",
    "is_metro",
    "career_gap_months",
]

# ---------------------------------------------------------------------------
# Static synonym dictionary. Lowercased, punctuation-stripped match.
# This is the primary mapping mechanism - covers the large majority of
# real-world column naming conventions without ever touching an LLM.
# ---------------------------------------------------------------------------
SYNONYM_MAP: dict[str, list[str]] = {
    "candidate_id": ["id", "candidateid", "applicantid", "candidate_id", "sno", "serialno"],
    "name": ["name", "fullname", "candidatename", "applicantname"],
    "gender": ["gender", "sex"],
    "age": ["age", "candidateage", "yearsold"],
    "graduation_year": ["gradyear", "graduationyear", "yearofpassing", "passingyear", "yop"],
    "college_tier": ["collegetier", "tier", "collegerank", "institutetier"],
    "college_name": ["college", "collegename", "university", "institute", "institution"],
    "city": ["city", "location", "candidatecity", "hometown"],
    "region": ["region", "state", "zone"],
    "is_metro": ["ismetro", "metro", "metrostatus"],
    "career_gap_months": ["careergap", "gapmonths", "employmentgap", "careergapmonths"],
    "experience_years": ["experience", "yearsofexperience", "totalexperience", "expyears", "experienceyears"],
    "screening_score": ["screeningscore", "score", "testscore", "assessmentscore", "candidatescore", "overallscore"],
    "shortlisted": ["shortlisted", "selected", "outcome", "hired", "result", "decision", "hiringdecision"],
    "resume_text": ["resume", "resumetext", "cv", "resumecontent"],
    # --- Raw component fields, see STANDARD_SCHEMA note above ---
    "interview_score": ["interviewscore"],
    "skill_score": ["skillscore"],
    "aptitude_score": ["aptitudescore"],
    "technical_score": ["technicalscore"],
    "personality_score": ["personalityscore"],
    "last_working_date": ["lastworkingdate", "lastworkingday", "lwd", "relievingdate"],
    "next_joining_date": ["nextjoiningdate", "dateofjoining", "joiningdate", "doj"],
}


def _normalize(col: str) -> str:
    """Lowercase, strip whitespace/punctuation/underscores for fuzzy matching."""
    return re.sub(r"[^a-z0-9]", "", col.strip().lower())


# Build a flat reverse lookup once at import time: normalized synonym -> standard field
_REVERSE_LOOKUP: dict[str, str] = {}
for _std_field, _synonyms in SYNONYM_MAP.items():
    for _syn in _synonyms:
        _REVERSE_LOOKUP[_normalize(_syn)] = _std_field
    # the standard field name itself is always a valid match
    _REVERSE_LOOKUP[_normalize(_std_field)] = _std_field


@dataclass
class MappingResult:
    """Outcome of attempting to translate one uploaded file's columns."""

    column_map: dict[str, str] = field(default_factory=dict)   # original_col -> standard_field
    unmapped_columns: list[str] = field(default_factory=list)  # original cols with no match
    unresolved_standard_fields: list[str] = field(default_factory=list)  # standard fields never found
    llm_fallback_used_for: list[str] = field(default_factory=list)  # cols resolved only via LLM
    method: str = "dictionary"  # "dictionary" | "dictionary+llm"


def map_columns(
    raw_columns: list[str],
    llm_fallback: Optional[Callable[[list[str], list[str]], dict[str, str]]] = None,
) -> MappingResult:
    """
    Map a list of raw column names to STANDARD_SCHEMA fields.

    Parameters
    ----------
    raw_columns : the column headers exactly as they appear in the uploaded file
    llm_fallback : optional callable(unmapped_columns, remaining_standard_fields) -> {orig_col: std_field}
                   Only invoked for columns the dictionary couldn't resolve, and only once,
                   batched (all unresolved columns sent in a single call), per Section 6.
                   If None, unresolved columns are simply left unmapped - no LLM required
                   for the audit to still run (Section 6 guarantee: numbers never depend on LLM).

    Returns
    -------
    MappingResult
    """
    result = MappingResult()
    used_standard_fields: set[str] = set()

    # Pass 1: dictionary match
    still_unmapped: list[str] = []
    for col in raw_columns:
        norm = _normalize(col)
        std_field = _REVERSE_LOOKUP.get(norm)
        if std_field and std_field not in used_standard_fields:
            result.column_map[col] = std_field
            used_standard_fields.add(std_field)
        else:
            still_unmapped.append(col)

    result.unmapped_columns = still_unmapped

    # Pass 2: rare LLM fallback, batched, only if a resolver was supplied and
    # there's something left to resolve.
    remaining_std_fields = [f for f in STANDARD_SCHEMA if f not in used_standard_fields]
    if still_unmapped and llm_fallback and remaining_std_fields:
        try:
            llm_guesses = llm_fallback(still_unmapped, remaining_std_fields)
        except Exception:
            # LLM unavailable or failed -> non-critical, degrade gracefully.
            # Per Section 6: "if the LLM is unavailable ... the audit still
            # runs to completion with full accuracy - only the polish of
            # the written explanation degrades." Column mapping falls back
            # to "unmapped", which is honestly reported, never fabricated.
            llm_guesses = {}

        newly_mapped = []
        for col, std_field in llm_guesses.items():
            if col in still_unmapped and std_field in remaining_std_fields:
                result.column_map[col] = std_field
                used_standard_fields.add(std_field)
                result.llm_fallback_used_for.append(col)
                newly_mapped.append(col)

        result.unmapped_columns = [c for c in still_unmapped if c not in newly_mapped]
        if newly_mapped:
            result.method = "dictionary+llm"

    result.unresolved_standard_fields = [f for f in STANDARD_SCHEMA if f not in used_standard_fields]
    return result


def apply_mapping(row: dict, column_map: dict[str, str]) -> dict:
    """
    Rename one row's keys from original column names to standard field names,
    per a MappingResult.column_map. Unmapped original columns are dropped
    from the standardized record (they're preserved separately upstream if
    needed for audit trail, not silently lost - see ingestion.py).
    """
    return {
        std_field: row[orig_col]
        for orig_col, std_field in column_map.items()
        if orig_col in row
    }
