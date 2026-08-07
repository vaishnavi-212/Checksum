"""
orchestration/graph.py

NOTE ON FOLDER NAME: this lives in orchestration/, not langgraph/, even
though it's built with the LangGraph library. A folder literally named
langgraph/ sitting on sys.path (per this project's bare-import convention,
where the backend root itself is added to sys.path) would shadow the
installed `langgraph` pip package - `from langgraph.graph import
StateGraph` below would import itself instead of the real library.
Renaming the local folder is the correct fix (not a style choice) - it
preserves bare imports everywhere else without introducing a "backend."
package prefix.

Section 10 (Tech Stack: "LangGraph - orchestrates Ingest -> Score (own or
external) -> Audit -> Explain -> Fix flow") + Build Order step 10.

Wires the whole Checksum job lifecycle as a LangGraph StateGraph so the
FastAPI layer (main.py) can just invoke one graph per job rather than
hand-managing branching logic for Path 1 / 2a / 2b / 3.

Node responsibilities map 1:1 onto plan sections:
  ingest    -> pipeline/ingestion.py                         (Section 5.1, 7)
  score     -> Hiring Agent OR External Model Adapter          (Section 5.2, 5.3, 5.4)
  route     -> checks Availability Checker's model_access flag (Section 5.6)
  audit_full     -> Audit Agent, perturbation + SHAP           (Tiers 1-2, Section 5.5, 5.7)
  audit_stats_only -> Audit Agent, four-fifths/matched-pair     (Tier 3, Section 5.6, 5.7)
  explain   -> Explanation Agent (LLM, non-critical)            (Section 6)
  fix       -> Fairlearn mitigator + re-audit                    (Section 5.5, Build step 13)

Every node is a pure function of (state) -> state_updates, so the graph is
easy to unit test node-by-node without spinning up FastAPI or a real model.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional, TypedDict

from langgraph.graph import END, StateGraph

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared job state
# ---------------------------------------------------------------------------

class CheckSumState(TypedDict, total=False):
    job_id: str
    file_path: str
    path: str                     # "1" | "2a" | "2b" | "3"  (Section 5.2/5.3/5.6)
    model_access_available: bool
    external_model_endpoint: Optional[str]

    records: list[dict]
    availability_report: dict
    warnings: list[str]

    scores: list[dict]            # [{candidate_id, score, decision, feature_importances}, ...]
    audit_mode: str               # "perturbation" | "statistical_only"
    unresolvable_fields: Optional[dict]     # field -> derivation-requirements explanation
    partially_missing_fields: Optional[dict]  # field -> count of records missing it

    perturbation_results: list[dict]
    shap_summary: dict
    statistical_results: dict     # four-fifths / demographic parity / matched-pair (Tier 3)

    explanation_text: str
    fix_applied: bool
    fix_before_after: dict

    fix_strategy: Optional[str]

    error: Optional[str]
    last_completed_node: Optional[str]


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------

_POSITIVE_OUTCOMES = frozenset(
    {"1", "true", "yes", "shortlisted", "selected", "hired"}
)


def _is_positive_outcome(value) -> bool:
    return str(value).strip().lower() in _POSITIVE_OUTCOMES


def _scores_from_uploaded_decisions(records: list[dict]) -> list[dict]:
    """
    Path 2b (Section 5.3): decisions-only uploads — derive Layer 1 scores
    from the uploaded outcome field, without calling any scoring model.
    """
    scores: list[dict] = []
    for record in records:
        candidate_id = str(record.get("candidate_id", ""))
        outcome = record.get("shortlisted")
        if outcome in (None, ""):
            continue

        positive = _is_positive_outcome(outcome)
        decision = "Shortlisted" if positive else "Not Shortlisted"

        # Prefer an explicit numeric score column when present; otherwise
        # use a binary 0/100 representation of the uploaded decision.
        raw_score = record.get("screening_score")
        if raw_score not in (None, ""):
            try:
                score = float(raw_score)
            except (TypeError, ValueError):
                score = 100.0 if positive else 0.0
        else:
            score = 100.0 if positive else 0.0

        scores.append(
            {
                "candidate_id": candidate_id,
                "score": round(score, 2),
                "decision": decision,
                "feature_importances": None,
            }
        )
    return scores


# ---------------------------------------------------------------------------
# Display-feature enrichment (frontend convenience only — never used in
# scoring logic; attached purely so the Results Dashboard candidate table
# can show input feature values alongside model output without a separate
# lookup)
# ---------------------------------------------------------------------------

_DISPLAY_FEATURE_KEYS = (
    "screening_score",
    "college_tier",
    "is_metro",
    "experience_years",
    "career_gap_months",
)


def _attach_display_features(scores: list[dict], records: list[dict]) -> list[dict]:
    """
    Attach raw input feature values (display-only, never used in scoring
    logic) to each score dict, keyed by candidate_id, so the frontend can
    show them alongside the model's output without re-deriving anything.
    Never overwrites existing ScoreResult keys.
    """
    records_by_id = {str(r.get("candidate_id", "")): r for r in records}
    for score in scores:
        record = records_by_id.get(score.get("candidate_id"))
        if record is None:
            continue
        score["input_features"] = {
            key: record[key] for key in _DISPLAY_FEATURE_KEYS if key in record
        }
    return scores


# ---------------------------------------------------------------------------
# Node implementations
# ---------------------------------------------------------------------------

def _timed_node(node_name: str, fn):
    """Wrap a graph node with structured logging."""

    def wrapper(state: CheckSumState) -> dict:
        job_id = state.get("job_id", "unknown")
        path = state.get("path", "?")
        start = time.perf_counter()
        logger.info("node_start job_id=%s path=%s node=%s", job_id, path, node_name)
        try:
            updates = fn(state)
            duration_ms = (time.perf_counter() - start) * 1000
            logger.info(
                "node_done job_id=%s path=%s node=%s duration_ms=%.1f",
                job_id,
                path,
                node_name,
                duration_ms,
            )
            updates["last_completed_node"] = node_name
            return updates
        except Exception as exc:
            duration_ms = (time.perf_counter() - start) * 1000
            logger.exception(
                "node_failed job_id=%s path=%s node=%s duration_ms=%.1f",
                job_id,
                path,
                node_name,
                duration_ms,
            )
            return {"error": f"{node_name}_failed: {exc}", "last_completed_node": node_name}

    return wrapper


def node_ingest(state: CheckSumState) -> dict:
    """Section 5.1: run the shared pipeline once, regardless of downstream path."""
    from pipeline.ingestion import ingest

    try:
        result = ingest(
            state["file_path"],
            model_access_available=state.get("model_access_available", False),
        )
    except Exception as e:
        return {"error": f"ingestion_failed: {e}"}

    return {
        "records": result.records,
        "availability_report": result.availability.as_dict() if result.availability else {},
        "warnings": result.warnings,
        "audit_mode": result.availability.audit_mode if result.availability else "statistical_only",
    }


def node_score(state: CheckSumState) -> dict:
    """
    Section 5.2 (Path 1, own Hiring Agent) / Section 5.3 (Path 2a, external
    model via Model Interface) / Section 5.3b (Path 3, reuse a prior score).
    All three converge on the same output shape: a list of
    {candidate_id, score, decision, feature_importances} dicts satisfying
    the Model Interface contract (Section 5.4).

    Each returned score dict also carries a display-only "input_features"
    key (see _attach_display_features above) — raw input values for the
    Results Dashboard candidate table. This is purely additive and never
    read by any scoring/audit/mitigation logic downstream.
    """
    if state.get("error"):
        return {}

    from dataclasses import asdict

    from interface.model_interface import candidate_from_record

    path = state.get("path", "1")
    records = state.get("records", [])

    if path == "3":
        # Path 3: caller already supplied prior Hiring Agent output on the
        # state (job_id lookup happened before entering the graph) - nothing
        # to recompute, just pass through.
        return {"scores": state.get("scores", [])}

    excluded_scores: list[dict] = []
    scorable_records = records

    if path == "1":
        from core.model_registry import get_hiring_agent

        required = get_hiring_agent().feature_columns
        scorable_records = []
        missing_summary: dict[str, int] = {}
        for record in records:
            missing = [c for c in required if record.get(c) in (None, "")]
            if not missing:
                scorable_records.append(record)
            else:
                for field in missing:
                    missing_summary[field] = missing_summary.get(field, 0) + 1
                # Per the plan's "never guess" rule (Section 4/7): a record
                # missing a required model feature is excluded from Hiring
                # Agent scoring and reported as such, rather than either
                # fabricating the missing value or failing the whole batch
                # over one incomplete record.
                excluded_scores.append({
                    "candidate_id": str(record.get("candidate_id", "")),
                    "score": None,
                    "decision": "Not scored - data unavailable",
                    "feature_importances": None,
                    "missing_fields": missing,
                })
        if records and not scorable_records:
            from pipeline.feature_engineering import (
                describe_unresolvable_field,
                format_unresolvable_fields_message,
            )

            n_total = len(records)
            # A field missing for EVERY record is a "this dataset's columns
            # don't give Checksum anything to derive this from" problem -
            # the fix is the user changing their upload, so it gets the full
            # structured explanation. A field missing for only some records
            # doesn't belong here at all - see the per-record "excluded_scores"
            # path above, which already handles that case without failing
            # the batch.
            unresolvable = [f for f, count in missing_summary.items() if count == n_total]
            partially_missing = {
                f: count for f, count in missing_summary.items() if count < n_total
            }

            if unresolvable:
                message = format_unresolvable_fields_message(unresolvable)
            else:
                # Every required field is present for at least one record,
                # but no single record has all of them at once (e.g. some
                # rows have screening_score but not college_tier, others the
                # reverse) - not fixable with a single "add this column"
                # instruction, so report the per-field counts plainly.
                message = (
                    "Dataset cannot be scored: no single record has every "
                    "required field at once. Per-field gaps: "
                    + ", ".join(f"{f} ({c} records)" for f, c in partially_missing.items())
                )

            return {
                "error": message,
                "unresolvable_fields": {
                    f: describe_unresolvable_field(f) for f in unresolvable
                },
                "partially_missing_fields": partially_missing,
            }

    if path == "2b":
        # Path 2b: decisions-only — use uploaded outcomes, do not re-score.
        return {
            "scores": _attach_display_features(
                _scores_from_uploaded_decisions(records), records
            )
        }

    # Every model (own or external) is scored against Candidate objects, per
    # the ScoringModel contract (interface/model_interface.py); the pipeline
    # hands us plain dicts, so convert once here. Only scorable_records go
    # through the model - excluded_scores (path "1" only) were already
    # separated out above so a partially-incomplete batch doesn't crash.
    candidates = [candidate_from_record(r) for r in scorable_records]

    if path == "2a" and state.get("external_model_endpoint"):
        from interface.external_model_adapter import ExternalModelAdapter

        adapter = ExternalModelAdapter(state["external_model_endpoint"])
        score_results = adapter.score_batch(candidates)
        return {
            "scores": _attach_display_features(
                [asdict(sr) for sr in score_results] + excluded_scores, records
            )
        }

    # Default / Path 1: score with Checksum's own Hiring Agent.
    from core.model_registry import get_hiring_agent

    agent = get_hiring_agent()
    score_results = agent.score_batch(candidates) if candidates else []
    scores = _attach_display_features(
        [asdict(sr) for sr in score_results] + excluded_scores, records
    )
    updates: dict = {"scores": scores}
    if excluded_scores:
        updates["warnings"] = state.get("warnings", []) + [
            f"{len(excluded_scores)} record(s) excluded from Hiring Agent "
            f"scoring due to missing required feature(s): {missing_summary}"
        ]
    return updates


def node_route(state: CheckSumState) -> str:
    """
    Section 5.6: routes to full perturbation audit (Tiers 1-2) or
    statistics-only audit (Tier 3) based on the Availability Checker's
    model-access flag - not based on which path the user chose, so a
    Path 2b "decisions only" upload correctly lands in Tier 3 even if
    someone mislabels it Path 2a.
    """
    if state.get("error"):
        return "error_exit"
    has_model_access = state.get("model_access_available", False) or bool(
        state.get("external_model_endpoint")
    )
    return "audit_full" if has_model_access else "audit_stats_only"


def resolve_scoring_model(state: CheckSumState):
    """
    Resolve the SAME ScoringModel that actually produced this job's scores,
    so every downstream feature — full audit, live perturb, fix/mitigation —
    operates on the model that was actually uploaded/scored, never silently
    substituting Checksum's own Hiring Agent for a Path 2a external model.

    This is the single source of truth for "which model is this job about";
    node_audit_full, node_fix, and main.py's /perturb endpoint all call this
    instead of each independently deciding which model to load (the
    previous bug: node_fix and /perturb both hardcoded get_hiring_agent(),
    silently ignoring external_model_endpoint on Path 2a jobs).
    """
    if state.get("path") == "2a" and state.get("external_model_endpoint"):
        from interface.external_model_adapter import ExternalModelAdapter

        return ExternalModelAdapter(state["external_model_endpoint"])

    from core.model_registry import get_hiring_agent

    return get_hiring_agent()


def node_audit_full(state: CheckSumState) -> dict:
    """Tiers 1-2 (Section 5.5, 5.7): perturbation test + SHAP-based skill-vs-pedigree split."""
    from agents.audit_agent import AuditAgent

    model = resolve_scoring_model(state)
    audit_agent = AuditAgent(model=model)
    perturbation_results = audit_agent.run_perturbation_suite(state.get("records", []))
    shap_summary = audit_agent.run_shap_summary(state.get("records", []))

    return {
        "perturbation_results": perturbation_results,
        "shap_summary": shap_summary,
        "audit_mode": "perturbation",
    }


def node_audit_stats_only(state: CheckSumState) -> dict:
    """
    Tier 3 (Section 5.6, 5.7): four-fifths rule, demographic parity
    difference, matched-pair comparison. No model access required -
    operates purely on records + prior decisions ("shortlisted"/outcome
    field already present in the uploaded data).
    """
    from agents.audit_agent import AuditAgent

    audit_agent = AuditAgent(model=None)
    statistical_results = audit_agent.run_statistical_audit(state.get("records", []))

    return {
        "statistical_results": statistical_results,
        "audit_mode": "statistical_only",
    }


def node_explain(state: CheckSumState) -> dict:
    """
    Section 6: LLM explanation step, explicitly non-critical - the numbers
    above are already final by the time this node runs. If the LLM call
    fails, fall back to a template sentence, never block the job.
    """
    try:
        from agents.explanation_agent import ExplanationAgent

        explainer = ExplanationAgent()
        text = explainer.explain(
            perturbation_results=state.get("perturbation_results"),
            shap_summary=state.get("shap_summary"),
            statistical_results=state.get("statistical_results"),
            audit_mode=state.get("audit_mode", "statistical_only"),
        )
    except Exception:
        text = _template_fallback_explanation(state)

    return {"explanation_text": text}


def _template_fallback_explanation(state: CheckSumState) -> str:
    mode = state.get("audit_mode", "statistical_only")
    if mode == "perturbation":
        shap = state.get("shap_summary", {})
        pedigree_pct = shap.get("pedigree_reliance_pct")
        if pedigree_pct is not None and pedigree_pct >= 30:
            return (
                f"This model relies on pedigree/proxy signals for approximately "
                f"{pedigree_pct:.0f}% of its decisions, which exceeds Checksum's "
                f"calibrated threshold for a confirmed bias flag. Field-level "
                f"perturbation results are attached."
            )
        return (
            "This model's decisions are primarily driven by skill-related "
            "features, with pedigree/proxy fields contributing minimally. "
            "See the attached per-field breakdown for details."
        )
    return (
        "Statistical group-comparison audit completed (no live model access "
        "was available for this job). See the four-fifths rule and "
        "matched-pair results attached for details."
    )


def node_fix(state: CheckSumState) -> dict:
    """
    Build step 13: apply a Fairlearn mitigator (or the rule-based fallback
    from Section 6: "drop top-flagged feature / apply Fairlearn
    reweighting") and re-run the audit for a before/after comparison
    (Section 9, Layer 4 output format).
    """
    from agents.audit_agent import AuditAgent

    if state.get("audit_mode") != "perturbation":
        # Mitigation requires a live model to retrain/reweight; Tier 3 jobs
        # (no model access) can't produce a "fix" - report that plainly
        # rather than fabricate a before/after.
        return {
            "fix_applied": False,
            "fix_before_after": {
                "note": "Fix step requires model access (Tier 1-2); this job "
                "ran in statistics-only mode (Tier 3)."
            },
        }

    before = state.get("shap_summary", {}).get("pedigree_reliance_pct")
    strategy_requested = state.get("fix_strategy")

    # Only the group-mean-adjustment mitigation (interface/mitigated_model.py)
    # is actually implemented today (see README "Not yet built": Fairlearn
    # ExponentiatedGradient reweight). main.py already rejects any other
    # FixStrategy with a 422 before scheduling this job, so reaching here
    # with an unsupported strategy would indicate an internal inconsistency
    # (e.g. a direct call to run_job bypassing the API) rather than a normal
    # user error - report it plainly instead of silently doing something
    # different from what was requested.
    if strategy_requested not in (None, "auto"):
        return {
            "fix_applied": False,
            "fix_before_after": {
                "strategy_requested": strategy_requested,
                "strategy_applied": None,
                "note": (
                    f"Mitigation strategy '{strategy_requested}' is not "
                    f"implemented. Only 'auto' (group-mean adjustment) is "
                    f"available in this build."
                ),
            },
        }

    mitigation_meta: dict = {}
    try:
        agent = resolve_scoring_model(state)
        audit_agent = AuditAgent(model=agent)
        mitigated_agent = audit_agent.apply_mitigation(agent, state.get("records", []))
        mitigation_meta = getattr(mitigated_agent, "mitigation_meta", {}) or {}
        after_summary = AuditAgent(model=mitigated_agent).run_shap_summary(state.get("records", []))
        after = after_summary.get("pedigree_reliance_pct")
        fix_applied = True
    except Exception as e:
        after = None
        fix_applied = False
        after_summary = {"error": str(e)}

    return {
        "fix_applied": fix_applied,
        "fix_before_after": {
            "strategy_requested": strategy_requested,
            "strategy_applied": "group_mean_adjustment" if fix_applied else None,
            "pedigree_reliance_before_pct": before,
            "pedigree_reliance_after_pct": after,
            "improved": (after is not None and before is not None and after < before),
            "mitigation_meta": mitigation_meta,
            "after_summary": after_summary,
        },
    }


def node_error_exit(state: CheckSumState) -> dict:
    return {"explanation_text": f"Job failed: {state.get('error', 'unknown error')}"}


# ---------------------------------------------------------------------------
# Graph assembly
# ---------------------------------------------------------------------------

def build_graph(include_fix_step: bool = False):
    """
    Build and compile the Checksum job graph:

        ingest -> score -> [route] -> audit_full     -> explain -> (fix) -> END
                                    -> audit_stats_only -> explain -> (fix) -> END
                                    -> error_exit -> END
    """
    graph = StateGraph(CheckSumState)

    graph.add_node("ingest", _timed_node("ingest", node_ingest))
    graph.add_node("score", _timed_node("score", node_score))
    graph.add_node("audit_full", _timed_node("audit_full", node_audit_full))
    graph.add_node("audit_stats_only", _timed_node("audit_stats_only", node_audit_stats_only))
    graph.add_node("explain", _timed_node("explain", node_explain))
    graph.add_node("error_exit", _timed_node("error_exit", node_error_exit))
    if include_fix_step:
        graph.add_node("fix", _timed_node("fix", node_fix))

    graph.set_entry_point("ingest")
    graph.add_edge("ingest", "score")

    graph.add_conditional_edges(
        "score",
        node_route,
        {
            "audit_full": "audit_full",
            "audit_stats_only": "audit_stats_only",
            "error_exit": "error_exit",
        },
    )

    graph.add_edge("audit_full", "explain")
    graph.add_edge("audit_stats_only", "explain")

    if include_fix_step:
        graph.add_edge("explain", "fix")
        graph.add_edge("fix", END)
    else:
        graph.add_edge("explain", END)

    graph.add_edge("error_exit", END)

    return graph.compile()


# Module-level singletons for default (no fix) and fix-enabled graphs.
_compiled_graph = None
_compiled_graph_with_fix = None


def get_compiled_graph(include_fix_step: bool = False):
    global _compiled_graph, _compiled_graph_with_fix
    if include_fix_step:
        if _compiled_graph_with_fix is None:
            _compiled_graph_with_fix = build_graph(include_fix_step=True)
        return _compiled_graph_with_fix
    if _compiled_graph is None:
        _compiled_graph = build_graph(include_fix_step=False)
    return _compiled_graph


def run_job(initial_state: CheckSumState, include_fix_step: bool = False) -> CheckSumState:
    """Convenience entry point used by main.py's FastAPI handlers."""
    graph = get_compiled_graph(include_fix_step=include_fix_step)
    return graph.invoke(initial_state)