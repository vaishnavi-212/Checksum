"""
Audit Agent — NOT a trained model. A statistics + rules engine that works
against ANY ScoringModel (own Hiring Agent or an external one via the
adapter), per the plan's model-agnostic architecture (Section 5.5-5.7).

This module must NEVER import agents.hiring_agent directly. It only ever
talks through interface.model_interface.ScoringModel. That's what makes it
provably reusable on external models.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import Optional
import numpy as np
from scipy import stats

from interface.model_interface import (
    Candidate,
    ScoringModel,
    ExplainabilityMethod,
    candidate_from_record,
)
from pipeline.translation_layer import BIAS_FIELDS
from core.config import (
    CHECKSUM_ENABLE_KERNEL_SHAP,
    DEMOGRAPHIC_PARITY_THRESHOLD,
    MAX_KERNEL_SHAP_BACKGROUND,
    MAX_KERNEL_SHAP_CANDIDATES,
    MAX_PERTURBATION_CANDIDATES,
    MAX_SHAP_CANDIDATES,
)
from core.thresholds import load_audit_thresholds, severity_band

# Default skill vs. pedigree split used when a model does not declare its own.
SKILL_FIELDS = ["screening_score", "experience_years"]
PEDIGREE_FIELDS = ["college_tier", "is_metro", "career_gap_months"]


# Fallback when calibrated_thresholds.json is missing (see core/thresholds.py).
DEFAULT_THRESHOLDS = {
    "p_value_cutoff": 0.05,
    "low_effect_pts": 5.0,
    "high_effect_pts": 15.0,
}


@dataclass
class PerturbationResult:
    """Per-field result of testing many candidates (plan Section 9, Layer 3)."""
    field_tested: str
    n_candidates: int
    avg_delta_pts: float
    median_delta_pts: float
    std_dev: float
    min_delta_pts: float
    max_delta_pts: float
    wilcoxon_statistic: float
    p_value: float
    statistically_significant: bool
    severity: str  # "LOW" | "MED" | "HIGH"
    per_candidate_deltas: list = field(default_factory=list)
    n_scoring_errors: int = 0  # candidates excluded because score_batch() couldn't score them
    note: Optional[str] = None


@dataclass
class AuditVerdict:
    """The final challenge output for one field (plan Section 5, "The Argument")."""
    field_tested: str
    perturbation: PerturbationResult
    skill_vs_pedigree: Optional[dict]  # from SHAP, if explainability available
    verdict: str  # "Justified (skill-driven)" | "Confirmed bias (pedigree-driven)" | "Inconclusive"
    audit_mode: str  # "perturbation" | "statistical_only"


class AuditAgent:
    """
    Model-agnostic bias auditor. Construct with any ScoringModel — the
    Hiring Agent, or an adapter wrapping an external model.
    """

    def __init__(self, model: ScoringModel, thresholds: dict = None):
        self.model = model
        self.thresholds = thresholds or load_audit_thresholds()

    # -----------------------------------------------------------------
    # Tier 1/2: Perturbation test (requires query access to the model)
    # -----------------------------------------------------------------
    def perturb_field(
        self,
        candidates: list[Candidate],
        field_name: str,
        new_value,
    ) -> PerturbationResult:
        """
        Core primitive: for every candidate, change ONLY field_name to
        new_value, re-score via the model, measure the delta. This is the
        "one engine, list of fields" mechanism from Section 1 of the plan.

        ScoringModel.score_batch() (interface/model_interface.py) is
        defensive: it returns a ScoreResult(score=None) rather than raising
        for any candidate it couldn't score - most commonly an external
        model's HTTP call timing out or returning something malformed
        (interface/external_model_adapter.py). This method has to honor
        that: pair up only candidates that scored successfully on BOTH the
        original and perturbed call, and report how many were dropped,
        rather than letting a `None - float` crash the whole field's test.
        """
        originals = self.model.score_batch(candidates)
        perturbed_candidates = [c.with_perturbed_field(field_name, new_value) for c in candidates]
        perturbed = self.model.score_batch(perturbed_candidates)

        paired = [
            (o, p) for o, p in zip(originals, perturbed)
            if o.score is not None and p.score is not None
        ]
        n_scoring_errors = len(candidates) - len(paired)

        if not paired:
            return PerturbationResult(
                field_tested=field_name,
                n_candidates=0,
                avg_delta_pts=0.0,
                median_delta_pts=0.0,
                std_dev=0.0,
                min_delta_pts=0.0,
                max_delta_pts=0.0,
                wilcoxon_statistic=0.0,
                p_value=1.0,
                statistically_significant=False,
                severity="LOW",
                per_candidate_deltas=[],
                n_scoring_errors=n_scoring_errors,
                note=(
                    "No candidates could be scored for this field - every "
                    "scoring attempt failed (see the model's error messages "
                    "in the underlying score results)."
                ),
            )

        deltas = np.array([p.score - o.score for o, p in paired])

        # Wilcoxon needs the deltas to not be all-zero; guard for tiny/degenerate sets
        if len(deltas) >= 1 and np.any(deltas != 0):
            orig_scores = np.array([o.score for o, _ in paired])
            pert_scores = np.array([p.score for _, p in paired])
            stat, p_value = stats.wilcoxon(orig_scores, pert_scores)
        else:
            stat, p_value = 0.0, 1.0

        # numpy comparisons return numpy.bool_, which FastAPI/pydantic can't
        # JSON-serialize; cast to a native bool here rather than downstream.
        significant = bool(p_value < self.thresholds["p_value_cutoff"])
        avg_delta = float(np.mean(deltas))
        severity = self._severity(abs(avg_delta), significant)

        return PerturbationResult(
            field_tested=field_name,
            n_candidates=len(paired),
            avg_delta_pts=avg_delta,
            median_delta_pts=float(np.median(deltas)),
            std_dev=float(np.std(deltas)),
            min_delta_pts=float(np.min(deltas)),
            max_delta_pts=float(np.max(deltas)),
            wilcoxon_statistic=float(stat),
            p_value=float(p_value),
            statistically_significant=significant,
            severity=severity,
            per_candidate_deltas=deltas.tolist(),
            n_scoring_errors=n_scoring_errors,
            note=(
                f"{n_scoring_errors} candidate(s) excluded from this field's "
                f"test due to scoring errors."
            ) if n_scoring_errors else None,
        )

    def _severity(self, abs_avg_delta: float, significant: bool) -> str:
        p_value = 0.0 if significant else 1.0
        return severity_band(abs_avg_delta, p_value, self.thresholds)

    # -----------------------------------------------------------------
    # SHAP-based skill-vs-pedigree split (native if model supports it,
    # falls back to KernelSHAP otherwise — plan Section 5.4/5.6)
    # -----------------------------------------------------------------
    def skill_vs_pedigree_split(
        self,
        candidates: list[Candidate],
        skill_fields: list[str],
        pedigree_fields: list[str],
        feature_cols: list[str],
    ) -> dict:
        """
        Native TreeExplainer when the model exposes an underlying estimator;
        otherwise KernelSHAP approximation for external/query-only models.
        """
        import shap
        import pandas as pd

        if not feature_cols:
            return {"method": "unavailable", "note": "No feature columns declared."}

        if self.model.supports_native_explainability:
            underlying = getattr(self.model, "_model", None)
            if underlying is None:
                return {"method": "unavailable", "note": "No underlying estimator exposed for SHAP."}

            # Build each candidate's feature row individually so one
            # candidate missing a required feature (or holding a
            # non-numeric value) is skipped and counted, instead of
            # aborting pd.DataFrame(...).astype(float) - and therefore the
            # entire audit - for every other candidate too.
            rows = []
            n_skipped = 0
            for c in candidates:
                row = {}
                try:
                    for col in feature_cols:
                        row[col] = float(c.features.get(col))
                except (TypeError, ValueError):
                    n_skipped += 1
                    continue
                rows.append(row)

            if not rows:
                return {
                    "method": "unavailable",
                    "note": (
                        f"No candidate had all required features present and "
                        f"numeric ({n_skipped} skipped)."
                    ),
                }

            X = pd.DataFrame(rows, columns=feature_cols).astype(float)

            explainer = shap.TreeExplainer(underlying)
            shap_values = explainer.shap_values(X)
            mean_abs_shap = np.abs(shap_values).mean(axis=0)

            importance = dict(zip(feature_cols, mean_abs_shap.tolist()))
            skill_weight = sum(importance[f] for f in skill_fields if f in importance)
            pedigree_weight = sum(importance[f] for f in pedigree_fields if f in importance)
            total = skill_weight + pedigree_weight or 1e-9

            result = {
                "method": ExplainabilityMethod.NATIVE_SHAP.value,
                "feature_importances": importance,
                "skill_reliance_pct": round(skill_weight / total * 100, 1),
                "pedigree_reliance_pct": round(pedigree_weight / total * 100, 1),
                "n_candidates_tested": len(rows),
                "n_candidates_total": len(candidates),
            }
            if n_skipped:
                result["n_candidates_skipped"] = n_skipped
                result["note"] = (
                    f"{n_skipped} candidate(s) were missing a required feature "
                    f"value and were excluded from this SHAP computation."
                )
            return result

        if not CHECKSUM_ENABLE_KERNEL_SHAP:
            return {
                "method": "unavailable",
                "note": "KernelSHAP disabled (CHECKSUM_ENABLE_KERNEL_SHAP=false).",
            }

        return self._kernel_shap_split(candidates, skill_fields, pedigree_fields, feature_cols)

    def _kernel_shap_split(
        self,
        candidates: list[Candidate],
        skill_fields: list[str],
        pedigree_fields: list[str],
        feature_cols: list[str],
    ) -> dict:
        """Sample-limited KernelSHAP for external/query-only models."""
        import shap
        import pandas as pd

        if self.model is None:
            return {"method": "unavailable", "note": "No model for KernelSHAP."}

        sample_size = min(len(candidates), MAX_KERNEL_SHAP_CANDIDATES)
        background_size = min(len(candidates), MAX_KERNEL_SHAP_BACKGROUND)
        sampled = candidates[:sample_size]
        background = candidates[:background_size]

        predict_errors = 0

        def predict_fn(X: np.ndarray) -> np.ndarray:
            # KernelSHAP calls this many times with synthetic
            # foreground/background feature-value combinations, not real
            # candidates. self.model.score() is called directly (not
            # score_batch) because SHAP needs a plain array-in/array-out
            # function - so this loop has to provide its own per-call
            # protection: one external-model timeout, malformed response,
            # or `score=None` result must not abort the whole SHAP run
            # (and, transitively, the whole audit job - see
            # orchestration/graph.py's node_audit_full / _timed_node,
            # which turns any uncaught exception here into a job-wide
            # failure). A failed call is treated as a neutral 0 prediction
            # for that one synthetic sample and counted in predict_errors,
            # which is surfaced in the returned summary below - never
            # silently absorbed.
            nonlocal predict_errors
            probs = []
            for row in X:
                features = dict(zip(feature_cols, row.tolist()))
                candidate = Candidate(candidate_id="kernel_shap", features=features)
                score = None
                try:
                    score = self.model.score(candidate).score
                except Exception:  # noqa: BLE001 - any model-specific failure
                    score = None
                if score is None:
                    predict_errors += 1
                    score = 0.0
                probs.append(score / 100.0)
            return np.array(probs)

        bg_rows = [{col: c.features.get(col, 0) for col in feature_cols} for c in background]
        sample_rows = [{col: c.features.get(col, 0) for col in feature_cols} for c in sampled]

        try:
            bg_df = pd.DataFrame(bg_rows, columns=feature_cols).astype(float)
            sample_df = pd.DataFrame(sample_rows, columns=feature_cols).astype(float)
            explainer = shap.KernelExplainer(predict_fn, bg_df.values)
            shap_values = explainer.shap_values(sample_df.values, nsamples=100)
            mean_abs_shap = np.abs(shap_values).mean(axis=0)

            importance = dict(zip(feature_cols, mean_abs_shap.tolist()))
            skill_weight = sum(importance.get(f, 0) for f in skill_fields)
            pedigree_weight = sum(importance.get(f, 0) for f in pedigree_fields)
            total = skill_weight + pedigree_weight or 1e-9

            note = (
                "KernelSHAP approximation on a sample; external models "
                "without native explainability use query-only scoring."
            )
            if predict_errors:
                note += (
                    f" {predict_errors} underlying model call(s) failed "
                    f"during SHAP sampling and were treated as a neutral "
                    f"score so the audit could still complete "
                    f"(see n_model_scoring_errors)."
                )

            result = {
                "method": ExplainabilityMethod.KERNEL_SHAP_APPROX.value,
                "feature_importances": importance,
                "skill_reliance_pct": round(skill_weight / total * 100, 1),
                "pedigree_reliance_pct": round(pedigree_weight / total * 100, 1),
                "n_candidates_tested": sample_size,
                "n_candidates_total": len(candidates),
                "sample_size": sample_size,
                "note": note,
            }
            if predict_errors:
                result["n_model_scoring_errors"] = predict_errors
            return result
        except Exception as exc:  # noqa: BLE001
            return {
                "method": "unavailable",
                "note": f"KernelSHAP failed: {exc}",
            }

    # -----------------------------------------------------------------
    # Combine perturbation + SHAP into a final verdict (plan Section 5.7)
    # -----------------------------------------------------------------
    def audit(
        self,
        candidates: list[Candidate],
        field_name: str,
        biased_value,
        skill_fields: list[str],
        pedigree_fields: list[str],
        feature_cols: list[str],
    ) -> AuditVerdict:
        perturbation = self.perturb_field(candidates, field_name, biased_value)
        shap_result = self.skill_vs_pedigree_split(candidates, skill_fields, pedigree_fields, feature_cols)

        if not perturbation.statistically_significant:
            verdict = "Justified (no significant effect detected)"
        elif shap_result.get("method") == "unavailable":
            verdict = "Inconclusive (perturbation significant, but SHAP unavailable to confirm root cause)"
        elif shap_result["pedigree_reliance_pct"] >= 40:
            verdict = "Confirmed bias (pedigree-driven)"
        elif shap_result["pedigree_reliance_pct"] >= 20:
            verdict = "Confirmed bias (partial pedigree reliance)"
        else:
            verdict = "Justified (skill-driven, minor field-specific leak)"

        return AuditVerdict(
            field_tested=field_name,
            perturbation=perturbation,
            skill_vs_pedigree=shap_result,
            verdict=verdict,
            audit_mode="perturbation",
        )

    # -----------------------------------------------------------------
    # Orchestration-facing bridging methods
    #
    # orchestration/graph.py (added when wiring the FastAPI + LangGraph
    # layer up to this class) calls run_perturbation_suite / run_shap_summary
    # / run_statistical_audit / apply_mitigation directly on raw pipeline
    # records (plain dicts). These thin wrappers convert records ->
    # Candidate and fan out to the primitives above, rather than making the
    # graph layer duplicate that conversion logic in three places.
    # -----------------------------------------------------------------
    def run_perturbation_suite(
        self, records: list[dict], fields: Optional[list[str]] = None
    ) -> list[dict]:
        """Run perturb_field() for every bias-relevant field that's actually
        present in this batch, and return JSON-serializable results."""
        candidates = [candidate_from_record(r) for r in records]
        if not candidates:
            return []

        n_total = len(candidates)
        if n_total > MAX_PERTURBATION_CANDIDATES:
            step = max(1, n_total // MAX_PERTURBATION_CANDIDATES)
            candidates = candidates[::step][:MAX_PERTURBATION_CANDIDATES]

        test_fields = fields or [
            f for f in BIAS_FIELDS
            if any(c.features.get(f) not in (None, "") for c in candidates)
        ]

        results = []
        for f in test_fields:
            observed_values = [c.features.get(f) for c in candidates if c.features.get(f) not in (None, "")]
            if not observed_values:
                continue
            distinct = list(dict.fromkeys(observed_values))
            swap_value = distinct[-1] if len(distinct) > 1 else distinct[0]
            try:
                pr = self.perturb_field(candidates, f, swap_value)
                result_dict = asdict(pr)
                result_dict["n_candidates_total"] = n_total
                result_dict["n_candidates_tested"] = len(candidates)
                results.append(result_dict)
            except Exception as e:  # noqa: BLE001
                results.append({"field_tested": f, "error": str(e)})
        return results

    def run_shap_summary(
        self,
        records: list[dict],
        feature_cols: Optional[list[str]] = None,
        skill_fields: Optional[list[str]] = None,
        pedigree_fields: Optional[list[str]] = None,
    ) -> dict:
        """Candidate-record-friendly wrapper around skill_vs_pedigree_split()."""
        if self.model is None:
            return {"method": "unavailable", "note": "No model available for SHAP summary."}

        candidates = [candidate_from_record(r) for r in records]
        resolved_feature_cols = feature_cols or self.model.feature_columns
        resolved_skill = skill_fields or self.model.skill_fields
        resolved_pedigree = pedigree_fields or self.model.pedigree_fields

        if not resolved_feature_cols:
            return {
                "method": "unavailable",
                "note": "Model did not declare feature_columns for SHAP summary.",
            }

        n_total = len(candidates)
        if n_total > MAX_SHAP_CANDIDATES:
            step = max(1, n_total // MAX_SHAP_CANDIDATES)
            candidates = candidates[::step][:MAX_SHAP_CANDIDATES]

        result = self.skill_vs_pedigree_split(
            candidates,
            resolved_skill,
            resolved_pedigree,
            resolved_feature_cols,
        )
        result["n_candidates_total"] = n_total
        return result

    def apply_mitigation(self, model: ScoringModel, records: list[dict]):
        """
        Section 5.5: lightweight group mean score adjustment toward global
        mean. Returns a wrapped ScoringModel for before/after SHAP comparison.

        The returned model carries a `.mitigation_meta` dict (see
        interface/mitigated_model.compute_group_mean_adjustments) disclosing
        how many candidates were actually used to compute the adjustment —
        existing callers that only need `.score()` (unchanged contract) can
        ignore it; orchestration/graph.py's node_fix surfaces it in the API
        response for transparency.
        """
        from interface.mitigated_model import GroupAdjustedModel, compute_group_mean_adjustments

        adjustments, meta = compute_group_mean_adjustments(model, records)
        wrapped = GroupAdjustedModel(model, adjustments)
        wrapped.mitigation_meta = meta
        return wrapped

    # -----------------------------------------------------------------
    # Tier 3: Statistical-only mode (decisions only, no model access)
    # Static method since it doesn't need self.model at all.
    # -----------------------------------------------------------------
    def run_statistical_audit(
        self,
        records: list[dict],
        group_field: str = "college_tier",
        outcome_field: str = "shortlisted",
    ) -> dict:
        """
        Tier 3 (Section 5.6): four-fifths rule computed directly from prior
        decisions already present in the uploaded data — no model access
        required. Matched-pair statistics (Tier 3 depth) are listed in the
        README as "Not yet built" and are intentionally not faked here.
        """
        groups: dict[str, list] = {}
        for r in records:
            group_value = r.get(group_field)
            outcome_value = r.get(outcome_field)
            if group_value in (None, "") or outcome_value in (None, ""):
                continue
            groups.setdefault(str(group_value), []).append(outcome_value)

        def _is_positive_outcome(value) -> bool:
            return str(value).strip().lower() in (
                "1", "true", "yes", "shortlisted", "selected", "hired"
            )

        selection_rates = {
            g: (sum(1 for v in vals if _is_positive_outcome(v)) / len(vals))
            for g, vals in groups.items()
            if vals
        }

        if not selection_rates:
            # Whole-column-missing case, same principle as node_score in
            # orchestration/graph.py: if group_field or outcome_field is
            # absent for every record, that's not a per-candidate gap to
            # route around - it's a "this dataset has no usable column for
            # this comparison" problem, so say so plainly rather than
            # silently returning an empty, misleadingly-clean-looking report.
            return {
                "group_field": group_field,
                "outcome_field": outcome_field,
                "error": (
                    f"statistical_audit_failed: no records have both "
                    f"'{group_field}' and '{outcome_field}' present. Upload "
                    f"these columns directly (or a recognized synonym - see "
                    f"pipeline/translation_layer.py's SYNONYM_MAP) to run a "
                    f"Tier 3 audit on this field."
                ),
                "n_groups": 0,
                "selection_rates": {},
            }

        demographic_parity = self.demographic_parity(selection_rates)
        matched_pair = self.simplified_matched_pair(
            records, group_field=group_field, outcome_field=outcome_field
        )

        return {
            "group_field": group_field,
            "outcome_field": outcome_field,
            "n_groups": len(selection_rates),
            "selection_rates": selection_rates,
            "four_fifths_rule": self.four_fifths_rule(selection_rates),
            "demographic_parity": demographic_parity,
            "matched_pair": matched_pair,
        }

    @staticmethod
    def demographic_parity(
        selection_rates: dict[str, float],
        threshold: float = DEMOGRAPHIC_PARITY_THRESHOLD,
    ) -> dict:
        """
        Demographic parity difference: max selection rate minus min rate.
        Flag when the gap exceeds the configured threshold.
        """
        if len(selection_rates) < 2:
            return {
                "difference": 0.0,
                "max_rate": max(selection_rates.values()) if selection_rates else 0.0,
                "min_rate": min(selection_rates.values()) if selection_rates else 0.0,
                "flag": False,
                "threshold": threshold,
            }

        max_rate = max(selection_rates.values())
        min_rate = min(selection_rates.values())
        difference = max_rate - min_rate
        return {
            "difference": round(difference, 4),
            "max_rate": round(max_rate, 4),
            "min_rate": round(min_rate, 4),
            "flag": difference >= threshold,
            "threshold": threshold,
        }

    @staticmethod
    def simplified_matched_pair(
        records: list[dict],
        group_field: str = "college_tier",
        outcome_field: str = "shortlisted",
        score_field: str = "screening_score",
        bin_width: float = 5.0,
    ) -> dict:
        """
        Simplified matched-pair: pair candidates on screening_score bins (±5 pts)
        and compare shortlisted rates across college_tier groups via Fisher's exact.
        """
        def _is_positive(value) -> bool:
            return str(value).strip().lower() in (
                "1", "true", "yes", "shortlisted", "selected", "hired"
            )

        eligible = [
            r for r in records
            if r.get(group_field) not in (None, "")
            and r.get(outcome_field) not in (None, "")
            and r.get(score_field) not in (None, "")
        ]
        if len(eligible) < 4:
            return {
                "method": "simplified_matched_pair",
                "flag": False,
                "note": "Insufficient records with group, outcome, and score fields.",
                "n_pairs": 0,
            }

        try:
            scores = [float(r[score_field]) for r in eligible]
        except (TypeError, ValueError):
            return {
                "method": "simplified_matched_pair",
                "flag": False,
                "note": f"Non-numeric values in {score_field}.",
                "n_pairs": 0,
            }

        min_score = min(scores)
        bins: dict[int, list[dict]] = {}
        for record in eligible:
            score = float(record[score_field])
            bin_idx = int((score - min_score) // bin_width)
            bins.setdefault(bin_idx, []).append(record)

        group_values = sorted({str(r[group_field]) for r in eligible})
        if len(group_values) < 2:
            return {
                "method": "simplified_matched_pair",
                "flag": False,
                "note": "Need at least two groups for matched-pair comparison.",
                "n_pairs": 0,
            }

        ref_group, comp_group = group_values[0], group_values[1]
        ref_selected = ref_not = comp_selected = comp_not = 0
        n_pairs = 0

        for bin_records in bins.values():
            ref_in_bin = [r for r in bin_records if str(r[group_field]) == ref_group]
            comp_in_bin = [r for r in bin_records if str(r[group_field]) == comp_group]
            if not ref_in_bin or not comp_in_bin:
                continue
            n_pairs += 1
            ref_selected += sum(1 for r in ref_in_bin if _is_positive(r[outcome_field]))
            ref_not += sum(1 for r in ref_in_bin if not _is_positive(r[outcome_field]))
            comp_selected += sum(1 for r in comp_in_bin if _is_positive(r[outcome_field]))
            comp_not += sum(1 for r in comp_in_bin if not _is_positive(r[outcome_field]))

        if n_pairs == 0 or (ref_selected + ref_not + comp_selected + comp_not) == 0:
            return {
                "method": "simplified_matched_pair",
                "flag": False,
                "note": "No comparable score bins with both groups present.",
                "n_pairs": 0,
            }

        table = [[ref_selected, ref_not], [comp_selected, comp_not]]
        _, p_value = stats.fisher_exact(table)
        p_value = float(p_value)  # scipy returns numpy.float64 except at the
        # exact 0.0/1.0 edge cases, where it silently returns a plain float.
        # Casting unconditionally here (not just at the edges) is what
        # actually closes the bug — comparing a numpy.float64 to a Python
        # float below would otherwise yield numpy.bool_, which FastAPI/
        # pydantic cannot JSON-serialize.

        return {
            "method": "simplified_matched_pair",
            "flag": bool(p_value < 0.05),
            "p_value": round(p_value, 6),
            "n_pairs": n_pairs,
            "reference_group": ref_group,
            "comparison_group": comp_group,
            "contingency_table": table,
            "assumptions": (
                f"Paired on {score_field} bins of width {bin_width}; "
                "compares selection rates within bins across two groups."
            ),
        }

    @staticmethod
    def four_fifths_rule(group_selection_rates: dict[str, float]) -> dict:
        """
        EEOC four-fifths rule: if any group's selection rate is below 80%
        of the highest group's rate, that's evidence of adverse impact.
        group_selection_rates: e.g. {"tier_1": 0.65, "tier_3": 0.22}
        """
        if not group_selection_rates:
            return {"flag": False, "ratios": {}}
        max_rate = max(group_selection_rates.values())
        ratios = {g: (rate / max_rate if max_rate > 0 else 0) for g, rate in group_selection_rates.items()}
        flagged = {g: r for g, r in ratios.items() if r < 0.8}
        return {
            "flag": len(flagged) > 0,
            "ratios": ratios,
            "flagged_groups": flagged,
        }
