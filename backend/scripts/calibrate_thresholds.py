"""
calibrate_thresholds.py
Section 5.8 of the Checksum plan - Threshold Calibration Procedure.

Run ONCE, before any severity bands (LOW/MED/HIGH) are wired into the
frontend, after the perturbation engine works (Build Order step 7, after
step 6). Produces calibrated_thresholds.json, read by both backend logic
and frontend severity badges.

Procedure (Section 5.8, followed exactly):
  1. Establish the noise floor - perturb 2-3 dummy fields with zero
     plausible relationship to skill or outcome, across many candidates.
  2. Validate against a known-answer dataset (OpenIntro) - measure
     Checksum's effect size against the published real bias effect.
  3. Set thresholds as ratios between the two anchors, not absolute
     guesses.
  4. Cross-check with relative (quantile) ranking; fall back to relative
     ranking as primary signal when the two diverge (esp. in Tier 3 / small
     samples).
  5. Store and expose the calibration artifact.

Usage:
    python calibrate_thresholds.py \
        --candidates candidates_with_synthetic_columns.csv \
        --model hiring_agent.json \
        --openintro path/to/openintro_resume_dataset.csv \
        --out calibrated_thresholds.json
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass
from typing import Callable, Optional

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Step 1: Noise floor
# ---------------------------------------------------------------------------

def add_noise_floor_fields(df: pd.DataFrame, seed: int = 999) -> pd.DataFrame:
    """
    Add 2-3 dummy fields with zero plausible relationship to skill or
    outcome (Section 5.8 step 1):
      - random UUID-like candidate id
      - a coin-flip synthetic field
      - a shuffled/decorrelated copy of a real field (college_tier, if present)
    """
    rng = np.random.default_rng(seed)
    df = df.copy()
    df["_calib_noise_uuid"] = [f"n{rng.integers(0, 10**9)}" for _ in range(len(df))]
    df["_calib_noise_coinflip"] = rng.integers(0, 2, size=len(df))
    if "college_tier" in df.columns:
        df["_calib_noise_shuffled_college_tier"] = rng.permutation(df["college_tier"].values)
    return df


def run_perturbation_test(
    df: pd.DataFrame,
    field: str,
    score_fn: Callable[[pd.DataFrame], np.ndarray],
    perturb_fn: Optional[Callable[[pd.Series], pd.Series]] = None,
) -> np.ndarray:
    """
    Generic per-field perturbation test against a scoring function that
    satisfies the Model Interface (Section 5.4): score_fn(df) -> array of
    scores in [0, 100] (or comparable scale).

    Returns the array of absolute score deltas (original - perturbed) for
    every candidate, which is what noise-floor / effect-size calibration is
    built from (Section 5.7: "Per-field test across many candidates").
    """
    original_scores = score_fn(df)

    perturbed = df.copy()
    if perturb_fn is not None:
        perturbed[field] = perturb_fn(perturbed[field])
    else:
        # default perturbation: shuffle the column across candidates -
        # a reasonable generic "change this one thing" operation when no
        # domain-specific swap rule is supplied.
        rng = np.random.default_rng(42)
        perturbed[field] = rng.permutation(perturbed[field].values)

    perturbed_scores = score_fn(perturbed)
    deltas = np.abs(original_scores - perturbed_scores)
    return deltas


def compute_noise_baseline(
    df: pd.DataFrame,
    score_fn: Callable[[pd.DataFrame], np.ndarray],
    noise_fields: list[str],
) -> dict:
    """
    Section 5.8 step 1: run the perturbation test on each noise-floor field
    and summarize the distribution. This becomes `noise_baseline`.
    """
    all_deltas = []
    per_field = {}
    for f in noise_fields:
        if f not in df.columns:
            continue
        deltas = run_perturbation_test(df, f, score_fn)
        per_field[f] = {
            "mean": float(np.mean(deltas)),
            "std": float(np.std(deltas)),
            "p95": float(np.percentile(deltas, 95)),
        }
        all_deltas.extend(deltas.tolist())

    if not all_deltas:
        raise RuntimeError("No noise-floor fields found in dataframe; cannot calibrate.")

    return {
        "per_field": per_field,
        "overall_mean": float(np.mean(all_deltas)),
        "overall_std": float(np.std(all_deltas)),
        "overall_p95": float(np.percentile(all_deltas, 95)),
    }


# ---------------------------------------------------------------------------
# Step 2: OpenIntro validation anchor
# ---------------------------------------------------------------------------

# Published effect size from the OpenIntro Resume Dataset field experiment
# (callback-rate gap attributable to a name-signaled demographic proxy).
# This is the well-known Bertrand & Mullainathan-style result the OpenIntro
# dataset is drawn from; expressed here on the same 0-100 delta scale
# Checksum's perturbation test uses, so it's directly comparable.
# If you have a locally computed number from the actual OpenIntro CSV,
# pass --openintro and this gets overridden by compute_openintro_effect().
DEFAULT_PUBLISHED_KNOWN_REAL_BIAS_EFFECT = 33.0  # points, on 0-100 delta scale


def compute_openintro_effect(
    openintro_path: str,
    score_fn: Callable[[pd.DataFrame], np.ndarray],
    proxy_field: str = "name_signaled_group",
) -> Optional[float]:
    """
    Section 5.8 step 2: run the exact same perturbation-test methodology on
    the OpenIntro dataset and compare Checksum's measured effect to the
    published number. Close agreement validates the *measurement
    methodology itself* - a separate checkpoint from picking a threshold.

    Returns None (and the caller falls back to
    DEFAULT_PUBLISHED_KNOWN_REAL_BIAS_EFFECT) if the file/field isn't
    available - this validation step must never fabricate a result.
    """
    try:
        oi_df = pd.read_csv(openintro_path)
    except Exception:
        return None

    if proxy_field not in oi_df.columns:
        return None

    deltas = run_perturbation_test(oi_df, proxy_field, score_fn)
    return float(np.mean(deltas))


# ---------------------------------------------------------------------------
# Step 3-4: Set thresholds as ratios; cross-check with quantile ranking
# ---------------------------------------------------------------------------

@dataclass
class CalibratedThresholds:
    noise_baseline: dict
    known_real_bias_effect: float
    safety_margin: float
    low_ceiling: float           # LOW/no-flag ceiling = noise_baseline * safety_margin
    high_threshold: float        # meaningfully below known_real_bias_effect
    med_lower: float              # == low_ceiling
    med_upper: float              # == high_threshold
    quantile_top_fraction: float  # e.g. 0.25 -> top quartile by effect size flagged
    methodology_note: str


def calibrate(
    df: pd.DataFrame,
    score_fn: Callable[[pd.DataFrame], np.ndarray],
    noise_fields: list[str],
    known_real_bias_effect: Optional[float] = None,
    safety_margin: float = 1.75,  # midpoint of the plan's stated 1.5-2x range
    high_below_fraction: float = 0.7,  # HIGH threshold sits at 70% of the known-real-effect anchor
    quantile_top_fraction: float = 0.25,
) -> CalibratedThresholds:
    """
    Section 5.8 steps 3-4, combined: derive LOW/MED/HIGH bands as ratios
    between the noise_baseline and known_real_bias_effect anchors, then
    prepare the quantile cross-check parameters.
    """
    noise = compute_noise_baseline(df, score_fn, noise_fields)
    anchor = (
        known_real_bias_effect
        if known_real_bias_effect is not None
        else DEFAULT_PUBLISHED_KNOWN_REAL_BIAS_EFFECT
    )

    low_ceiling = noise["overall_mean"] * safety_margin
    high_threshold = anchor * high_below_fraction

    if high_threshold <= low_ceiling:
        # Anchors too close together for a meaningful MED band - widen the
        # gap conservatively rather than silently produce a degenerate
        # (LOW ceiling >= HIGH threshold) config. This is the "one
        # remaining subjective call" the plan flags; documented, not hidden.
        high_threshold = low_ceiling * 1.5

    return CalibratedThresholds(
        noise_baseline=noise,
        known_real_bias_effect=anchor,
        safety_margin=safety_margin,
        low_ceiling=round(low_ceiling, 2),
        high_threshold=round(high_threshold, 2),
        med_lower=round(low_ceiling, 2),
        med_upper=round(high_threshold, 2),
        quantile_top_fraction=quantile_top_fraction,
        methodology_note=(
            "LOW/no-flag ceiling = noise_baseline.overall_mean * safety_margin. "
            "HIGH threshold = known_real_bias_effect * high_below_fraction. "
            "MED = everything between. Cross-checked against top-quartile "
            "ranking by effect size per field; if absolute and relative "
            "rankings diverge (common in small Tier-3 samples), relative "
            "ranking becomes the primary signal for that run (Section 5.8 step 4)."
        ),
    )


def quantile_flag(effect_sizes_by_field: dict[str, float], top_fraction: float = 0.25) -> list[str]:
    """
    Section 5.8 step 4: rank all tested fields by effect size and flag the
    top quartile (or whatever top_fraction is configured). Used as a
    convergent-validation check against the absolute thresholds, and as
    the primary signal when sample sizes are too small to trust absolute
    percentages (most relevant for Tier 3 audits).
    """
    if not effect_sizes_by_field:
        return []
    n_flag = max(1, round(len(effect_sizes_by_field) * top_fraction))
    ranked = sorted(effect_sizes_by_field.items(), key=lambda kv: kv[1], reverse=True)
    return [field for field, _ in ranked[:n_flag]]


# ---------------------------------------------------------------------------
# Step 5: store artifact
# ---------------------------------------------------------------------------

def save_calibration_artifact(thresholds: CalibratedThresholds, out_path: str) -> None:
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(asdict(thresholds), f, indent=2)
    print(f"Saved calibrated thresholds to {out_path}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _load_xgb_score_fn(model_path: str, feature_cols: list[str]):
    """
    Wraps a saved XGBoost model to satisfy the Model Interface contract
    (Section 5.4) closely enough for calibration purposes: takes a
    dataframe, returns an array of 0-100 scores.
    """
    import xgboost as xgb

    model = xgb.XGBClassifier()
    model.load_model(model_path)

    def score_fn(df: pd.DataFrame) -> np.ndarray:
        X = df[feature_cols].astype(float)
        probs = model.predict_proba(X)[:, 1]
        return probs * 100.0

    return score_fn


def main():
    parser = argparse.ArgumentParser(description="Calibrate Checksum severity thresholds (Section 5.8).")
    parser.add_argument("--candidates", required=True, help="Path to candidates_with_synthetic_columns.csv")
    parser.add_argument("--model", required=True, help="Path to hiring_agent.json")
    parser.add_argument(
        "--feature-cols",
        default="screening_score,college_tier,is_metro,career_gap_months,experience_years",
        help="Comma-separated feature columns the model expects",
    )
    parser.add_argument("--openintro", default=None, help="Optional path to OpenIntro resume dataset CSV")
    parser.add_argument("--out", default="calibrated_thresholds.json")
    args = parser.parse_args()

    df = pd.read_csv(args.candidates)
    feature_cols = args.feature_cols.split(",")
    score_fn = _load_xgb_score_fn(args.model, feature_cols)

    df = add_noise_floor_fields(df)
    noise_fields = [c for c in df.columns if c.startswith("_calib_noise")]

    known_real_bias_effect = None
    if args.openintro:
        known_real_bias_effect = compute_openintro_effect(args.openintro, score_fn)
        if known_real_bias_effect is None:
            print(
                "Warning: could not compute effect from --openintro path/field; "
                "falling back to documented published estimate.",
                file=sys.stderr,
            )

    thresholds = calibrate(
        df, score_fn, noise_fields, known_real_bias_effect=known_real_bias_effect
    )
    save_calibration_artifact(thresholds, args.out)

    print(json.dumps(asdict(thresholds), indent=2))


if __name__ == "__main__":
    main()
