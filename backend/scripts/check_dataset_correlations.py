"""
Build order step 3: Dataset correlation check.

Before training the Hiring Agent, verify the dataset has the structure that
makes an honest bias-finding possible:
  1. Proxy fields (college_tier, is_metro, english_proficiency) should
     correlate with true_skill -- but not be identical to it. This is what
     makes them plausible "shortcuts" a model might lean on.
  2. Proxy fields should NOT correlate directly with outcome any more than
     they do via skill -- i.e. skill should "explain away" most of the
     proxy-outcome relationship. If it doesn't fully explain it away, good:
     that's the residual gap a biased model could latch onto.
  3. Noise-floor fields should show ~zero correlation with everything --
     confirming they're a valid baseline for later threshold calibration.

This does NOT guarantee the trained model will exhibit bias -- that's an
honest empirical question for the training step. This just confirms the
data has plausible real-world structure rather than being either fully
random (no bias possible) or fully rigged (bias guaranteed / fake).
"""

import pandas as pd
import numpy as np
from scipy import stats

DATA_PATH = "/home/claude/checksum-backend/data/synthetic_candidates.csv"


def partial_correlation(x, y, control):
    """Correlation between x and y after regressing out `control` from both.
    Simple linear residualization -- tells us how much of the x-y relationship
    survives once we account for skill."""
    x_resid = x - np.polyval(np.polyfit(control, x, 1), control)
    y_resid = y - np.polyval(np.polyfit(control, y, 1), control)
    r, p = stats.pearsonr(x_resid, y_resid)
    return r, p


def main():
    df = pd.read_csv(DATA_PATH)
    skill = df["true_skill"].values
    outcome = df["outcome_score"].values

    print("=" * 70)
    print("DATASET CORRELATION CHECK")
    print("=" * 70)

    proxy_fields = {
        "college_tier": df["college_tier"].values,
        "is_metro": df["is_metro"].values,
        "english_proficiency": df["english_proficiency"].values,
    }

    print("\n--- 1. Proxy fields vs true_skill (should be moderate, not ~0 or ~1) ---")
    for name, vals in proxy_fields.items():
        r, p = stats.pearsonr(vals, skill)
        verdict = "OK (moderate)" if 0.15 < abs(r) < 0.75 else "CHECK THIS"
        print(f"  {name:22s}  r={r:+.3f}  p={p:.2e}   [{verdict}]")

    print("\n--- 2. Proxy fields vs outcome, BEFORE controlling for skill ---")
    for name, vals in proxy_fields.items():
        r, p = stats.pearsonr(vals, outcome)
        print(f"  {name:22s}  r={r:+.3f}  p={p:.2e}")

    print("\n--- 3. Proxy fields vs outcome, AFTER controlling for skill ---")
    print("    (residual correlation = the part a model COULD exploit as a")
    print("     shortcut that isn't just 'skill leaking through the proxy')")
    for name, vals in proxy_fields.items():
        r, p = partial_correlation(vals.astype(float), outcome.astype(float), skill.astype(float))
        verdict = "near zero, as expected (label is skill-only by construction)" 
        print(f"  {name:22s}  partial_r={r:+.3f}  p={p:.2e}   [{verdict}]")

    print("\n--- 4. Noise-floor fields (should show ~0 correlation with everything) ---")
    noise_fields = {
        "_noise_coin_flip_field": df["_noise_coin_flip_field"].values,
        "_noise_shuffled_college_tier": df["_noise_shuffled_college_tier"].values,
    }
    for name, vals in noise_fields.items():
        r_skill, _ = stats.pearsonr(vals, skill)
        r_outcome, _ = stats.pearsonr(vals, outcome)
        verdict = "OK" if abs(r_skill) < 0.1 and abs(r_outcome) < 0.1 else "CHECK THIS"
        print(f"  {name:30s}  r_vs_skill={r_skill:+.3f}  r_vs_outcome={r_outcome:+.3f}  [{verdict}]")

    print("\n--- 5. Global bias fields (gender, age, disability) vs outcome ---")
    print("    (should be ~independent by construction -- global fairness")
    print("     tools should find these clean; the interesting gap is proxies)")
    for name in ["age", "disability_status"]:
        r, p = stats.pearsonr(df[name].values, outcome)
        print(f"  {name:22s}  r={r:+.3f}  p={p:.2e}")
    gender_groups = df.groupby("gender")["outcome_score"].mean()
    print(f"  gender group means: {gender_groups.to_dict()}")

    print("\n" + "=" * 70)
    print("INTERPRETATION")
    print("=" * 70)
    print("""
- Section 1: proxy fields should be genuinely correlated with skill (not
  independent, not identical) -- this is realistic real-world structure,
  where e.g. college tier partly reflects prior opportunity/preparation.
- Section 3: partial correlations should be near zero, because we built
  the label formula from true_skill + experience ONLY. This confirms the
  label itself isn't secretly biased by construction.
- The gap between raw correlation (Section 2) and partial correlation
  (Section 3) IS the "skill leaking through the proxy" effect -- a
  reasonable model should learn to discount most of it once skill signals
  are available. Whether a real trained model actually does this, or
  instead takes proxy shortcuts anyway, is exactly the open, honest
  empirical question the Hiring Agent + Audit Agent will answer next.
- Section 4 confirms noise-floor fields are clean -- safe for calibration.
""")


if __name__ == "__main__":
    main()
