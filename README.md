<div align="center">

# Checksum

### AI Hiring-Bias Audit & Algorithmic Fairness Platform

<p>
<b>Turning a hiring model's black-box score into an explainable, defensible verdict — before it reaches a real candidate.</b>
</p>

<p>
<a href="https://checksum-one.vercel.app"><img src="https://img.shields.io/badge/🚀_Live_App-checksum--one.vercel.app-2563EB?style=for-the-badge&logoColor=white" /></a>
<a href="https://checksum-production.up.railway.app"><img src="https://img.shields.io/badge/⚙️_API-checksum--production.up.railway.app-0B0D0E?style=for-the-badge&logoColor=white" /></a>
</p>

<p>
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" />
<img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white" />
<img src="https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white" />
<img src="https://img.shields.io/badge/XGBoost-006ACC?style=flat-square" />
<img src="https://img.shields.io/badge/SHAP-8E75B2?style=flat-square" />
<img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
<img src="https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white" />
</p>

</div>

---

## 🚨 Problem Statement

AI adoption in HR has reached 43% of organizations, up from 26% a year earlier. (SHRM, 2025) — recruiting is the single largest use case. In a study of 391 employers affected by New York City's algorithmic hiring law, only 18 publicly posted audit reports — roughly 1 in 22 employers — highlighting a major gap between mandated auditing and public accountability.

Existing audit tools force a choice: assume full access to a model's internals to explain anything, or run a purely statistical check that can prove outcomes differ without ever saying *why*. Neither works when the model is a vendor's closed API, or all you have is a spreadsheet of past decisions — and almost none of them are built around the signals that actually shape hiring outcomes in India (college tier, metro access, career gaps) rather than checklists imported from a different labor market. Checksum closes that gap.

## 🧭 What It Does

Checksum is a **model-agnostic AI hiring-bias audit platform**. It evaluates, stress-tests, and explains algorithmic hiring decisions — whichever kind of access you actually have to the model behind them:

- **Audits** — your own model (full SHAP), a live external API (real-time calls), or decisions-only data (no model needed) — the same audit framework, adapted to what's actually available.
- **Explains** — SHAP feature attribution + live counterfactual perturbation, not just a statistical pass/fail.
- **Verifies fairness** — EEOC four-fifths rule, demographic parity, and matched-pair disparity testing.
- **Fixes** — one-click mitigation that recalibrates a biased outcome, before/after shown side by side.

Every ingestion step is disclosed and conservative: protected attributes are never guessed, and a field that can't be safely derived is labeled "not tested," not fabricated.

## 💡 Key Innovations

- ✅ **Model-agnostic auditing** — works with zero, partial, or full access to the model being audited
- ✅ **Audit depth adapts to real access, not user selection** — routing is based on whether a live model actually exists
- ✅ **Bias-aware explainability** — SHAP explanation correctly reroutes for mitigated models, so a "before vs. after" comparison never silently looks identical
- ✅ **India-calibrated fairness dimensions** — college tier, metro status, career gaps, not imported Western checklists
- ✅ **Honest by design** — caste and religion are never inferred, anywhere in the pipeline

## 🎥 What Checksum Found, Auditing Itself

Checksum trained its own reference hiring model — XGBoost, **90.75% accuracy, AUC 0.981** — on a synthetic dataset purpose-built so any bias discovered would be a genuine, emergent property of realistic correlations, never hardcoded into the labels. Then it turned its own audit engine on that model.

| Finding | Value |
|---|---|
| Strongest driver of score | **College tier** (SHAP mean importance 3.11) — ahead of experience (2.98) and the actual screening score (1.62) |
| One candidate's shortlisting odds, changing only college tier | **0.3% → 47.3%** |
| Average score shift across 127 candidates | **62.8 points** (p = 1.39×10⁻²²) |
| Same test, control field (career gap) | **2.1 points** — confirms the effect is specific, not audit noise |
| Reliance split | **56.8% skill-driven, 43.2% pedigree-driven** |

## ✨ Features

<table>
<tr>
<td width="33%" valign="top">

### 🔍 Ingest
- 75+ known column-name variants auto-mapped to a standard schema
- Missing fields derived only when safely inferable — never guessed
- Caste and religion never inferred, anywhere, by design
- Handles structured CSVs across three input paths

</td>
<td width="33%" valign="top">

### 🧪 Audit
- SHAP feature attribution (TreeExplainer / KernelExplainer)
- Live counterfactual perturbation, single-field what-if testing
- EEOC four-fifths rule, demographic parity, matched-pair (Fisher's exact)
- Multi-field statistical audits computed across every bias dimension

</td>
<td width="33%" valign="top">

### 🛠️ Fix
- Plain-language narrative synthesis of every finding
- One-click mitigation — group-mean recalibration
- Before/after comparison on the affected group
- Full per-candidate results dashboard

</td>
</tr>
</table>

## 🏗️ Architecture

**Pipeline flow — every audit job moves through this chain:**

```
 Path 1: own model   Path 2A: live API   Path 2B: decisions only
        │                    │                    │
        └────────────────────┼────────────────────┘
                              ▼
                     Ingest & Translate   ──────────  75+ column-name variants
                              │                        mapped to standard schema
                              ▼
                  Derive Missing Features  ─────────  metro status, career gap,
                              │                        screening score — never guessed
                              ▼
                      Score Candidates
                              │
                              ▼
                    Route Audit Depth   ────────────  based on real model access,
                              │                        not the path label
              ┌───────────────┴───────────────┐
              ▼                                 ▼
         Full Audit                     Statistics-Only
   (SHAP attribution +            (Four-fifths + Demographic
    Perturbation test)             parity + Matched-pair test)
              │                                 │
              └───────────────┬─────────────────┘
                              ▼
                       Explain Findings
                              │
                              ▼
                      Results Dashboard
                              │
                              ▼
                  Mitigate (on request)  ────────────  GroupAdjustedModel wrapper,
                                                        before/after comparison
```

**How the audit is built** — this is the core of Checksum's explainability:

| Signal | Source | Runs when |
|---|---|---|
| SHAP feature attribution | `shap.TreeExplainer` (own model) / `KernelExplainer` (external or mitigated model) | A live model is available |
| Counterfactual perturbation | Wilcoxon signed-rank test on paired original/perturbed scores | A live model is available |
| Four-fifths adverse-impact check | EEOC Uniform Guidelines (1978) — selection-rate ratio vs. top group | Statistics-only path |
| Demographic parity | Gap between group selection rates | Statistics-only path |
| Matched-pair disparity | Fisher's exact test on similarly-qualified candidates across groups | Statistics-only path |

**Resilience** — audit routing checks actual model access at runtime, not which upload path the user selected, so a live external model always gets the full audit and decisions-only data always gets an honest statistics-only audit, with no silent fallback either direction.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19.0.1, TypeScript, Vite, Tailwind CSS 4.1.14, Motion 12.23.24 |
| **Backend** | Python, FastAPI, LangGraph (orchestration) |
| **Model & Audit** | XGBoost, SHAP, scikit-learn, SciPy (Wilcoxon, Fisher's exact), pandas/NumPy |
| **Deployment** | Backend on Railway, frontend on Vercel |

## 📂 Project Structure

```
checksum/
│
├── notebooks/
│   └── kaggle-checksum.ipynb          # Model training: data prep, feature
│                                       # engineering, XGBoost, SHAP validation
│
├── backend/
│   ├── main.py                        → FastAPI endpoints
│   │
│   ├── core/                          # Shared infrastructure
│   │   ├── config.py                    → env-driven settings, feature flags
│   │   ├── constants.py                 → shared enums (paths, audit modes)
│   │   ├── job_store.py                 → job persistence (swappable to Postgres)
│   │   ├── model_registry.py            → cached HiringAgent singleton
│   │   ├── thresholds.py                → calibrated severity thresholds
│   │   ├── worker.py                    → background job execution
│   │   └── security.py                  → upload validation, SSRF guards
│   │
│   ├── orchestration/
│   │   └── graph.py                   → LangGraph: ingest → score → route →
│   │                                    audit → explain → fix
│   │
│   ├── agents/
│   │   ├── hiring_agent.py              → reference XGBoost scoring model
│   │   ├── audit_agent.py               → SHAP + perturbation + statistical
│   │   │                                  audit (single- & multi-field) + fix
│   │   ├── explanation_agent.py          → plain-language narrative synthesis
│   │   └── demo_external_agent.py        → demo model, proves model-agnosticism
│   │
│   ├── interface/
│   │   ├── model_interface.py           → ScoringModel contract
│   │   ├── external_model_adapter.py     → HTTP wrapper for external models
│   │   └── mitigated_model.py           → GroupAdjustedModel mitigation wrapper
│   │
│   ├── pipeline/                      # Data ingestion
│   │   ├── ingestion.py                 → format detection + entrypoint
│   │   ├── translation_layer.py         → column-name mapping (75+ variants)
│   │   ├── feature_engineering.py       → safe, disclosed feature derivation
│   │   ├── inference_layer.py           → deterministic gender/age inference
│   │   ├── synthetic_data_generator.py   → honest synthetic training data
│   │   └── resume_parser.py             → injectable PDF/DOCX parser stub
│   │
│   ├── models/                        # Trained model + calibrated thresholds
│   ├── tests/                         # pytest integration + unit tests
│   └── scripts/                       # Threshold calibration
│
└── frontend/
    └── src/
        ├── components/
        │   ├── landing/                → landing page, animated hero
        │   ├── howItWorks/              → pipeline explainer page
        │   ├── upload/                  → audit path selection + upload
        │   ├── dashboard/               → results, explanation, perturbation,
        │   │                              mitigation, statistics-only view
        │   ├── layout/                  → header, container
        │   └── ui/                      → shared primitives
        ├── services/api.ts              → typed API client
        └── tokens/tokens.ts             → design tokens
```

## 🚀 Getting Started

### Clone & Install
```bash
git clone https://github.com/vaishnavi-212/Checksum.git
cd Checksum
```

**Backend**
```bash
cd backend
pip install -e ".[dev]"
```

**Frontend**
```bash
cd frontend
npm install
```

### Environment Variables

Backend `.env`:
```bash
# Optional — controls SSRF allowlist for external model endpoints
CHECKSUM_MAX_UPLOAD_MB=10
CHECKSUM_REQUIRE_HTTPS_EXTERNAL=false
```

Frontend `.env`:
```bash
# Falls back to the deployed Railway instance if unset
VITE_API_BASE_URL=http://localhost:8000
```

### Run Locally
```bash
# Terminal 1
cd backend && uvicorn main:app --reload

# Terminal 2
cd frontend && npm run dev
```

### Quick Demo
```bash
curl -F "file=@backend/tests/fixtures/sample_candidates.csv" http://localhost:8000/audit/upload
curl http://localhost:8000/audit/<job_id>/status
curl http://localhost:8000/audit/<job_id>/results
```

## 📡 API Reference

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/audit/upload` | Path 1 — candidates only, own Hiring Agent |
| `POST` | `/audit/upload-external` | Path 2A/2B — candidates + optional external model endpoint |
| `GET` | `/audit/{job_id}/status` | Poll job progress |
| `GET` | `/audit/{job_id}/results` | Full audit results |
| `GET` | `/audit/{job_id}/explanation` | Plain-language findings narrative |
| `POST` | `/audit/{job_id}/candidate/{id}/perturb` | Live single-field what-if test |
| `POST` | `/audit/{job_id}/fix` | Trigger mitigation / recalibration |

## 🎯 Use Cases

- Hiring model fairness certification before deployment
- Vendor ATS / third-party scoring model due diligence
- Compliance audit trail for adverse-impact review
- Post-hoc audit of historical shortlisting decisions
- Bias mitigation and score recalibration

## 🔒 Ethics & Safety

- Caste and religion are never inferred, anywhere in the pipeline — by design, not by omission
- Gender/age inferred only via disclosed, deterministic methods (name lookup, graduation year)
- Fields that can't be safely derived are labeled "not tested," never fabricated
- SSRF-guarded external model endpoints — localhost and private IPs are always blocked
- Synthetic training data, purpose-built so any discovered bias is a genuine emergent property, never injected

## 📚 Datasets & Research Foundations

**Datasets used**
- Kaggle — Recruitment Bias & Fairness AI Dataset *(training)*
- OpenIntro Resume Dataset *(threshold calibration)*
- Kaggle — Resume Dataset PDF *(resume parser testing)*
- Kaggle — 54k Resume Dataset, structured *(schema-flexibility testing)*

**Research foundations**
- SHAP — Lundberg & Lee, *"A Unified Approach to Interpreting Model Predictions,"* NeurIPS 2017
- EEOC Uniform Guidelines on Employee Selection Procedures (1978)
- Wilcoxon signed-rank test — perturbation significance
- Fisher's exact test — matched-pair disparity analysis

## 📈 Roadmap

- [ ] Surface every audited bias dimension in the results dashboard — `BIAS_FIELDS` covers gender, age, college tier, metro status, and career gap; the backend already computes all five, the dashboard currently renders one
- [ ] Real model retraining as a mitigation option, not just output recalibration
- [ ] Resume-native ingestion (`pdfplumber`, `python-docx`)
- [ ] Persistent audit history (PostgreSQL — `JobStore` interface already supports the swap)
- [ ] One-click "Score → Audit" chaining
- [ ] Continuous, scheduled re-audits to catch model drift after deployment
- [ ] Intersectional bias checks (e.g. college tier × gender)

## 🤝 Contributing

Contributions are welcome.

```bash
git checkout -b feature-name
git commit -m "Add feature"
git push origin feature-name
```

Then open a Pull Request.

---

<div align="center">

**⭐ If you found this project useful, consider giving it a star!**

*Every score hides a decision. Checksum makes it explain itself.*

**[GitHub](https://github.com/vaishnavi-212)** · **[LinkedIn](https://www.linkedin.com/in/vaishnavi-k-212-/)** · **vaishnavipk212@gmail.com**

</div>
