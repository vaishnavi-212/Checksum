"""
Explanation Agent — plain-English summary of audit results (Section 6).

LLM usage is optional and non-critical. Template output satisfies the plan
guarantee that bias numbers never depend on LLM availability.
"""

from __future__ import annotations

from typing import Any, Optional

from core.config import CHECKSUM_LLM_ENABLED


class ExplanationAgent:
    """Deterministic explanation from structured audit outputs."""

    def explain(
        self,
        perturbation_results: Optional[list[dict]] = None,
        shap_summary: Optional[dict] = None,
        statistical_results: Optional[dict] = None,
        audit_mode: str = "statistical_only",
    ) -> str:
        if CHECKSUM_LLM_ENABLED:
            llm_text = self._try_llm_explain(
                perturbation_results, shap_summary, statistical_results, audit_mode
            )
            if llm_text:
                return llm_text

        if audit_mode == "perturbation":
            return self._explain_perturbation(perturbation_results or [], shap_summary or {})
        return self._explain_statistical(statistical_results or {})

    def _try_llm_explain(
        self,
        perturbation_results: Optional[list[dict]],
        shap_summary: Optional[dict],
        statistical_results: Optional[dict],
        audit_mode: str,
    ) -> Optional[str]:
        """Optional LLM backend — returns None to fall back to templates."""
        import os

        if not os.environ.get("OPENAI_API_KEY"):
            return None
        # Hook for future LLM integration; template path is plan-valid.
        return None

    def _explain_perturbation(
        self, perturbation_results: list[dict], shap_summary: dict
    ) -> str:
        lines = ["## Audit Summary (Perturbation Mode)", ""]

        skill_pct = shap_summary.get("skill_reliance_pct")
        pedigree_pct = shap_summary.get("pedigree_reliance_pct")
        if skill_pct is not None and pedigree_pct is not None:
            lines.append(
                f"The model's decision weight is approximately **{skill_pct:.0f}% skill-driven** "
                f"and **{pedigree_pct:.0f}% pedigree/proxy-driven** (native SHAP split)."
            )
            lines.append("")

        flagged = [
            r for r in perturbation_results
            if r.get("statistically_significant") and r.get("severity") in ("MED", "HIGH")
        ]
        if flagged:
            lines.append("### Fields with significant score movement")
            for result in flagged:
                field = result.get("field_tested", "unknown")
                avg_delta = result.get("avg_delta_pts", 0.0)
                severity = result.get("severity", "LOW")
                p_value = result.get("p_value")
                p_text = f", p={p_value:.4f}" if isinstance(p_value, (int, float)) else ""
                lines.append(
                    f"- **{field}**: average delta {avg_delta:+.1f} pts ({severity}{p_text})"
                )
        else:
            lines.append(
                "No bias-relevant fields showed both statistical and practical significance "
                "at the configured thresholds."
            )

        errors = [r for r in perturbation_results if r.get("error")]
        if errors:
            lines.append("")
            lines.append("Some fields could not be tested:")
            for result in errors:
                lines.append(f"- {result.get('field_tested')}: {result.get('error')}")

        return "\n".join(lines)

    def _explain_statistical(self, statistical_results: dict) -> str:
        lines = [
            "## Audit Summary (Statistics-Only Mode)",
            "",
            "No live model access was available. Checksum ran population-level "
            "group comparisons on uploaded decisions.",
            "",
        ]

        selection_rates = statistical_results.get("selection_rates") or {}
        if selection_rates:
            lines.append("### Selection rates by group")
            for group, rate in selection_rates.items():
                lines.append(f"- Group **{group}**: {rate * 100:.1f}% selected")
            lines.append("")

        four_fifths = statistical_results.get("four_fifths_rule") or {}
        if four_fifths.get("flag"):
            flagged = four_fifths.get("flagged_groups") or {}
            lines.append(
                "The **four-fifths rule** indicates potential adverse impact: "
                f"flagged groups {flagged}."
            )
        else:
            lines.append("The four-fifths rule did not flag adverse impact across groups.")

        parity = statistical_results.get("demographic_parity") or {}
        if parity.get("flag"):
            lines.append(
                f"**Demographic parity** gap of {parity.get('difference', 0) * 100:.1f}% "
                f"exceeds threshold ({parity.get('threshold', 0.15) * 100:.0f}%)."
            )

        matched = statistical_results.get("matched_pair") or {}
        if matched.get("flag"):
            lines.append(
                f"Simplified **matched-pair** test flagged disparity "
                f"(p={matched.get('p_value')}, {matched.get('n_pairs')} bins)."
            )
        elif matched.get("method"):
            lines.append(
                f"Simplified matched-pair: no significant disparity detected "
                f"({matched.get('n_pairs', 0)} comparable bins)."
            )

        return "\n".join(lines)
