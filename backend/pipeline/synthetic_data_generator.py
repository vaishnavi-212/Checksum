"""
Synthetic candidate dataset generator.

Per the plan: the Hiring Agent must be trained HONESTLY on realistic data —
no injected bias into the model itself. Any bias it later exhibits must be
a genuine, discovered emergent property of correlations that already exist
in the training data (the way real-world hiring data behaves), not something
hardcoded into labels.

Design choices that matter here:
  - `true_skill` is the ONLY thing that causally determines the outcome label.
  - `college_tier`, `region`, `english_proficiency` are CORRELATED with
    true_skill (because in the real world, better resources -> often better
    measured skill) but do NOT directly cause the label. This is the
    "correlation, not causation" structure discussed in the plan.
  - A well-trained model COULD learn to rely on these proxies as shortcuts
    (because they're correlated with the thing it's trying to predict),
    which is exactly the failure mode Checksum is built to catch. But it's
    not guaranteed to -- that's an honest, discovered result, not a rigged one.
  - Dummy/no-signal fields (candidate_id_random, coin_flip_field,
    shuffled_college_tier) are included from the start -- these are the
    noise-floor fields the calibration procedure (plan Section 5.8) needs.
"""

from __future__ import annotations
import numpy as np
import pandas as pd
import uuid


def generate_synthetic_candidates(
    n: int = 2000,
    seed: int = 42,
    proxy_correlation_strength: float = 0.35,
) -> pd.DataFrame:
    """
    proxy_correlation_strength: how strongly college_tier/region/english
    proficiency are correlated with true_skill (0 = totally independent,
    1 = perfectly determined by skill). Real-world-plausible range is
    roughly 0.2-0.5 -- strong enough that pedigree carries real information
    about skill (so a model isn't crazy to partially rely on it), but not
    so strong it's a proxy in disguise for the label itself.
    """
    rng = np.random.default_rng(seed)

    # --- Ground truth skill: the ONLY thing that should determine outcome ---
    true_skill = rng.normal(loc=65, scale=15, size=n).clip(0, 100)

    # --- Experience: also causally relevant, weakly correlated with skill ---
    years_experience = (rng.normal(loc=5, scale=3, size=n) + true_skill * 0.02).clip(0, 30)

    # --- Proxy fields: correlated with skill, but NOT the cause of outcome ---
    # college_tier: 1 (top tier) to 3 (lower tier). Higher skill -> somewhat
    # more likely to be tier 1, but plenty of high-skill candidates are tier 3
    # and vice versa (this is what makes it a genuine "shortcut" risk, not
    # a perfect proxy).
    tier_noise = rng.normal(0, 1, size=n)
    tier_score = proxy_correlation_strength * (true_skill - 65) / 15 + (1 - proxy_correlation_strength) * tier_noise
    college_tier = pd.cut(tier_score, bins=[-np.inf, -0.4, 0.4, np.inf], labels=[1, 2, 3]).astype(int)
    # invert so higher tier_score (correlated w/ higher skill) -> lower (better) tier number
    college_tier = 4 - college_tier

    region_noise = rng.normal(0, 1, size=n)
    region_score = proxy_correlation_strength * (true_skill - 65) / 15 + (1 - proxy_correlation_strength) * region_noise
    is_metro = (region_score > 0).astype(int)  # 1 = metro, 0 = non-metro

    english_noise = rng.normal(0, 1, size=n)
    english_score_raw = proxy_correlation_strength * (true_skill - 65) / 15 + (1 - proxy_correlation_strength) * english_noise
    english_proficiency = (60 + english_score_raw * 15).clip(0, 100)

    # --- Career gap: independent-ish, real-world nuisance field ---
    career_gap_months = rng.exponential(scale=4, size=n).clip(0, 60).round().astype(int)

    # --- Gender / age: global bias categories, generated independent of skill ---
    gender = rng.choice(["M", "F"], size=n, p=[0.55, 0.45])
    age = rng.normal(loc=30, scale=6, size=n).clip(21, 55).round().astype(int)

    # --- Disability status: independent of skill ---
    disability_status = rng.choice([0, 1], size=n, p=[0.93, 0.07])

    # --- OUTCOME LABEL: determined ONLY by true_skill + experience + noise. ---
    # This is the critical honesty constraint: college_tier/region/english/
    # gender/age/disability do NOT appear in this formula. If a trained
    # model ends up relying on them anyway, that's a genuine, discovered
    # shortcut -- not something we told it to do.
    label_signal = (
        0.8 * true_skill
        + 1.2 * years_experience
        + rng.normal(0, 8, size=n)  # irreducible noise, same as real hiring judgment
    )
    outcome_score = (
        (label_signal - label_signal.min()) / (label_signal.max() - label_signal.min()) * 100
    )
    shortlisted = (outcome_score > np.percentile(outcome_score, 60)).astype(int)

    # --- Noise-floor / dummy fields for calibration (plan Section 5.8) ---
    candidate_id_random = [str(uuid.uuid4())[:8] for _ in range(n)]
    coin_flip_field = rng.choice([0, 1], size=n)
    shuffled_college_tier = rng.permutation(np.asarray(college_tier))  # decorrelated copy

    df = pd.DataFrame({
        "candidate_id": [f"C{str(i).zfill(5)}" for i in range(n)],
        "true_skill": true_skill.round(2),               # kept for validation only, NOT a model feature
        "years_experience": years_experience.round(2),
        "college_tier": college_tier,
        "is_metro": is_metro,
        "english_proficiency": english_proficiency.round(2),
        "career_gap_months": career_gap_months,
        "gender": gender,
        "age": age,
        "disability_status": disability_status,
        "outcome_score": outcome_score.round(2),
        "shortlisted": shortlisted,
        # noise floor fields
        "_noise_candidate_id_random": candidate_id_random,
        "_noise_coin_flip_field": coin_flip_field,
        "_noise_shuffled_college_tier": shuffled_college_tier,
    })
    return df


if __name__ == "__main__":
    df = generate_synthetic_candidates()
    out_path = "/home/claude/checksum-backend/data/synthetic_candidates.csv"
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} candidates -> {out_path}")
    print(df.head())
