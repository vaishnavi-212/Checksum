"""
Shared grouping + statistics helpers for the Audit Agent.

Why this module exists:
  * Continuous bias fields (age, career_gap_months) must be grouped into
    ranges before any group comparison. Treating every distinct age as its
    own "group" produced dozens of tiny groups and false adverse-impact flags.
  * Group comparisons need a minimum group size, otherwise a group of one
    candidate can trigger a flag.
  * The matched-pair comparison has to compare EVERY group against a
    reference group, and must keep the score strata separate (Cochran-
    Mantel-Haenszel) instead of pooling them into one Fisher table, which can
    hide or even reverse a real effect (Simpson's paradox).
"""

from __future__ import annotations

import math
import os
from statistics import median
from typing import Any, Iterable, Optional

from scipy import stats

MIN_GROUP_SIZE: int = int(os.environ.get("CHECKSUM_MIN_GROUP_SIZE", "30"))

# (lower_inclusive, upper_exclusive, label); None = open-ended
CONTINUOUS_BINS: dict[str, list[tuple[Optional[float], Optional[float], str]]] = {
    "age": [
        (None, 25, "under 25"),
        (25, 35, "25-34"),
        (35, 45, "35-44"),
        (45, None, "45+"),
    ],
    "career_gap_months": [
        (None, 1, "no gap"),
        (1, 7, "1-6 months"),
        (7, 13, "7-12 months"),
        (13, None, "over 12 months"),
    ],
}

POSITIVE_OUTCOMES = frozenset({"1", "1.0", "true", "yes", "y", "shortlisted", "selected", "hired"})


def is_positive_outcome(value: Any) -> bool:
    return str(value).strip().lower() in POSITIVE_OUTCOMES


def is_missing(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip() == "")


def _to_float(value: Any) -> Optional[float]:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def is_continuous(field: str) -> bool:
    return field in CONTINUOUS_BINS


def group_label(field: str, value: Any) -> Optional[str]:
    """Normalize a raw field value into the group label used for comparisons.

    Continuous fields are binned into ranges. Categorical values are
    normalized so "1", "1.0" and 1 are the same group, and "Male"/"male" too.
    Returns None for missing / unparseable values.
    """
    if is_missing(value):
        return None
    if is_continuous(field):
        f = _to_float(value)
        if f is None:
            return None
        for lo, hi, label in CONTINUOUS_BINS[field]:
            if (lo is None or f >= lo) and (hi is None or f < hi):
                return label
        return None
    f = _to_float(value)
    if f is not None and float(f).is_integer():
        return str(int(f))
    if f is not None:
        return str(f)
    return str(value).strip().lower()


def grouping_description(field: str) -> str:
    if is_continuous(field):
        return "binned: " + ", ".join(label for _, _, label in CONTINUOUS_BINS[field])
    return "categorical (exact values)"


def representative_value(field: str, raw_values: Iterable[Any]) -> Any:
    """The value to set when moving a candidate INTO a group (perturbation).

    Categorical: the group's own raw value. Continuous: the median of the
    group's values (int when the observed values are whole numbers).
    """
    raw_values = [v for v in raw_values if not is_missing(v)]
    if not raw_values:
        return None
    if not is_continuous(field):
        return raw_values[0]
    nums = [f for f in (_to_float(v) for v in raw_values) if f is not None]
    if not nums:
        return raw_values[0]
    m = median(nums)
    return int(round(m)) if all(float(n).is_integer() for n in nums) else round(m, 2)


def holm_adjust(p_values: list[float]) -> list[float]:
    """Holm-Bonferroni adjusted p-values (same order as input)."""
    m = len(p_values)
    order = sorted(range(m), key=lambda i: p_values[i])
    adjusted = [1.0] * m
    running = 0.0
    for rank, i in enumerate(order):
        val = min(1.0, (m - rank) * p_values[i])
        running = max(running, val)
        adjusted[i] = running
    return adjusted


def cmh_test(strata: list[list[list[int]]]) -> dict:
    """Cochran-Mantel-Haenszel test over 2x2 strata [[a, b], [c, d]].

    Rows: reference group, comparison group. Columns: selected, not selected.
    Returns p-value (continuity corrected) and the Mantel-Haenszel common
    odds ratio (reference vs comparison; >1 means the reference group is
    favoured at equal scores).
    """
    sum_a = sum_e = sum_var = 0.0
    or_num = or_den = 0.0
    used = 0
    for (a, b), (c, d) in strata:
        n = a + b + c + d
        if n < 2 or (a + b) == 0 or (c + d) == 0:
            continue
        used += 1
        sum_a += a
        sum_e += (a + b) * (a + c) / n
        sum_var += (a + b) * (c + d) * (a + c) * (b + d) / (n * n * (n - 1))
        or_num += a * d / n
        or_den += b * c / n

    if used == 0 or sum_var <= 0:
        return {"p_value": 1.0, "statistic": 0.0, "common_odds_ratio": None, "n_strata": used}

    statistic = (abs(sum_a - sum_e) - 0.5) ** 2 / sum_var
    p_value = float(stats.chi2.sf(statistic, 1))
    odds_ratio = (or_num / or_den) if or_den > 0 else None
    return {
        "p_value": p_value,
        "statistic": float(statistic),
        "common_odds_ratio": round(float(odds_ratio), 3) if odds_ratio is not None else None,
        "n_strata": used,
    }
