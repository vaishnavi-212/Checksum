"""
inference_layer.py
Section 4 (Ethical Design Boundaries) + Section 6 of the Checksum plan.

Infers gender and age ONLY when not explicitly present in the uploaded data,
and only via cheap, deterministic, non-LLM methods:
  - gender: static name -> gender lookup dictionary
  - age: arithmetic from graduation_year

Every inferred value is tagged with:
  - inference_method   (e.g. "name_lookup", "graduation_year_arithmetic")
  - confidence         (0-1 float, or None if not applicable)
  - is_inferred = True

Never presented as verified fact (Section 4). If a field can't be inferred
confidently, it is left missing and flagged "not tested - data unavailable"
rather than guessed (Section 4 / Section 7 missing-field rule).

Caste/religion inference is NEVER attempted, anywhere in this file, by
design (Section 4: "Never infer or label an individual's caste or
religion... this axis is deliberately excluded").
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass
from typing import Optional


CURRENT_YEAR = datetime.date.today().year

# Minimal illustrative name->gender lookup. In production this is backed by
# the Indian Name-Gender dataset (Kaggle) / `indian-names` package referenced
# in Section 8 of the plan. Kept small here; swap in the real dataset via
# load_name_gender_lookup().
_DEFAULT_NAME_GENDER_LOOKUP: dict[str, tuple[str, float]] = {
    # name (lowercase, first token) -> (gender, confidence)
    "amit": ("male", 0.9),
    "priya": ("female", 0.92),
    "rahul": ("male", 0.9),
    "sneha": ("female", 0.9),
    "arjun": ("male", 0.88),
    "kavya": ("female", 0.9),
}


@dataclass
class InferenceResult:
    value: Optional[object]
    is_inferred: bool
    inference_method: Optional[str] = None
    confidence: Optional[float] = None
    note: Optional[str] = None  # e.g. "not tested - data unavailable"


def load_name_gender_lookup(path: Optional[str] = None) -> dict[str, tuple[str, float]]:
    """
    Load a name->(gender, confidence) lookup table from a CSV with columns
    [name, gender, confidence]. Falls back to a tiny built-in table if no
    path is given, purely so this module works standalone in the demo.
    Swap in the real Indian Name-Gender dataset for production use.
    """
    if path is None:
        return dict(_DEFAULT_NAME_GENDER_LOOKUP)

    import csv

    table: dict[str, tuple[str, float]] = {}
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["name"].strip().lower()
            gender = row["gender"].strip().lower()
            conf = float(row.get("confidence", 0.8))
            table[name] = (gender, conf)
    return table


def infer_gender(
    full_name: Optional[str],
    lookup: dict[str, tuple[str, float]],
    min_confidence: float = 0.6,
) -> InferenceResult:
    """
    Infer gender from a candidate's first name via static lookup only.
    NEVER falls back to an LLM for this (Section 6: gender inference is
    "Rare fallback only, batched" - and even then, only for the LOOKUP
    table build/expansion, never per-candidate at audit time).
    """
    if not full_name:
        return InferenceResult(
            value=None, is_inferred=False, note="not tested - data unavailable"
        )

    first_token = full_name.strip().split()[0].lower() if full_name.strip() else ""
    match = lookup.get(first_token)

    if match is None:
        return InferenceResult(
            value=None,
            is_inferred=False,
            note="not tested - data unavailable (name not in lookup table)",
        )

    gender, confidence = match
    if confidence < min_confidence:
        return InferenceResult(
            value=None,
            is_inferred=False,
            note=f"not tested - inference confidence {confidence:.2f} below threshold {min_confidence:.2f}",
        )

    return InferenceResult(
        value=gender,
        is_inferred=True,
        inference_method="name_lookup",
        confidence=confidence,
    )


def infer_age(
    graduation_year: Optional[int],
    typical_grad_age: int = 22,
) -> InferenceResult:
    """
    Infer age arithmetically from graduation year: age ~= (current_year -
    graduation_year) + typical_grad_age. This is a rough estimate, always
    labeled as such - never presented as verified fact (Section 4).
    """
    if graduation_year is None:
        return InferenceResult(
            value=None, is_inferred=False, note="not tested - data unavailable"
        )

    try:
        grad_year_int = int(graduation_year)
    except (TypeError, ValueError):
        return InferenceResult(
            value=None,
            is_inferred=False,
            note="not tested - graduation_year not numeric",
        )

    if grad_year_int > CURRENT_YEAR or grad_year_int < CURRENT_YEAR - 60:
        return InferenceResult(
            value=None,
            is_inferred=False,
            note="not tested - graduation_year out of plausible range",
        )

    estimated_age = (CURRENT_YEAR - grad_year_int) + typical_grad_age
    return InferenceResult(
        value=estimated_age,
        is_inferred=True,
        inference_method="graduation_year_arithmetic",
        confidence=0.5,  # arithmetic estimate, never treated as high-confidence
        note="approximate - derived from graduation year, not verified",
    )


def enrich_record(
    record: dict,
    name_gender_lookup: dict[str, tuple[str, float]],
) -> dict:
    """
    Given a standardized candidate record (post translation_layer), fill in
    gender/age via inference ONLY if not already present, and attach an
    '_inference_meta' block so downstream consumers (Availability Checker,
    Audit Agent) can see exactly what was inferred vs. observed.
    """
    record = dict(record)  # don't mutate caller's dict
    meta: dict[str, dict] = record.get("_inference_meta", {})

    if not record.get("gender"):
        gr = infer_gender(record.get("name"), name_gender_lookup)
        record["gender"] = gr.value
        meta["gender"] = {
            "is_inferred": gr.is_inferred,
            "inference_method": gr.inference_method,
            "confidence": gr.confidence,
            "note": gr.note,
        }

    if not record.get("age"):
        ar = infer_age(record.get("graduation_year"))
        record["age"] = ar.value
        meta["age"] = {
            "is_inferred": ar.is_inferred,
            "inference_method": ar.inference_method,
            "confidence": ar.confidence,
            "note": ar.note,
        }

    record["_inference_meta"] = meta
    return record
