import React from 'react';
import { motion } from 'motion/react';
import {
  Cpu,
  Globe,
  FileSpreadsheet,
  ArrowRight,
  BarChart3,
  Sliders,
  Scale,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Info,
  Layers,
  ArrowDown,
  Check,
  AlertCircle,
  FileCheck2,
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  Award,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';

export interface HowItWorksPageProps {
  onStartAudit: () => void;
}

export const HowItWorksPage: React.FC<HowItWorksPageProps> = ({ onStartAudit }) => {
  return (
    <div className="space-y-10 sm:space-y-12 pb-12">
      {/* Page Header Banner */}
      <section className="space-y-4 text-center max-w-3xl mx-auto pt-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300 text-xs font-mono-tabular font-bold shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>HOW CHECKSUM WORKS</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight"
        >
          How Checksum Audits Your Hiring Data
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-base sm:text-lg text-slate-700 font-medium leading-relaxed"
        >
          A plain-language guide to how Checksum ingests candidate data, interrogates scoring models, tests for bias, and produces legal-ready fairness reports.
        </motion.p>
      </section>

      {/* SECTION 1: The Three Ways to Bring Data In */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-blue-600 font-mono-tabular font-bold text-xs uppercase tracking-wider mb-1">
            <span>STEP 1</span>
            <span>•</span>
            <span>INGESTION PATHS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            1. Three Ways to Audit Your Data
          </h2>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Choose the workflow that matches how your hiring decisions are generated.
          </p>
        </div>

        {/* 3-Column Comparison Diagram / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Path 1 Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl p-[1px] bg-gradient-to-b from-blue-400/60 via-blue-200/40 to-slate-200 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between bg-white"
          >
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 shadow-2xs">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <Badge variant="primary" size="sm">
                    PATH 1
                  </Badge>
                </div>

                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Checksum's Native Model
                </h3>
                <p className="text-xs font-semibold text-blue-600 font-mono-tabular mt-0.5">
                  Built-in AI Scoring Engine
                </p>

                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Upload candidate resumes (CSV) and audit them directly against Checksum's built-in scoring model with full explainability.
                </p>
              </div>

              {/* Key Highlights */}
              <div className="pt-4 border-t border-slate-100 space-y-2 mt-4">
                <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Full candidate scoring & explanation</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>SHAP feature attribution & what-if testing</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Zero setup — works out of the box</span>
                </div>

                <div className="mt-3 pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-mono-tabular font-bold text-[11px] w-full justify-center">
                    Audit Level: Full Deep Audit
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Path 2A Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-2xl p-[1px] bg-gradient-to-b from-purple-500/60 via-purple-200/40 to-slate-200 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between bg-white"
          >
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-600 shadow-2xs">
                    <Globe className="w-6 h-6" />
                  </div>
                  <Badge variant="neutral" size="sm">
                    PATH 2A
                  </Badge>
                </div>

                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  External Model Endpoint
                </h3>
                <p className="text-xs font-semibold text-purple-600 font-mono-tabular mt-0.5">
                  Live API Endpoint Querying
                </p>

                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Upload candidate CSV plus your custom AI model's REST API endpoint. Checksum queries your model in real time to score and test candidates.
                </p>
              </div>

              {/* Key Highlights */}
              <div className="pt-4 border-t border-slate-100 space-y-2 mt-4">
                <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Live real-time model interrogation</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Active counterfactual stress testing</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Audits proprietary external algorithms</span>
                </div>

                <div className="mt-3 pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-800 border border-purple-200 font-mono-tabular font-bold text-[11px] w-full justify-center">
                    Audit Level: Full Deep Audit
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Path 2B Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-2xl p-[1px] bg-gradient-to-b from-emerald-400/60 via-emerald-200/40 to-slate-200 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between bg-white"
          >
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-2xs">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <Badge variant="passed" size="sm">
                    PATH 2B
                  </Badge>
                </div>

                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Decisions You Already Have
                </h3>
                <p className="text-xs font-semibold text-emerald-700 font-mono-tabular mt-0.5">
                  Historical Decision Datasets
                </p>

                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Upload a spreadsheet of candidates alongside scores or pass/fail decisions already made. Checksum audits outcomes directly with no live model needed.
                </p>
              </div>

              {/* Key Highlights */}
              <div className="pt-4 border-t border-slate-100 space-y-2 mt-4">
                <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Audit historical spreadsheets & archives</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>EEOC 4/5ths rule statistical audit</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>No live endpoint or model code required</span>
                </div>

                <div className="mt-3 pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono-tabular font-bold text-[11px] w-full justify-center">
                    Audit Level: Statistical-Only Check
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2: What Checksum Does with the Data (Linear Flow Diagram) */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-blue-600 font-mono-tabular font-bold text-xs uppercase tracking-wider mb-1">
            <span>STEP 2</span>
            <span>•</span>
            <span>PIPELINE EXECUTION</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            2. What Checksum Does with Your Data
          </h2>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Once a path is selected, Checksum executes a continuous, automated audit sequence from ingestion to result delivery.
          </p>
        </div>

        {/* Linear Flow SVG / Diagram Container */}
        <div className="p-6 sm:p-8 rounded-2xl bg-slate-900 text-slate-100 shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Flow Stepper SVG Diagram for Desktop & Stacked Cards for Mobile */}
          <div className="space-y-8 relative z-10">
            {/* Desktop Flowchart Banner */}
            <div className="hidden lg:block pb-6 border-b border-slate-800">
              <svg className="w-full h-24" viewBox="0 0 900 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Arrow lines connecting nodes */}
                <path d="M 160 40 L 220 40" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M 340 40 L 400 40" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M 520 40 L 580 40" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />
                <path d="M 700 40 L 760 40" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 4" />

                {/* Node 1: Ingest */}
                <g transform="translate(40, 10)">
                  <rect width="120" height="60" rx="10" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5" />
                  <text x="60" y="28" textAnchor="middle" fill="#93c5fd" fontSize="10" fontWeight="bold" fontFamily="monospace">STAGE 1</text>
                  <text x="60" y="44" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">Ingest & Validate</text>
                </g>

                {/* Node 2: Score */}
                <g transform="translate(220, 10)">
                  <rect width="120" height="60" rx="10" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5" />
                  <text x="60" y="28" textAnchor="middle" fill="#93c5fd" fontSize="10" fontWeight="bold" fontFamily="monospace">STAGE 2</text>
                  <text x="60" y="44" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">Score Candidates</text>
                </g>

                {/* Node 3: Depth Decision */}
                <g transform="translate(400, 10)">
                  <rect width="120" height="60" rx="10" fill="#1e293b" stroke="#6366f1" strokeWidth="1.5" />
                  <text x="60" y="28" textAnchor="middle" fill="#a5b4fc" fontSize="10" fontWeight="bold" fontFamily="monospace">STAGE 3</text>
                  <text x="60" y="44" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">Determine Depth</text>
                </g>

                {/* Node 4: Run Audit */}
                <g transform="translate(580, 10)">
                  <rect width="120" height="60" rx="10" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.5" />
                  <text x="60" y="28" textAnchor="middle" fill="#93c5fd" fontSize="10" fontWeight="bold" fontFamily="monospace">STAGE 4</text>
                  <text x="60" y="44" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">Run Audit</text>
                </g>

                {/* Node 5: Return Results */}
                <g transform="translate(760, 10)">
                  <rect width="120" height="60" rx="10" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
                  <text x="60" y="28" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="bold" fontFamily="monospace">STAGE 5</text>
                  <text x="60" y="44" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">Return Results</text>
                </g>
              </svg>
            </div>

            {/* Stepper Grid Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Step 1 */}
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono-tabular font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <span className="text-[10px] font-mono-tabular text-blue-300 font-bold bg-blue-950 px-2 py-0.5 rounded">
                    Data Check
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100">Ingest & Validate</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Reads candidate profiles, verifies required attributes (college tier, location, experience), and formats records.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono-tabular font-bold text-xs flex items-center justify-center">
                    2
                  </span>
                  <span className="text-[10px] font-mono-tabular text-blue-300 font-bold bg-blue-950 px-2 py-0.5 rounded">
                    Scoring
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100">Score Candidates</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Evaluates each candidate using your chosen path (native model, live API endpoint, or historical decision list).
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-xl bg-slate-800/80 border border-indigo-500/50 space-y-2 bg-indigo-950/30">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-mono-tabular font-bold text-xs flex items-center justify-center">
                    3
                  </span>
                  <span className="text-[10px] font-mono-tabular text-indigo-300 font-bold bg-indigo-950 px-2 py-0.5 rounded">
                    Decision
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100">Decide Audit Depth</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  If a live model is available (Path 1 or 2A), enables full interrogation. If decisions-only (Path 2B), routes to statistical audit.
                </p>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono-tabular font-bold text-xs flex items-center justify-center">
                    4
                  </span>
                  <span className="text-[10px] font-mono-tabular text-blue-300 font-bold bg-blue-950 px-2 py-0.5 rounded">
                    Deep Engine
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100">Run the Audit</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Computes feature attributions, runs counterfactual tests, and checks group selection rates against EEOC standards.
                </p>
              </div>

              {/* Step 5 */}
              <div className="p-4 rounded-xl bg-slate-800/80 border border-emerald-500/50 space-y-2 bg-emerald-950/20">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-mono-tabular font-bold text-xs flex items-center justify-center">
                    5
                  </span>
                  <span className="text-[10px] font-mono-tabular text-emerald-300 font-bold bg-emerald-950 px-2 py-0.5 rounded">
                    Complete
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-100">Return Results</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Delivers interactive candidate dashboards, plain-language risk breakdowns, and mitigation options.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: What the Audit Actually Checks */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-blue-600 font-mono-tabular font-bold text-xs uppercase tracking-wider mb-1">
            <span>STEP 3</span>
            <span>•</span>
            <span>AUDIT METRICS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            3. What the Audit Actually Checks
          </h2>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Checksum inspects individual decisions, tests model sensitivity, and verifies group-level legal compliance.
          </p>
        </div>

        {/* 3 Core Audit Checks Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Check 1: Feature Attribution (SHAP) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl p-6 bg-white border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 w-fit">
              <BarChart3 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Feature Attribution (SHAP)
              </h3>
              <p className="text-xs font-semibold text-blue-600 font-mono-tabular mt-0.5">
                Which factors actually drove each score
              </p>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Uncovers exactly how much credit or penalty each profile feature (e.g., years of experience, college tier, location) added to a candidate's final score.
            </p>

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
              <span className="font-bold text-slate-700">Why it matters:</span> Ensures candidate evaluations are based on genuine qualifications rather than arbitrary proxies.
            </div>
          </motion.div>

          {/* Check 2: Counterfactual Perturbation */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="rounded-2xl p-6 bg-white border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 w-fit">
              <Sliders className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Counterfactual Perturbation
              </h3>
              <p className="text-xs font-semibold text-amber-700 font-mono-tabular mt-0.5">
                The live "what-if" stress test
              </p>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Changes a single candidate attribute (e.g., changing college tier from Tier-2 to Tier-1 while keeping skills identical) to test whether the outcome shifts unfairly.
            </p>

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
              <span className="font-bold text-slate-700">Why it matters:</span> Exposes hidden algorithmic bias by testing identical profiles under changed protected attributes.
            </div>
          </motion.div>

          {/* Check 3: Adverse Impact (EEOC 4/5ths Rule) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="rounded-2xl p-6 bg-white border border-slate-200 shadow-sm space-y-4 hover:shadow-md transition-shadow"
          >
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 w-fit">
              <Scale className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Adverse Impact (EEOC 4/5ths Rule)
              </h3>
              <p className="text-xs font-semibold text-emerald-700 font-mono-tabular mt-0.5">
                Legally recognized selection threshold
              </p>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Calculates the selection rate ratio between demographic groups. If a subgroup's selection rate falls below 80% (4/5ths) of the highest group, it flags potential adverse impact.
            </p>

            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
              <span className="font-bold text-slate-700">Why it matters:</span> Provides clear, objective compliance indicators recognized by regulatory and HR standards.
            </div>
          </motion.div>
        </div>

        {/* Path 2B Special Note Banner */}
        <div className="p-4 sm:p-5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="p-2.5 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-700/80 shrink-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Path 2B (Decisions-Only) Audit Scope Note</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-tabular bg-emerald-900/80 text-emerald-300 font-bold border border-emerald-700">
                Statistical Only
              </span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              When auditing pre-existing scores or decisions without a live model endpoint (Path 2B), Checksum performs the <strong>EEOC adverse-impact statistical check</strong>. Feature attribution (SHAP) and live "what-if" stress tests are skipped because there is no live model to interrogate.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4: After the Audit & Mitigation */}
      <section className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2 text-blue-600 font-mono-tabular font-bold text-xs uppercase tracking-wider mb-1">
            <span>STEP 4</span>
            <span>•</span>
            <span>OUTCOMES & REMEDIATION</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            4. After the Audit: Results & Mitigation
          </h2>
          <p className="text-sm text-slate-600 mt-1 font-medium">
            Explore per-candidate audit breakdowns and view calibrated outcomes that resolve adverse impact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Per-Candidate Exploration */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-blue-600">
              <FileCheck2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Per-Candidate Explanations</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Drill down into individual candidates to see why they scored higher or lower. Review ranked feature contributions and test interactive what-if scenarios in real time.
            </p>
          </div>

          {/* Mitigation & Recalibration */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2.5 text-indigo-600">
              <ShieldCheck className="w-5 h-5" />
              <h3 className="text-base font-bold text-slate-900">Mitigation & Recalibration View</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              View optimized subgroup threshold recalibrations that balance selection ratios and eliminate adverse impact without disrupting merit-based candidate order.
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="p-[1px] rounded-2xl bg-gradient-to-r from-blue-500/50 via-indigo-500/40 to-blue-600/50 shadow-xl">
        <div className="rounded-[15px] bg-slate-900 p-8 sm:p-10 text-center space-y-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-2xl pointer-events-none" />

          <div className="max-w-2xl mx-auto space-y-3 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-xs font-mono-tabular font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>READY TO AUDIT YOUR MODEL?</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Test Your Hiring Decisions For Fairness
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed font-normal">
              Upload your candidate dataset or connect your model endpoint to run a comprehensive bias audit in under a minute.
            </p>

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={onStartAudit}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="px-8 py-3 text-sm font-bold shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50"
              >
                Start Audit
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
