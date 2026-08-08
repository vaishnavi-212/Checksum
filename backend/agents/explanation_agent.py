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
        """
        Optional LLM backend. Calls OpenAI's chat completion API to turn the
        same structured audit data used by the template methods below into
        a plain-language summary, grounded in those exact numbers (the
        model is given the already-computed template text as its source
        material, not asked to invent its own analysis).

        Returns None on ANY failure - missing key, missing package,
        network error, malformed response, timeout - so an LLM outage or
        misconfiguration can never block a job or produce a broken/partial
        explanation. explain() above always has the deterministic template
        path as a fallback; the audit's actual numbers never depend on
        this method succeeding.
        """
        import os

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return None

        try:
            from openai import OpenAI
        except ImportError:
            return None

        # Reuse the exact structured summary the template path would
        # render, so the LLM is grounded in the real computed numbers
        # rather than inventing its own framing of the underlying data.
        if audit_mode == "perturbation":
            structured_summary = self._explain_perturbation(
                perturbation_results or [], shap_summary or {}
            )
        else:
            structured_summary = self._explain_statistical(statistical_results or {})

        if not structured_summary.strip():
            return None

        prompt = (
            "You are summarizing an algorithmic hiring-bias audit for a "
            "non-technical hiring manager. Rewrite the following findings "
            "as 2-4 short, plain-English sentences. Do not invent any "
            "numbers, fields, or findings that are not present below - "
            "only rephrase what is given. Avoid technical jargon. Do not "
            "use markdown formatting (no #, **, or bullet characters).\n\n"
            f"Findings:\n{structured_summary}"
        )

        try:
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                timeout=10,
            )
            text = response.choices[0].message.content
            return text.strip() if text else None
        except Exception:
            # Any API/network/parsing failure falls back to the
            # deterministic template path in explain() above - this method
            # never raises and never blocks the job.
            return None

    def _explain_perturbation(
        self, perturbation_results: list[dict], shap_summary: dict
    ) -> str:
        """
        Plain-language summary for Tiers 1-2 (live model access). Avoids
        technical terms (SHAP, p-value, Wilcoxon, pedigree/proxy) in favor
        of wording a non-technical hiring manager or candidate could
        understand at a glance - the underlying numbers are unchanged,
        only how they are described here.
        """
        lines = []

        skill_pct = shap_summary.get("skill_reliance_pct")
        pedigree_pct = shap_summary.get("pedigree_reliance_pct")
        if skill_pct is not None and pedigree_pct is not None:
            lines.append(
                f"This model bases about {skill_pct:.0f}% of its decisions "
                f"on job-relevant factors like skills and experience, and "
                f"about {pedigree_pct:.0f}% on background factors like "
                f"college tier, location, or career gaps."
            )

        flagged = [
            r for r in perturbation_results
            if r.get("statistically_significant") and r.get("severity") in ("MED", "HIGH")
        ]
        if flagged:
            lines.append("The following factors showed a meaningful effect on candidate scores:")
            for result in flagged:
                field = result.get("field_tested", "this factor")
                avg_delta = result.get("avg_delta_pts", 0.0)
                direction = "raised" if avg_delta >= 0 else "lowered"
                lines.append(
                    f"- Changing {field} {direction} scores by about "
                    f"{abs(avg_delta):.1f} points on average."
                )
        else:
            lines.append(
                "None of the background factors tested showed a "
                "meaningful effect on candidate scores."
            )

        errors = [r for r in perturbation_results if r.get("error")]
        if errors:
            lines.append("")
            lines.append("A few factors could not be tested due to data issues:")
            for result in errors:
                lines.append(f"- {result.get('field_tested')}: {result.get('error')}")

        return "\n".join(lines)

    def _explain_statistical(self, statistical_results: dict) -> str:
        """
        Plain-language summary for Tier 3 (no live model access). Same
        de-jargoned approach as _explain_perturbation above.
        """
        lines = [
            "This audit compared selection rates across different "
            "candidate groups using only the outcomes that were uploaded "
            "- no scoring model was available for this job.",
            "",
        ]

        selection_rates = statistical_results.get("selection_rates") or {}
        if selection_rates:
            lines.append("Selection rates by group:")
            for group, rate in selection_rates.items():
                lines.append(f"- Group {group}: {rate * 100:.1f}% selected")
            lines.append("")

        four_fifths = statistical_results.get("four_fifths_rule") or {}
        if four_fifths.get("flag"):
            flagged = four_fifths.get("flagged_groups") or {}
            group_list = ", ".join(str(g) for g in flagged.keys())
            lines.append(
                f"At least one group ({group_list}) was selected "
                f"significantly less often than others, which may "
                f"indicate adverse impact."
            )
        else:
            lines.append(
                "No group was selected significantly less often than others."
            )

        parity = statistical_results.get("demographic_parity") or {}
        if parity.get("flag"):
            lines.append(
                f"The gap between the highest and lowest group selection "
                f"rates is {parity.get('difference', 0) * 100:.1f}%, which "
                f"is larger than what's considered acceptable "
                f"({parity.get('threshold', 0.15) * 100:.0f}%)."
            )

        matched = statistical_results.get("matched_pair") or {}
        if matched.get("flag"):
            lines.append(
                "A closer, like-for-like comparison of similarly "
                "qualified candidates across groups also found a "
                "meaningful difference in outcomes."
            )
        elif matched.get("method"):
            lines.append(
                "A closer, like-for-like comparison of similarly "
                "qualified candidates across groups did not find a "
                "meaningful difference in outcomes."
            )

        return "\n".join(lines)