"""
feature_engineering.py
Section 5.1 (The Shared Pipeline) + Section 4 (Ethical Design Boundaries) of
the Checksum plan.

Problem this solves: HiringAgent.FEATURE_COLS requires screening_score,
college_tier, is_metro, career_gap_months, experience_years to be present
for every scored candidate (agents/hiring_agent.py). But translation_layer.py
only RENAMES columns - it never had a way to produce is_metro,
career_gap_months, or screening_score when a realistic recruitment CSV
doesn't ship those exact columns (most don't). Previously, any of those
three being absent meant the candidate - or the whole batch - failed to
score. This module closes that gap with the same discipline the rest of
the pipeline uses: derive deterministically from concrete data, tag every
derived value with its method and a confidence score, and leave a field
genuinely missing (never fabricated) when there isn't enough raw data to
derive it. This mirrors inference_layer.py's existing pattern for
gender/age - it is not a new design principle, just extending the same one
to three more fields.

Runs in ingestion.py AFTER inference_layer.py's gender/age inference and
BEFORE the Availability Checker, so the checker's present/inferred/missing
counts already reflect these derived fields.
"""

from __future__ import annotations

import datetime
import re
from dataclasses import dataclass
from typing import Optional


CURRENT_YEAR = datetime.date.today().year

# ---------------------------------------------------------------------------
# is_metro: static city lookup.
#
# Definition used: the commonly-cited "metro" set in Indian hiring/compensation
# context (RBI's 6-metro list, extended with a few cities near-universally
# treated as metro in hiring analytics: Pune, Ahmedabad, and the NCR satellite
# cities Gurgaon/Gurugram and Noida, which are functionally part of Delhi-NCR).
# This is a deliberately DISCLOSED, static classification (like the
# name->gender lookup in inference_layer.py) - not a per-candidate guess.
# Swap in a different/longer list via `metro_cities` if your dataset's
# definition of "metro" differs (e.g. Tier-1 vs Tier-2 city classifications
# vary by source).
# ---------------------------------------------------------------------------
DEFAULT_METRO_CITIES = frozenset({
    "mumbai", "delhi", "newdelhi", "bengaluru", "bangalore", "hyderabad",
    "chennai", "kolkata", "pune", "ahmedabad", "gurgaon", "gurugram", "noida",
})

_DATE_FORMATS = (
    "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%d %b %Y", "%b %Y",
)

_SCORE_COMPONENT_FIELDS = (
    "interview_score", "skill_score", "aptitude_score",
    "technical_score", "personality_score",
)


@dataclass
class InferenceResult:
    value: Optional[object]
    is_inferred: bool
    inference_method: Optional[str] = None
    confidence: Optional[float] = None
    note: Optional[str] = None


def _normalize_city(city: str) -> str:
    return re.sub(r"[^a-z0-9]", "", city.strip().lower())


def _parse_date(value) -> Optional[datetime.date]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime.date):
        return value
    text = str(value).strip()
    for fmt in _DATE_FORMATS:
        try:
            parsed = datetime.datetime.strptime(text, fmt)
            if fmt == "%b %Y":
                return parsed.date().replace(day=1)
            return parsed.date()
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# is_metro
# ---------------------------------------------------------------------------

def infer_is_metro(
    record: dict,
    metro_cities: frozenset = DEFAULT_METRO_CITIES,
) -> InferenceResult:
    """
    Derive is_metro (1/0) from city (preferred) or region, via static lookup.
    Never invoked if is_metro is already present in the source data.
    """
    city = record.get("city")
    if city not in (None, ""):
        normalized = _normalize_city(str(city))
        if normalized:
            return InferenceResult(
                value=1 if normalized in metro_cities else 0,
                is_inferred=True,
                inference_method="city_metro_lookup",
                confidence=0.9,
                note=f"Derived from city='{city}' via static metro-city list.",
            )

    region = record.get("region")
    if region not in (None, ""):
        normalized = _normalize_city(str(region))
        if normalized:
            return InferenceResult(
                value=1 if normalized in metro_cities else 0,
                is_inferred=True,
                inference_method="region_metro_lookup",
                confidence=0.6,
                note=(
                    f"Derived from region='{region}' via static metro-city "
                    f"list - lower confidence than a direct city match."
                ),
            )

    return InferenceResult(
        value=None,
        is_inferred=False,
        note="not tested - data unavailable (no city or region field to derive is_metro from)",
    )


# ---------------------------------------------------------------------------
# career_gap_months
# ---------------------------------------------------------------------------

def infer_career_gap_months(record: dict) -> InferenceResult:
    """
    Two-tier derivation, in order of preference:

    1. Explicit dates: last_working_date -> next_joining_date. Highest
       confidence - this is a directly observed gap, not an estimate.
    2. Arithmetic fallback: (years since graduation) - (claimed
       experience_years). Approximates "unaccounted-for time" the same way
       inference_layer.infer_age() approximates age from graduation_year -
       always labeled as approximate, never presented as an observed fact.

    Returns missing (never fabricated) if neither input is available.
    """
    last_working = _parse_date(record.get("last_working_date"))
    next_joining = _parse_date(record.get("next_joining_date"))
    if last_working and next_joining and next_joining >= last_working:
        months = round((next_joining - last_working).days / 30.44)
        return InferenceResult(
            value=months,
            is_inferred=True,
            inference_method="employment_date_delta",
            confidence=0.95,
            note=f"Derived from last_working_date and next_joining_date ({months} months).",
        )

    graduation_year = record.get("graduation_year")
    experience_years = record.get("experience_years")
    if graduation_year not in (None, "") and experience_years not in (None, ""):
        try:
            grad_year_int = int(float(graduation_year))
            exp_years_float = float(experience_years)
        except (TypeError, ValueError):
            return InferenceResult(
                value=None,
                is_inferred=False,
                note="not tested - graduation_year/experience_years not numeric",
            )

        if grad_year_int > CURRENT_YEAR or grad_year_int < CURRENT_YEAR - 60:
            return InferenceResult(
                value=None,
                is_inferred=False,
                note="not tested - graduation_year out of plausible range",
            )

        years_since_grad = CURRENT_YEAR - grad_year_int
        gap_years = max(0.0, years_since_grad - exp_years_float)
        return InferenceResult(
            value=round(gap_years * 12),
            is_inferred=True,
            inference_method="graduation_experience_arithmetic",
            confidence=0.4,  # rougher than the date-delta method - flagged low
            note=(
                "approximate - derived as (years since graduation - claimed "
                "experience_years); not a verified employment gap"
            ),
        )

    return InferenceResult(
        value=None,
        is_inferred=False,
        note=(
            "not tested - data unavailable (need either last_working_date + "
            "next_joining_date, or both graduation_year + experience_years)"
        ),
    )


# ---------------------------------------------------------------------------
# screening_score
# ---------------------------------------------------------------------------

def infer_screening_score(
    record: dict,
    component_fields: tuple = _SCORE_COMPONENT_FIELDS,
) -> InferenceResult:
    """
    Composite fallback ONLY - averages whichever sub-scores (interview_score,
    skill_score, aptitude_score, technical_score, personality_score) are
    present. This is a genuine derivation from real per-candidate signals the
    recruiter already collected, not a fabricated skill score - but per
    Section 4 it's still disclosed as inferred with a method and confidence,
    and confidence scales down with how many components are missing.

    If a candidate has NONE of these components either, this correctly
    returns missing - Checksum will never invent a skill signal from nothing.
    """
    present = []
    for f in component_fields:
        val = record.get(f)
        if val in (None, ""):
            continue
        try:
            present.append(float(val))
        except (TypeError, ValueError):
            continue

    if not present:
        return InferenceResult(
            value=None,
            is_inferred=False,
            note=(
                "not tested - data unavailable (no screening_score and no "
                f"component scores among {list(component_fields)})"
            ),
        )

    composite = sum(present) / len(present)
    coverage = len(present) / len(component_fields)
    confidence = round(0.5 + 0.4 * coverage, 2)  # 0.5 (1 component) .. 0.9 (all present)

    return InferenceResult(
        value=round(composite, 2),
        is_inferred=True,
        inference_method="composite_component_average",
        confidence=confidence,
        note=f"Derived as the average of {len(present)}/{len(component_fields)} available component scores.",
    )


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

DERIVABLE_FIELDS = {
    "is_metro": infer_is_metro,
    "career_gap_months": infer_career_gap_months,
    "screening_score": infer_screening_score,
}


# ---------------------------------------------------------------------------
# User-facing "what would let Checksum derive this field" documentation.
#
# Used when a required field is missing for EVERY record in a batch (not
# just a few) - at that point it's not a per-candidate data-quality issue,
# it's a "this dataset's columns don't give Checksum anything to work with"
# issue, and the fix is for the user to change their upload, not something
# Checksum can route around per-record. See format_unresolvable_fields_message
# below for how this renders into the actual error text.
# ---------------------------------------------------------------------------
FIELD_DERIVATION_HELP: dict[str, dict] = {
    "screening_score": {
        "type": "any_of",
        "options": list(_SCORE_COMPONENT_FIELDS),
        "description": "Need one or more of these component score columns.",
    },
    "career_gap_months": {
        "type": "one_of_groups",
        "groups": [
            ["last_working_date", "next_joining_date"],
            ["graduation_year", "experience_years"],
        ],
        "description": "Need either both employment dates, or graduation_year + experience_years.",
    },
    "is_metro": {
        "type": "any_of",
        "options": ["city", "region"],
        "description": "Need a city (preferred) or region column to match against the metro-city list.",
    },
    "college_tier": {
        "type": "direct_only",
        "description": (
            "No automatic derivation available - inferring tier from a "
            "college name would mean guessing an institution's rank, which "
            "Checksum deliberately does not do. Upload a college_tier "
            "column directly, or provide a college-name-to-tier mapping."
        ),
    },
}


def describe_unresolvable_field(field_name: str) -> dict:
    """Structured explanation of what would let Checksum derive `field_name`.
    Falls back to a generic 'upload it directly' note for any required field
    (e.g. experience_years) that has no engineered-derivation path at all."""
    return FIELD_DERIVATION_HELP.get(field_name, {
        "type": "direct_only",
        "description": f"No automatic derivation available. Upload a '{field_name}' column directly.",
    })


def format_unresolvable_fields_message(unresolvable_fields: list[str]) -> str:
    """
    Renders describe_unresolvable_field() for each field into the
    human-readable block shown in the API error / frontend message, e.g.:

        Dataset cannot be scored.
        Required model features could not be derived.

        screening_score:
          Need one or more of:
          - interview_score
          - skill_score
          ...
    """
    lines = ["Dataset cannot be scored.", "Required model features could not be derived.", ""]
    for field_name in unresolvable_fields:
        info = describe_unresolvable_field(field_name)
        lines.append(f"{field_name}:")
        if info["type"] == "any_of":
            lines.append("  Need one or more of:")
            lines.extend(f"  - {opt}" for opt in info["options"])
        elif info["type"] == "one_of_groups":
            lines.append("  Need either:")
            for i, group in enumerate(info["groups"]):
                if i > 0:
                    lines.append("  OR")
                lines.append(f"  - {' + '.join(group)}")
        else:
            lines.append(f"  {info['description']}")
        lines.append("")
    return "\n".join(lines).rstrip()


def enrich_features(record: dict) -> dict:
    """
    Given a standardized candidate record (post translation_layer +
    inference_layer), fill in is_metro / career_gap_months / screening_score
    via deterministic derivation ONLY if not already present, and merge the
    result into the same '_inference_meta' block inference_layer.py uses -
    so ingestion.py's existing Availability Checker loop (which already
    reads _inference_meta) correctly counts these as "inferred" rather than
    "missing" or "present" with no extra wiring required.
    """
    record = dict(record)
    meta: dict = dict(record.get("_inference_meta", {}))

    for field_name, infer_fn in DERIVABLE_FIELDS.items():
        if record.get(field_name) not in (None, ""):
            continue  # already present - never overwrite real data
        result = infer_fn(record)
        record[field_name] = result.value
        meta[field_name] = {
            "is_inferred": result.is_inferred,
            "inference_method": result.inference_method,
            "confidence": result.confidence,
            "note": result.note,
        }

    record["_inference_meta"] = meta
    return record
