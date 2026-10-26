"""
Audit Agent — NOT a trained model. A statistics + rules engine that works
against ANY ScoringModel (own Hiring Agent or an external one via the
adapter), per the plan's model-agnostic architecture (Section 5.5-5.7).

This module must NEVER import agents.hiring_agent directly. It only ever
talks through interface.model_interface.ScoringModel. That's what makes it
provably reusable on external models.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional

import numpy as np
from scipy import stats

from agents.fairness_stats import (
    MIN_GROUP_SIZE,
    cmh_test,
    group_label,
    grouping_description,
    holm_adjust,
    is_missing,
    is_positive_outcome,
    representative_value,
)
from core.config import (
    CHECKSUM_ENABLE_KERNEL_SHAP,
    DEMOGRAPHIC_PARITY_THRESHOLD,
    MAX_KERNEL_SHAP_BACKGROUND,
    MAX_KERNEL_SHAP_CANDIDATES,
    MAX_PERTURBATION_CANDIDATES,
    MAX_SHAP_CANDIDATES,
)
from core.thresholds import load_audit_thresholds, severity_band
from interface.model_interface import (
    Candidate,
    ExplainabilityMethod,
    ScoringModel,
    candidate_from_record,
)
from pipeline.translation_layer import BIAS_FIELDS

# Default skill vs. pedigree split used when a model does not declare its own.
SKILL_FIELDS = ["screening_score", "experience_years"]
PEDIGREE_FIELDS = ["college_tier", "is_metro", "career_gap_months"]

# A perturbation comparison needs at least this many candidates in the
# group being moved, otherwise its p-value is meaningless.
MIN_PERTURBATION_GROUP = 5

# Fallback when calibrated_thresholds.json is missing (see core/thresholds.py).
DEFAULT_THRESHOLDS = {
    "p_value_cutoff": 0.05,
    "low_effect_pts": 5.0,
    "high_effect_pts": 15.0,
}


def _even_sample(items: list, k: int) -> list:
    """Evenly spaced sample (not the first k rows, which can be biased when an
    upload is sorted by score or by group)."""
    if len(items) <= k:
        return list(items)
    idx = np.linspace(0, len(items) - 1, k).round().astype(int)
    return [items[i] for i in dict.fromkeys(idx.tolist())]


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
    skill_vs_pedigree: Optional[dict]
    verdict: str
    audit_mode: str


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
        new_value, re-score via the model, measure the delta.
        """
        originals = self.model.score_batch(candidates)
        perturbed = self.model.score_batch(
            [c.with_perturbed_field(field_name, new_value) for c in candidates]
        )
        return self._paired_result(field_name, originals, perturbed)

    def _paired_result(self, field_name, originals, perturbed, significant_override=None):
        """Pair original/perturbed scores (skipping any that failed to score)
        and run the Wilcoxon signed-rank test on them."""
        paired = [
            (o, p) for o, p in zip(originals, perturbed)
            if o.score is not None and p.score is not None
        ]
        n_scoring_errors = len(originals) - len(paired)

        if not paired:
            return PerturbationResult(
                field_tested=field_name, n_candidates=0, avg_delta_pts=0.0,
                median_delta_pts=0.0, std_dev=0.0, min_delta_pts=0.0, max_delta_pts=0.0,
                wilcoxon_statistic=0.0, p_value=1.0, statistically_significant=False,
                severity="LOW", per_candidate_deltas=[], n_scoring_errors=n_scoring_errors,
                note=(
                    "No candidates could be scored for this field - every "
                    "scoring attempt failed (see the model's error messages "
                    "in the underlying score results)."
                ),
            )

        deltas = np.array([p.score - o.score for o, p in paired])
        if np.any(deltas != 0):
            stat, p_value = stats.wilcoxon(
                np.array([o.score for o, _ in paired]),
                np.array([p.score for _, p in paired]),
            )
        else:
            stat, p_value = 0.0, 1.0

        significant = bool(p_value < self.thresholds["p_value_cutoff"])
        if significant_override is not None:
            significant = significant_override
        avg_delta = float(np.mean(deltas))

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
            severity=self._severity(abs(avg_delta), significant),
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
    # SHAP-based skill-vs-pedigree split
    # -----------------------------------------------------------------
    def skill_vs_pedigree_split(
        self,
        candidates: list[Candidate],
        skill_fields: list[str],
        pedigree_fields: list[str],
        feature_cols: list[str],
        force_kernel: bool = False,
    ) -> dict:
        """
        Native TreeExplainer when the model exposes an underlying estimator;
        otherwise KernelSHAP. `force_kernel=True` makes the result directly
        comparable with a KernelSHAP run on a wrapped/mitigated model
        (TreeExplainer reports log-odds, KernelSHAP here reports probability
        - the two percentages are NOT comparable with each other).
        """
        import pandas as pd
        import shap

        from interface.mitigated_model import GroupAdjustedModel

        if not feature_cols:
            return {"method": "unavailable", "note": "No feature columns declared."}

        use_native = (
            not force_kernel
            and self.model.supports_native_explainability
            and not isinstance(self.model, GroupAdjustedModel)
        )

        if use_native:
            underlying = getattr(self.model, "_model", None)
            if underlying is None:
                return {"method": "unavailable", "note": "No underlying estimator exposed for SHAP."}

            rows, n_skipped = self._numeric_rows(candidates, feature_cols)
            if not rows:
                return {
                    "method": "unavailable",
                    "note": (
                        f"No candidate had all required features present and "
                        f"numeric ({n_skipped} skipped)."
                    ),
                }

            X = pd.DataFrame(rows, columns=feature_cols).astype(float)
            shap_values = shap.TreeExplainer(underlying).shap_values(X)
            importance = dict(zip(feature_cols, np.abs(shap_values).mean(axis=0).tolist()))
            result = self._split_summary(
                importance, skill_fields, pedigree_fields,
                ExplainabilityMethod.NATIVE_SHAP.value,
            )
            result.update({
                "units": "log-odds",
                "n_candidates_tested": len(rows),
                "n_candidates_total": len(candidates),
            })
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

    @staticmethod
    def _numeric_rows(candidates: list[Candidate], feature_cols: list[str]):
        rows, n_skipped = [], 0
        for c in candidates:
            try:
                rows.append({col: float(c.features.get(col)) for col in feature_cols})
            except (TypeError, ValueError):
                n_skipped += 1
        return rows, n_skipped

    @staticmethod
    def _split_summary(importance, skill_fields, pedigree_fields, method) -> dict:
        skill_weight = sum(importance.get(f, 0) for f in skill_fields)
        pedigree_weight = sum(importance.get(f, 0) for f in pedigree_fields)
        total = skill_weight + pedigree_weight or 1e-9
        return {
            "method": method,
            "feature_importances": importance,
            "skill_reliance_pct": round(skill_weight / total * 100, 1),
            "pedigree_reliance_pct": round(pedigree_weight / total * 100, 1),
        }

    def _kernel_shap_split(
        self,
        candidates: list[Candidate],
        skill_fields: list[str],
        pedigree_fields: list[str],
        feature_cols: list[str],
    ) -> dict:
        """Sample-limited KernelSHAP for query-only or wrapped models.

        The prediction function scores each synthetic batch with ONE
        score_batch() call (vectorized for the Hiring Agent), instead of one
        model call per row, which made the Fix step take minutes.
        """
        import shap

        if self.model is None:
            return {"method": "unavailable", "note": "No model for KernelSHAP."}

        usable = [c for c in candidates if self._numeric_rows([c], feature_cols)[1] == 0]
        n_skipped = len(candidates) - len(usable)
        if not usable:
            return {"method": "unavailable", "note": "No candidate had all features numeric."}

        sampled = _even_sample(usable, MAX_KERNEL_SHAP_CANDIDATES)
        background = _even_sample(usable, MAX_KERNEL_SHAP_BACKGROUND)
        predict_errors = 0

        def predict_fn(X: np.ndarray) -> np.ndarray:
            nonlocal predict_errors
            batch = [
                Candidate(candidate_id="kernel_shap", features=dict(zip(feature_cols, row.tolist())))
                for row in np.atleast_2d(X)
            ]
            out = []
            for res in self.model.score_batch(batch):
                if res.score is None:
                    predict_errors += 1
                    out.append(0.0)
                else:
                    out.append(res.score / 100.0)
            return np.array(out)

        bg = np.array([[float(c.features[col]) for col in feature_cols] for c in background])
        xs = np.array([[float(c.features[col]) for col in feature_cols] for c in sampled])

        try:
            explainer = shap.KernelExplainer(predict_fn, bg)
            shap_values = explainer.shap_values(xs, nsamples=100)
            importance = dict(zip(feature_cols, np.abs(np.asarray(shap_values)).mean(axis=0).tolist()))
        except Exception as exc:  # noqa: BLE001
            return {"method": "unavailable", "note": f"KernelSHAP failed: {exc}"}

        result = self._split_summary(
            importance, skill_fields, pedigree_fields,
            ExplainabilityMethod.KERNEL_SHAP_APPROX.value,
        )
        note = (
            f"KernelSHAP on an evenly spaced sample of {len(sampled)} candidates "
            f"against {len(background)} background candidates (probability scale)."
        )
        if predict_errors:
            note += (
                f" {predict_errors} underlying model call(s) failed during SHAP "
                f"sampling and were treated as a neutral score."
            )
            result["n_model_scoring_errors"] = predict_errors
        if n_skipped:
            result["n_candidates_skipped"] = n_skipped
        result.update({
            "units": "probability",
            "n_candidates_tested": len(sampled),
            "n_candidates_total": len(candidates),
            "sample_size": len(sampled),
            "background_size": len(background),
            "note": note,
        })
        return result

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
    # Orchestration-facing methods (operate on raw pipeline records)
    # -----------------------------------------------------------------
    def run_perturbation_suite(
        self, records: list[dict], fields: Optional[list[str]] = None
    ) -> list[dict]:
        """
        For every bias field present: find the most-favoured group (highest
        mean score), then move every candidate from each OTHER group into it,
        changing nothing else, and measure how their score changes.

        A positive avg_delta_pts therefore means "candidates in this group
        would have scored higher if they were in the most-favoured group".

        Every candidate is scored ONCE up front and those scores are reused
        for every field (this matters for external models billed per call).
        Fields the model doesn't take as input are reported as
        status="not_model_input" instead of a misleading "no effect".
        """
        candidates = [candidate_from_record(r) for r in records]
        if not candidates:
            return []

        n_total = len(candidates)
        candidates = _even_sample(candidates, MAX_PERTURBATION_CANDIDATES)
        base_results = self.model.score_batch(candidates)
        model_inputs = set(self.model.feature_columns or [])

        test_fields = fields or [
            f for f in BIAS_FIELDS
            if any(not is_missing(c.features.get(f)) for c in candidates)
        ]

        results = []
        for f in test_fields:
            common = {
                "field_tested": f,
                "n_candidates_total": n_total,
                "n_candidates_tested": len(candidates),
                "grouping": grouping_description(f),
            }
            if model_inputs and f not in model_inputs:
                results.append(self._not_tested(common, "not_model_input", (
                    f"'{f}' is not an input to this model, so changing it cannot "
                    f"change the score. This does NOT rule out bias: the model "
                    f"can still disadvantage this group through correlated "
                    f"inputs (proxies). Use the statistical audit on actual "
                    f"outcomes to check for that."
                )))
                continue
            try:
                results.append(self._perturb_field_by_group(f, candidates, base_results, common))
            except Exception as e:  # noqa: BLE001
                results.append({**common, "status": "error", "error": str(e)})
        return results

    @staticmethod
    def _not_tested(common: dict, status: str, note: str) -> dict:
        return {
            **common,
            "status": status,
            "n_candidates": 0,
            "avg_delta_pts": 0.0,
            "median_delta_pts": 0.0,
            "std_dev": 0.0,
            "min_delta_pts": 0.0,
            "max_delta_pts": 0.0,
            "wilcoxon_statistic": 0.0,
            "p_value": 1.0,
            "statistically_significant": False,
            "severity": "NOT_TESTED",
            "per_candidate_deltas": [],
            "n_scoring_errors": 0,
            "note": note,
            "comparisons": [],
        }

    def _perturb_field_by_group(self, f, candidates, base_results, common) -> dict:
        members: dict[str, list[int]] = {}
        raw_values: dict[str, list] = {}
        for i, c in enumerate(candidates):
            label = group_label(f, c.features.get(f))
            if label is None:
                continue
            members.setdefault(label, []).append(i)
            raw_values.setdefault(label, []).append(c.features.get(f))

        if len(members) < 2:
            return self._not_tested(common, "single_group", (
                f"Only one group of '{f}' is present in this data, so there is "
                f"nothing to compare against."
            ))

        def mean_score(idxs):
            vals = [base_results[i].score for i in idxs if base_results[i].score is not None]
            return float(np.mean(vals)) if vals else float("-inf")

        sized = [g for g, idxs in members.items() if len(idxs) >= MIN_PERTURBATION_GROUP]
        pool = sized if sized else list(members)
        reference = max(pool, key=lambda g: (mean_score(members[g]), len(members[g])))
        ref_value = representative_value(f, raw_values[reference])

        comparisons = []
        for g, idxs in members.items():
            if g == reference:
                continue
            originals = [base_results[i] for i in idxs]
            perturbed = self.model.score_batch(
                [candidates[i].with_perturbed_field(f, ref_value) for i in idxs]
            )
            pr = self._paired_result(f, originals, perturbed)
            comparisons.append({
                "from_group": g,
                "to_group": reference,
                "to_value": ref_value,
                "comparison_label": f"{g} → {reference}",
                "n_in_group": len(idxs),
                "too_small": len(idxs) < MIN_PERTURBATION_GROUP,
                "result": pr,
            })

        # Holm correction across this field's comparisons; tiny groups can
        # be shown but never flagged.
        adjusted = holm_adjust([c["result"].p_value for c in comparisons])
        for c, p_adj in zip(comparisons, adjusted):
            pr = c["result"]
            sig = bool(p_adj < self.thresholds["p_value_cutoff"]) and not c["too_small"]
            pr.statistically_significant = sig
            pr.severity = self._severity(abs(pr.avg_delta_pts), sig)
            c["p_value_adjusted"] = float(p_adj)

        significant = [c for c in comparisons if c["result"].statistically_significant]
        headline = max(significant or comparisons, key=lambda c: abs(c["result"].avg_delta_pts))

        out = asdict(headline["result"])
        out.update(common)
        out.update({
            "status": "tested",
            "reference_group": reference,
            "from_group": headline["from_group"],
            "to_group": reference,
            "to_value": ref_value,
            "comparison_label": headline["comparison_label"],
            "p_value_adjusted": headline["p_value_adjusted"],
            "comparisons": [
                {
                    "from_group": c["from_group"],
                    "to_group": c["to_group"],
                    "to_value": c["to_value"],
                    "comparison_label": c["comparison_label"],
                    "n_in_group": c["n_in_group"],
                    "too_small": c["too_small"],
                    "n_candidates": c["result"].n_candidates,
                    "avg_delta_pts": c["result"].avg_delta_pts,
                    "median_delta_pts": c["result"].median_delta_pts,
                    "p_value": c["result"].p_value,
                    "p_value_adjusted": c["p_value_adjusted"],
                    "statistically_significant": c["result"].statistically_significant,
                    "severity": c["result"].severity,
                    "n_scoring_errors": c["result"].n_scoring_errors,
                }
                for c in comparisons
            ],
        })
        return out

    def run_shap_summary(
        self,
        records: list[dict],
        feature_cols: Optional[list[str]] = None,
        skill_fields: Optional[list[str]] = None,
        pedigree_fields: Optional[list[str]] = None,
        force_kernel: bool = False,
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
                "note": (
                    "This model did not declare which input features it uses, so "
                    "feature attribution (SHAP) can't be computed. The perturbation "
                    "tests above still measure how each field changes its scores."
                ),
            }

        n_total = len(candidates)
        candidates = _even_sample(candidates, MAX_SHAP_CANDIDATES)
        result = self.skill_vs_pedigree_split(
            candidates, resolved_skill, resolved_pedigree, resolved_feature_cols,
            force_kernel=force_kernel,
        )
        result["n_candidates_total"] = n_total
        return result

    def apply_mitigation(self, model: ScoringModel, records: list[dict], group_field: str = "college_tier"):
        """
        Lightweight group-mean score adjustment toward the global mean.
        Returns a wrapped ScoringModel carrying `.mitigation_meta`.
        """
        from interface.mitigated_model import GroupAdjustedModel, compute_group_mean_adjustments

        adjustments, meta = compute_group_mean_adjustments(model, records, group_field=group_field)
        wrapped = GroupAdjustedModel(model, adjustments, group_field=group_field)
        meta["group_field"] = group_field
        wrapped.mitigation_meta = meta
        return wrapped

    # -----------------------------------------------------------------
    # Tier 3: Statistical-only mode (decisions only, no model access)
    # -----------------------------------------------------------------
    def run_statistical_audit(
        self,
        records: list[dict],
        group_field: str = "college_tier",
        outcome_field: str = "shortlisted",
        min_group_size: Optional[int] = None,
    ) -> dict:
        """
        Four-fifths rule, demographic parity and a stratified matched
        comparison for ONE group field, computed from uploaded decisions.

        Continuous fields are grouped into ranges first, and groups smaller
        than `min_group_size` (default CHECKSUM_MIN_GROUP_SIZE=30) are shown
        but never used to raise a flag.
        """
        min_n = MIN_GROUP_SIZE if min_group_size is None else min_group_size

        groups: dict[str, list] = {}
        for r in records:
            label = group_label(group_field, r.get(group_field))
            outcome_value = r.get(outcome_field)
            if label is None or is_missing(outcome_value):
                continue
            groups.setdefault(label, []).append(outcome_value)

        if not groups:
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

        sizes = {g: len(v) for g, v in groups.items()}
        selected = {g: sum(1 for v in vals if is_positive_outcome(v)) for g, vals in groups.items()}
        selection_rates = {g: selected[g] / sizes[g] for g in groups}
        eligible_rates = {g: r for g, r in selection_rates.items() if sizes[g] >= min_n}
        small = sorted(g for g in groups if sizes[g] < min_n)

        parity = self.demographic_parity(eligible_rates)
        if len(eligible_rates) < 2:
            parity["note"] = (
                f"Needs at least two groups with {min_n}+ candidates to compare."
            )
        elif parity["difference"] > 0:
            hi = max(eligible_rates, key=eligible_rates.get)
            lo = min(eligible_rates, key=eligible_rates.get)
            table = [[selected[hi], sizes[hi] - selected[hi]], [selected[lo], sizes[lo] - selected[lo]]]
            p = float(stats.fisher_exact(table)[1])
            parity["p_value"] = round(p, 6)
            parity["gap_exceeds_threshold"] = parity["flag"]
            parity["flag"] = bool(parity["flag"] and p < 0.05)

        return {
            "group_field": group_field,
            "outcome_field": outcome_field,
            "grouping": grouping_description(group_field),
            "n_groups": len(selection_rates),
            "selection_rates": selection_rates,
            "group_sizes": sizes,
            "min_group_size": min_n,
            "insufficient_sample_groups": small,
            "four_fifths_rule": self.four_fifths_rule(
                selection_rates, group_sizes=sizes, min_group_size=min_n,
                selected_counts=selected,
            ),
            "demographic_parity": parity,
            "matched_pair": self.simplified_matched_pair(
                records, group_field=group_field, outcome_field=outcome_field,
                min_group_size=min_n,
            ),
        }

    def run_multi_field_statistical_audit(
        self,
        records: list[dict],
        group_fields: Optional[list[str]] = None,
        outcome_field: str = "shortlisted",
    ) -> dict:
        """
        Runs run_statistical_audit() for EVERY bias field present. The
        primary field (college_tier if present) keeps the original top-level
        shape; every other field goes under "additional_group_audits".
        "fields_flagged" lists every field where any test raised a flag.
        """
        fields_to_check = group_fields or list(BIAS_FIELDS)
        fields_present = [
            f for f in fields_to_check
            if any(not is_missing(r.get(f)) for r in records)
        ]

        if not fields_present:
            return self.run_statistical_audit(records, group_field="college_tier", outcome_field=outcome_field)

        primary_field = "college_tier" if "college_tier" in fields_present else fields_present[0]
        primary_result = self.run_statistical_audit(
            records, group_field=primary_field, outcome_field=outcome_field
        )

        additional_results: dict[str, dict] = {}
        for f in fields_present:
            if f == primary_field:
                continue
            result = self.run_statistical_audit(records, group_field=f, outcome_field=outcome_field)
            if result.get("n_groups", 0) >= 2:
                additional_results[f] = result

        self._adjust_across_fields({primary_field: primary_result, **additional_results})

        def flagged(res: dict) -> bool:
            return bool(
                (res.get("four_fifths_rule") or {}).get("flag")
                or (res.get("demographic_parity") or {}).get("flag")
                or (res.get("matched_pair") or {}).get("flag")
            )

        primary_result["additional_group_audits"] = additional_results
        primary_result["fields_flagged"] = [
            f for f, res in [(primary_field, primary_result), *additional_results.items()]
            if flagged(res)
        ]
        return primary_result

    @staticmethod
    def _adjust_across_fields(results_by_field: dict[str, dict]) -> None:
        """Holm-adjust each test's p-value across all audited factors, so
        running the same test on five factors doesn't produce chance flags.
        Updates flags in place and records p_value_audit_adjusted."""
        for test in ("four_fifths_rule", "demographic_parity", "matched_pair"):
            # Every factor where the test was actually evaluated counts as a
            # hypothesis; one with no finding contributes p = 1.
            entries = []
            for f, res in results_by_field.items():
                t = res.get(test)
                if not isinstance(t, dict):
                    continue
                if t.get("p_value") is not None:
                    entries.append((t, float(t["p_value"])))
                elif t.get("evaluated"):
                    entries.append((t, 1.0))
            if len(entries) < 2:
                continue
            adjusted = holm_adjust([p for _, p in entries])
            for (t, _), p_adj in zip(entries, adjusted):
                t["p_value_audit_adjusted"] = round(float(p_adj), 6)
                if t.get("flag") and p_adj >= 0.05:
                    t["flag"] = False
                    t["note"] = (
                        "Difference found, but not significant once corrected for "
                        "testing several factors at once."
                    )
                    if test == "four_fifths_rule":
                        t.setdefault("below_four_fifths_not_significant", {}).update(
                            t.get("flagged_groups") or {}
                        )
                        t["flagged_groups"] = {}

    @staticmethod
    def demographic_parity(
        selection_rates: dict[str, float],
        threshold: float = DEMOGRAPHIC_PARITY_THRESHOLD,
    ) -> dict:
        """Max selection rate minus min rate; flag when above the threshold."""
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
            "flag": bool(difference >= threshold),
            "threshold": threshold,
        }

    @staticmethod
    def simplified_matched_pair(
        records: list[dict],
        group_field: str = "college_tier",
        outcome_field: str = "shortlisted",
        score_field: str = "screening_score",
        bin_width: float = 5.0,
        min_group_size: int = 1,
    ) -> dict:
        """
        Like-for-like comparison: candidates are put into screening-score
        bands (default width 5 pts), and within each band every group is
        compared with the reference group (highest overall selection rate)
        using the Cochran-Mantel-Haenszel test. Bands are kept separate rather
        than pooled, so differences in score mix between groups can't hide or
        reverse the result. p-values are Holm-adjusted across comparisons.
        """
        eligible = []
        for r in records:
            label = group_label(group_field, r.get(group_field))
            if label is None or is_missing(r.get(outcome_field)):
                continue
            try:
                score = float(r.get(score_field))
            except (TypeError, ValueError):
                continue
            eligible.append((label, score, is_positive_outcome(r.get(outcome_field))))

        base = {"method": "simplified_matched_pair", "test": "cochran_mantel_haenszel"}
        if len(eligible) < 4:
            return {**base, "flag": False, "n_pairs": 0,
                    "note": "Insufficient records with group, outcome, and numeric score fields."}

        sizes: dict[str, int] = {}
        selected: dict[str, int] = {}
        for label, _, sel in eligible:
            sizes[label] = sizes.get(label, 0) + 1
            selected[label] = selected.get(label, 0) + int(sel)
        groups = [g for g in sizes if sizes[g] >= min_group_size]
        if len(groups) < 2:
            return {**base, "flag": False, "n_pairs": 0,
                    "note": f"Need at least two groups with {min_group_size}+ candidates."}

        reference = max(groups, key=lambda g: (selected[g] / sizes[g], sizes[g]))
        min_score = min(s for _, s, _ in eligible)
        bands: dict[int, dict[str, list[int]]] = {}
        for label, score, sel in eligible:
            band = int((score - min_score) // bin_width)
            cell = bands.setdefault(band, {}).setdefault(label, [0, 0])
            cell[0 if sel else 1] += 1

        comparisons = []
        for comp in groups:
            if comp == reference:
                continue
            strata, pooled = [], [[0, 0], [0, 0]]
            for band in bands.values():
                if reference in band and comp in band:
                    table = [list(band[reference]), list(band[comp])]
                    strata.append(table)
                    for i in range(2):
                        for j in range(2):
                            pooled[i][j] += table[i][j]
            res = cmh_test(strata)
            comparisons.append({
                "reference_group": reference,
                "comparison_group": comp,
                "p_value_raw": round(res["p_value"], 6),
                "common_odds_ratio": res["common_odds_ratio"],
                "n_pairs": res["n_strata"],
                "contingency_table": pooled,
            })

        adjusted = holm_adjust([c["p_value_raw"] for c in comparisons])
        for c, p_adj in zip(comparisons, adjusted):
            c["p_value"] = round(float(p_adj), 6)
            c["flag"] = bool(p_adj < 0.05 and c["n_pairs"] > 0)

        headline = min(comparisons, key=lambda c: c["p_value"])
        if headline["n_pairs"] == 0:
            return {**base, "flag": False, "n_pairs": 0, "reference_group": reference,
                    "comparisons": comparisons,
                    "note": "No score bands contain both the reference group and another group."}

        return {
            **base,
            "flag": headline["flag"],
            "p_value": headline["p_value"],
            "n_pairs": headline["n_pairs"],
            "reference_group": reference,
            "comparison_group": headline["comparison_group"],
            "contingency_table": headline["contingency_table"],
            "common_odds_ratio": headline["common_odds_ratio"],
            "comparisons": comparisons,
            "assumptions": (
                f"Candidates grouped into {score_field} bands of width {bin_width}; "
                f"each group compared with the reference group '{reference}' within "
                f"bands (Cochran-Mantel-Haenszel), Holm-adjusted across "
                f"{len(comparisons)} comparison(s). n_pairs = number of score bands used."
            ),
        }

    @staticmethod
    def four_fifths_rule(
        group_selection_rates: dict[str, float],
        group_sizes: Optional[dict[str, int]] = None,
        min_group_size: int = 0,
        selected_counts: Optional[dict[str, int]] = None,
        alpha: float = 0.05,
    ) -> dict:
        """
        EEOC four-fifths rule: a group whose selection rate is below 80% of
        the highest group's rate is evidence of adverse impact. Groups with
        fewer than `min_group_size` candidates are excluded from the
        comparison (listed in insufficient_sample_groups).

        When group sizes and selected counts are supplied, a group is only
        flagged if its gap is ALSO statistically significant (Fisher's exact
        test vs the top group, Holm-adjusted). Ratios below 4/5 that could be
        chance are reported under below_four_fifths_not_significant.
        """
        if group_sizes and selected_counts:
            result = AuditAgent.four_fifths_rule(
                group_selection_rates, group_sizes, min_group_size
            )
            below = dict(result.get("flagged_groups") or {})
            result["evaluated"] = bool(result.get("ratios"))
            if not below:
                result["p_value"] = None
                return result
            top = max(result["ratios"], key=lambda g: (group_selection_rates[g], group_sizes[g]))
            n_top, s_top = group_sizes[top], selected_counts[top]
            raw = {}
            for g in below:
                table = [[s_top, n_top - s_top], [selected_counts[g], group_sizes[g] - selected_counts[g]]]
                raw[g] = float(stats.fisher_exact(table)[1])
            adjusted = dict(zip(raw, holm_adjust(list(raw.values()))))
            result["group_p_values"] = {g: round(p, 6) for g, p in adjusted.items()}
            result["flagged_groups"] = {g: r for g, r in below.items() if adjusted[g] < alpha}
            result["below_four_fifths_not_significant"] = {
                g: r for g, r in below.items() if adjusted[g] >= alpha
            }
            result["flag"] = bool(result["flagged_groups"])
            result["p_value"] = round(min(adjusted.values()), 6)
            result["reference_group"] = top
            return result

        if not group_selection_rates:
            return {"flag": False, "ratios": {}, "flagged_groups": {}}

        sizes = group_sizes or {}
        eligible = {
            g: r for g, r in group_selection_rates.items()
            if sizes.get(g, min_group_size) >= min_group_size
        }
        insufficient = sorted(g for g in group_selection_rates if g not in eligible)
        base = {"insufficient_sample_groups": insufficient, "min_group_size": min_group_size}

        if len(eligible) < 2:
            return {**base, "flag": False, "ratios": {}, "flagged_groups": {},
                    "note": f"Needs at least two groups with {min_group_size}+ candidates."}

        max_rate = max(eligible.values())
        if max_rate <= 0:
            return {**base, "flag": False, "ratios": {}, "flagged_groups": {},
                    "note": "No candidates were selected in any group, so selection-rate ratios are undefined."}

        ratios = {g: rate / max_rate for g, rate in eligible.items()}
        flagged = {g: r for g, r in ratios.items() if r < 0.8}
        return {**base, "flag": len(flagged) > 0, "ratios": ratios, "flagged_groups": flagged}
