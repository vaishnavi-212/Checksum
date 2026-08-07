"""
ingestion.py
Section 5.1 (The Shared Pipeline) + Section 7 (Input Data Handling) of the
Checksum plan.

This is the single entry point every upload goes through, regardless of
downstream use (Path 1 / 2 / 3). It runs, in order:

    Raw Input (CSV / PDF / JSON)
      -> Format Detector (code)
      -> Resume Parser (LLM, PDF/DOCX only)
      -> Translation Layer (static synonym dictionary + rare LLM fallback)
      -> Inference Layer (gender via lookup, age via arithmetic)
      -> Availability Checker (marks each bias field: present / inferred / missing)
      -> Clean standardized candidate records

One pipeline, not two - identical no matter what happens after (Section 5.1).
The missing-field rule applies uniformly: never fabricated, always labeled
"not tested - data unavailable" (Section 4 / Section 7).

NOTE: import paths below assume this file is run from the backend project
root (the same root that contains agents/, interface/, pipeline/, scripts/)
with that root on sys.path - matching how agents/hiring_agent.py and
agents/audit_agent.py are imported elsewhere in this codebase. There is no
top-level "backend" package; imports are relative to the project root.
"""

from __future__ import annotations

import csv
import json
import os
from dataclasses import dataclass, field
from typing import Callable, Optional

from pipeline.translation_layer import (
    BIAS_FIELDS,
    STANDARD_SCHEMA,
    apply_mapping,
    map_columns,
)
from pipeline.inference_layer import enrich_record, load_name_gender_lookup
from pipeline.feature_engineering import enrich_features


# ---------------------------------------------------------------------------
# Format detection
# ---------------------------------------------------------------------------

SUPPORTED_FORMATS = {"csv", "json", "pdf", "docx"}


def detect_format(file_path: str) -> str:
    """
    Pure code-based format detection by extension (Section 5.1: "Format
    Detector (code)" - explicitly NOT an LLM step). Raises ValueError on
    anything unsupported rather than silently guessing.
    """
    ext = os.path.splitext(file_path)[1].lower().lstrip(".")
    if ext not in SUPPORTED_FORMATS:
        raise ValueError(
            f"Unsupported file format '.{ext}'. Supported: {sorted(SUPPORTED_FORMATS)}"
        )
    return ext


# ---------------------------------------------------------------------------
# Field availability status, per Section 7.
# ---------------------------------------------------------------------------

class FieldStatus:
    PRESENT = "present"
    INFERRED = "inferred"
    MISSING = "missing"


@dataclass
class AvailabilityReport:
    """
    Per-field availability across the whole batch, plus the model-access
    flag Section 7 calls for ("Availability Checker also flags model
    access... routes the job into full perturbation audit (Tiers 1-2) or
    statistics-only audit (Tier 3)").
    """

    field_status: dict[str, str] = field(default_factory=dict)  # field -> status (batch-level summary)
    per_field_present_count: dict[str, int] = field(default_factory=dict)
    per_field_inferred_count: dict[str, int] = field(default_factory=dict)
    per_field_missing_count: dict[str, int] = field(default_factory=dict)
    total_records: int = 0
    model_access_available: bool = False  # set by caller; determines Tier 1-2 vs Tier 3
    audit_mode: str = "statistical_only"  # "perturbation" | "statistical_only"

    def as_dict(self) -> dict:
        return {
            "total_records": self.total_records,
            "model_access_available": self.model_access_available,
            "audit_mode": self.audit_mode,
            "fields": {
                f: {
                    "present": self.per_field_present_count.get(f, 0),
                    "inferred": self.per_field_inferred_count.get(f, 0),
                    "missing": self.per_field_missing_count.get(f, 0),
                }
                for f in BIAS_FIELDS
            },
        }


@dataclass
class IngestionResult:
    records: list[dict] = field(default_factory=list)
    column_mapping_report: dict = field(default_factory=dict)
    availability: Optional[AvailabilityReport] = None
    warnings: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Raw readers per format
# ---------------------------------------------------------------------------

def _read_csv(file_path: str) -> tuple[list[str], list[dict]]:
    with open(file_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    columns = reader.fieldnames or []
    return columns, rows


def _read_json(file_path: str) -> tuple[list[str], list[dict]]:
    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get("candidates", data.get("records", [data]))
    if not isinstance(data, list) or not data:
        return [], []
    columns = list(data[0].keys())
    return columns, data


def _read_resume_document(
    file_path: str,
    resume_parser: Optional[Callable[[str], dict]] = None,
) -> tuple[list[str], list[dict]]:
    """
    PDF/DOCX resumes go through an LLM-based parser (Section 5.1: "Resume
    Parser (LLM, PDF/DOCX only)"). This is the one LLM step that's load-
    bearing for structure extraction rather than optional polish - but per
    Section 6 it's still non-critical to the *bias math*: a resume that
    fails to parse simply yields fewer usable fields, handled the same as
    any other missing-field case, not a pipeline crash.
    """
    if resume_parser is None:
        raise RuntimeError(
            "No resume_parser provided. PDF/DOCX ingestion requires an LLM-backed "
            "parser callable(file_path) -> dict of extracted fields."
        )
    try:
        parsed = resume_parser(file_path)
    except Exception as e:
        # Non-critical failure: return an empty-ish record rather than crash
        # the whole batch. Downstream, every field on this record will be
        # marked "missing" by the Availability Checker.
        return [], [{"resume_text": None, "_parse_error": str(e)}]

    if not parsed:
        return [], []
    return list(parsed.keys()), [parsed]


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def ingest(
    file_path: str,
    llm_column_fallback: Optional[Callable[[list[str], list[str]], dict[str, str]]] = None,
    resume_parser: Optional[Callable[[str], dict]] = None,
    name_gender_lookup_path: Optional[str] = None,
    model_access_available: bool = False,
) -> IngestionResult:
    """
    Run the full shared pipeline (Section 5.1) on one uploaded file and
    return clean, standardized candidate records plus an availability
    report the rest of Checksum consumes.
    """
    fmt = detect_format(file_path)

    if fmt == "csv":
        raw_columns, raw_rows = _read_csv(file_path)
    elif fmt == "json":
        raw_columns, raw_rows = _read_json(file_path)
    elif fmt in ("pdf", "docx"):
        raw_columns, raw_rows = _read_resume_document(file_path, resume_parser)
    else:  # pragma: no cover - detect_format already guards this
        raise ValueError(f"Unhandled format: {fmt}")

    result = IngestionResult()

    if not raw_rows:
        result.warnings.append("No records found in uploaded file.")
        result.availability = AvailabilityReport(
            total_records=0, model_access_available=model_access_available
        )
        result.availability.audit_mode = (
            "perturbation" if model_access_available else "statistical_only"
        )
        return result

    # --- Translation layer ---
    mapping = map_columns(raw_columns, llm_fallback=llm_column_fallback)
    result.column_mapping_report = {
        "column_map": mapping.column_map,
        "unmapped_columns": mapping.unmapped_columns,
        "unresolved_standard_fields": mapping.unresolved_standard_fields,
        "method": mapping.method,
    }
    if mapping.unmapped_columns:
        result.warnings.append(
            f"{len(mapping.unmapped_columns)} column(s) could not be mapped: "
            f"{mapping.unmapped_columns}"
        )

    standardized_rows = [apply_mapping(row, mapping.column_map) for row in raw_rows]

    # --- Inference layer (gender, age) ---
    lookup = load_name_gender_lookup(name_gender_lookup_path)
    enriched_rows = [enrich_record(row, lookup) for row in standardized_rows]

    # --- Feature engineering (is_metro, career_gap_months, screening_score) ---
    # Runs after gender/age inference, before the Availability Checker, so a
    # normal recruitment CSV that doesn't ship these exact columns (most
    # don't) can still be scored/audited wherever the raw data allows a
    # deterministic derivation. Never overwrites a field that's already
    # present; anything it can't derive is left genuinely missing (Section 4).
    enriched_rows = [enrich_features(row) for row in enriched_rows]

    # Assign candidate_id when the upload omits one (common in real CSVs).
    id_warnings = 0
    for index, row in enumerate(enriched_rows):
        if not row.get("candidate_id"):
            row["candidate_id"] = f"C{str(index + 1).zfill(5)}"
            id_warnings += 1
    if id_warnings:
        result.warnings.append(
            f"{id_warnings} record(s) missing candidate_id — auto-generated C00001-style IDs."
        )

    # --- Availability Checker (Section 7) ---
    availability = AvailabilityReport(
        total_records=len(enriched_rows),
        model_access_available=model_access_available,
    )
    availability.audit_mode = (
        "perturbation" if model_access_available else "statistical_only"
    )

    for f in BIAS_FIELDS:
        present = inferred = missing = 0
        for row in enriched_rows:
            val = row.get(f)
            inf_meta = (row.get("_inference_meta") or {}).get(f)
            if val is None or val == "":
                missing += 1
            elif inf_meta and inf_meta.get("is_inferred"):
                inferred += 1
            else:
                present += 1
        availability.per_field_present_count[f] = present
        availability.per_field_inferred_count[f] = inferred
        availability.per_field_missing_count[f] = missing
        # batch-level dominant status, purely for a quick-glance summary
        counts = {"present": present, "inferred": inferred, "missing": missing}
        availability.field_status[f] = max(counts, key=counts.get)

    result.records = enriched_rows
    result.availability = availability
    return result
