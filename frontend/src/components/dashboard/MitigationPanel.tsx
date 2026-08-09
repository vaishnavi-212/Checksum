import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { StatCard } from '../ui/StatCard';
import { ProgressBar } from '../ui/ProgressBar';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import {
  ResultsResponse,
  FixBeforeAfter,
  MitigationMeta,
  triggerFix,
  getJobStatus,
} from '../../services/api';
import {
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Info,
  ShieldCheck,
  RotateCw,
  Sliders,
  Check,
  AlertCircle,
  BarChart2,
  Minus,
} from 'lucide-react';

export interface MitigationPanelProps {
  jobId: string;
  auditMode?: string;
  results: ResultsResponse;
  fixStatus?: string;
  onRefreshResults: () => Promise<void>;
}

const STRATEGIES = [
  {
    id: 'auto',
    name: 'Auto (Group-Mean Adjustment)',
    description: 'Applies per-group score adjustments toward the global mean score without retraining the model.',
    enabled: true,
  },
  {
    id: 'reweight',
    name: 'Reweight Training Samples',
    description: 'Fairlearn ExponentiatedGradient reweighting algorithm.',
    enabled: false,
    tag: 'Not yet available',
  },
  {
    id: 'threshold_adjust',
    name: 'Group-Specific Threshold Adjustment',
    description: 'Applies custom qualification thresholds per demographic subgroup.',
    enabled: false,
    tag: 'Not yet available',
  },
  {
    id: 'drop_top_flagged_feature',
    name: 'Drop Top Flagged Feature',
    description: 'Removes the highest non-job-related predictive feature from scoring.',
    enabled: false,
    tag: 'Not yet available',
  },
];

export const MitigationPanel: React.FC<MitigationPanelProps> = ({
  jobId,
  auditMode,
  results,
  fixStatus = 'idle',
  onRefreshResults,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>('auto');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);
  const [pollingStatus, setPollingStatus] = useState<string>(fixStatus);

  // Sync internal polling status
  useEffect(() => {
    setPollingStatus(fixStatus);
  }, [fixStatus]);

  // Polling loop when fix_status is "running"
  useEffect(() => {
    let interval: any = null;

    if (pollingStatus === 'running') {
      interval = setInterval(async () => {
        try {
          const statusRes = await getJobStatus(jobId);
          const currentFixStatus = statusRes.fix_status || 'idle';
          setPollingStatus(currentFixStatus);

          if (currentFixStatus === 'done' || currentFixStatus === 'failed') {
            clearInterval(interval);
            await onRefreshResults();
          }
        } catch (err) {
          console.error('Error polling fix status:', err);
        }
      }, 2500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [pollingStatus, jobId, onRefreshResults]);

  const handleTriggerFix = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await triggerFix(jobId, selectedStrategy);
      setPollingStatus('running');
      setIsModalOpen(false);
    } catch (err: any) {
      // 409 "fix already running" -> set running status gracefully
      if (err?.error_code === 'JOB_NOT_FINISHED' || err?.detail?.includes('already running')) {
        setPollingStatus('running');
        setIsModalOpen(false);
      } else {
        setError(err);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStatisticalOnly = auditMode === 'statistical_only';
  const fixData: FixBeforeAfter | null = results.fix_before_after || null;
  const isFixDone = pollingStatus === 'done' || results.fix_applied === true || !!fixData;
  const isFixRunning = pollingStatus === 'running';

  // Extract metrics from fixData if available
  const beforePct = fixData?.pedigree_reliance_before_pct ?? results.shap_summary?.pedigree_reliance_pct ?? null;
  const afterPct = fixData?.pedigree_reliance_after_pct ?? null;
  const isImproved = fixData?.improved ?? (beforePct !== null && afterPct !== null && afterPct < beforePct);
  const deltaPct = beforePct !== null && afterPct !== null ? afterPct - beforePct : null;
  const meta: MitigationMeta | undefined = fixData?.mitigation_meta;

  // Compute honest outcome badge and description from real values
  let outcomeBadgeVariant: 'success' | 'danger' | 'neutral' = 'neutral';
  let outcomeBadgeText = 'NO SIGNIFICANT CHANGE';
  let outcomeDescription = 'Baseline candidate predictions exhibited no significant subgroup score disparities prior to mitigation. Model predictions remained stable.';

  if (beforePct !== null && afterPct !== null && deltaPct !== null) {
    if (isImproved && deltaPct < 0) {
      outcomeBadgeVariant = 'success';
      outcomeBadgeText = `REDUCED RELIANCE (${deltaPct.toFixed(1)} pts)`;
      outcomeDescription = `Subgroup mean score adjustment reduced pedigree/proxy reliance by ${Math.abs(deltaPct).toFixed(1)} percentage points, from ${beforePct.toFixed(1)}% down to ${afterPct.toFixed(1)}%.`;
    } else if (!isImproved && deltaPct > 1.0) {
      outcomeBadgeVariant = 'danger';
      outcomeBadgeText = `RELIANCE INCREASED (+${deltaPct.toFixed(1)} pts)`;
      outcomeDescription = `Group-mean score adjustment increased pedigree/proxy reliance by ${deltaPct.toFixed(1)} percentage points (from ${beforePct.toFixed(1)}% to ${afterPct.toFixed(1)}%), despite equalizing group-mean scores. This mitigation strategy may not be reducing the model's attributable reliance on protected/proxy attributes.`;
    } else {
      outcomeBadgeVariant = 'neutral';
      outcomeBadgeText = 'NO SIGNIFICANT CHANGE';
      const deltaSign = deltaPct > 0 ? '+' : '';
      outcomeDescription = `Group-mean score adjustment produced no significant change in pedigree/proxy reliance (${beforePct.toFixed(1)}% vs ${afterPct.toFixed(1)}%, delta: ${deltaSign}${deltaPct.toFixed(1)} pts). Model feature importance remained stable.`;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner & Action Button */}
      <Card variant="default" className="p-6 border-l-4 border-l-blue-600 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Automated Bias Mitigation & Policy Adjustment
              </h2>
              {isFixDone && (
                <Badge variant="done" size="sm">
                  Mitigation Applied
                </Badge>
              )}
              {isFixRunning && (
                <Badge variant="running" size="sm" icon={<RotateCw className="w-3 h-3 animate-spin" />}>
                  Running Fix
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
              Recalibrate scoring models to reduce non-job-related group discrepancies. Apply post-scoring group-mean adjustments to ensure fair representation while maintaining skill predictive accuracy.
            </p>
          </div>

          <div className="shrink-0">
            {isStatisticalOnly ? (
              <Button variant="outline" size="md" disabled leftIcon={<Info className="w-4 h-4" />}>
                Model Access Required
              </Button>
            ) : isFixRunning ? (
              <Button variant="outline" size="md" isLoading disabled>
                Mitigating Bias...
              </Button>
            ) : (
              <Button
                variant={isFixDone ? 'secondary' : 'primary'}
                size="md"
                onClick={() => setIsModalOpen(true)}
                leftIcon={<Sparkles className="w-4 h-4 text-blue-500" />}
              >
                {isFixDone ? 'Re-run Mitigation' : 'Run Bias Mitigation'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Error state if submission failed */}
      {error && (
        <ErrorState
          error={error}
          title="Failed to Trigger Bias Mitigation"
          onRetry={() => setIsModalOpen(true)}
        />
      )}

      {/* Statistical Only / Tier 3 Note */}
      {isStatisticalOnly && (
        <EmptyState
          icon={<ShieldCheck className="w-8 h-8 text-slate-400" />}
          title="Mitigation Not Available for Tier 3 Jobs"
          description="Model access was not provided during ingestion (statistical-only audit). Automated mitigation requires model scoring access to calculate per-group adjustments."
        />
      )}

      {/* Note from backend fix_before_after if present */}
      {fixData?.note && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-950">Mitigation Note</h4>
            <p className="text-amber-800 font-mono-tabular mt-0.5">{fixData.note}</p>
          </div>
        </div>
      )}

      {/* Running State */}
      {isFixRunning && (
        <Card variant="default" className="p-6 bg-slate-900 text-slate-100 border-slate-800">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <RotateCw className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Applying Group-Mean Bias Mitigation...
                  </h3>
                  <p className="text-xs text-slate-400">
                    Re-scoring candidate records, computing subgroup mean score offsets, and re-running SHAP feature reliance.
                  </p>
                </div>
              </div>
              <Badge variant="info" size="sm">
                In Progress
              </Badge>
            </div>

            <ProgressBar value={65} status="warning" label="Recalibrating model predictions..." />
          </div>
        </Card>
      )}

      {/* Finished Mitigation Results Display */}
      {isFixDone && !isFixRunning && fixData && (
        <div className="space-y-6">
          {/* Top Metric Comparison Grid — Side-by-Side Outcome Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 1. Pre-Mitigation Baseline Card */}
            <Card variant="default" className="p-5 bg-slate-50/90 border-slate-200/90 shadow-2xs flex flex-col justify-between space-y-4 h-full">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-wider">
                    BEFORE MITIGATION
                  </span>
                  <Badge variant="neutral" size="sm">
                    Baseline Model
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
                    {beforePct !== null ? `${beforePct.toFixed(1)}%` : 'N/A'}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 block">
                    Pedigree & Proxy Feature Reliance
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-[11px] text-slate-500 leading-normal font-mono-tabular">
                Initial weight assigned to non-merit demographic and pedigree proxies prior to adjustment.
              </div>
            </Card>

            {/* 2. Post-Mitigation Recalibrated Card */}
            <Card
              variant="default"
              className={`p-5 flex flex-col justify-between space-y-4 h-full transition-all ${
                isImproved
                  ? 'bg-emerald-50/40 border-emerald-300/90 shadow-sm ring-1 ring-emerald-500/10'
                  : 'bg-slate-50/90 border-slate-200 shadow-2xs'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-wider">
                    AFTER MITIGATION
                  </span>
                  <Badge variant={isImproved ? 'done' : 'neutral'} size="sm">
                    {isImproved ? 'Recalibrated' : 'Post-Adjustment'}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-extrabold font-mono-tabular text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>{afterPct !== null ? `${afterPct.toFixed(1)}%` : 'N/A'}</span>
                    {deltaPct !== null && (
                      Math.abs(deltaPct) <= 0.01 || beforePct === afterPct ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300/70 font-mono-tabular inline-flex items-center gap-1">
                          <Minus className="w-3 h-3 text-slate-500" />
                          No significant change
                        </span>
                      ) : deltaPct < 0 ? (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono-tabular inline-flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-emerald-700" />
                          {deltaPct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 font-mono-tabular">
                          +{deltaPct.toFixed(1)}%
                        </span>
                      )
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-600 block">
                    Post-Mitigation Pedigree Reliance
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 text-[11px] text-slate-500 leading-normal font-mono-tabular">
                Adjusted weight following post-scoring group-mean score equalization across demographic tiers.
              </div>
            </Card>

            {/* 3. Mitigation Outcome Analysis Card */}
            <Card variant="default" className="p-5 bg-white border-slate-200 flex flex-col justify-between space-y-4 h-full shadow-2xs">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-wider block">
                    MITIGATION OUTCOME
                  </span>
                  <Badge variant="info" size="sm">
                    Policy Summary
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Badge variant={outcomeBadgeVariant} size="md">
                    {outcomeBadgeText}
                  </Badge>

                  <p className="text-xs text-slate-600 leading-relaxed font-mono-tabular mt-1.5">
                    {outcomeDescription}
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 leading-normal font-mono-tabular flex items-center justify-between">
                <span>Applied Strategy:</span>
                <strong className="text-slate-900 font-bold">{fixData.strategy_applied || 'group_mean_adjustment'}</strong>
              </div>
            </Card>
          </div>

          {/* Audit Transparency & Candidate Exclusion Disclosures */}
          {meta && (
            <Card variant="default" className="p-5 bg-slate-50/80 border-slate-200/90 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5 mb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Candidate Batch Ingestion Metadata
                  </h3>
                </div>
                <Badge variant="neutral" size="sm">
                  Batch Disclosures
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono-tabular">
                <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Total Records</span>
                  <span className="text-base font-extrabold text-slate-900">{meta.n_total_candidates ?? 'N/A'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Scored Candidates</span>
                  <span className="text-base font-extrabold text-emerald-700">{meta.n_candidates_used ?? 'N/A'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Scoring Errors</span>
                  <span className={`text-base font-extrabold ${(meta.n_scoring_errors ?? 0) > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {meta.n_scoring_errors ?? 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200/80 space-y-0.5">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Dropped Groups</span>
                  <span className="text-sm font-bold text-slate-700 truncate block" title={meta.groups_dropped?.join(', ')}>
                    {meta.groups_dropped && meta.groups_dropped.length > 0 ? meta.groups_dropped.join(', ') : 'None'}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* After-Mitigation SHAP Feature Breakdown */}
          {fixData.after_summary && (
            <Card variant="default" className="p-6 bg-white border-slate-200 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-blue-600" />
                    <h3 className="text-base font-bold text-slate-900">
                      Post-Mitigation Feature Reliance Breakdown
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Recalibrated SHAP importance weights following group-mean bias mitigation
                  </p>
                </div>
                <Badge variant="info" size="sm">
                  SHAP Recalibrated
                </Badge>
              </div>

              <div className="space-y-4 font-mono-tabular">
                {(() => {
                  const summary = fixData.after_summary;
                  let featuresList: Array<{ name: string; pct: number; isPedigree?: boolean }> = [];

                  if (summary?.top_features && Array.isArray(summary.top_features)) {
                    featuresList = summary.top_features.map((feat: any) => ({
                      name: feat.feature_name || feat.feature || 'Unknown',
                      pct: typeof feat.importance_pct === 'number' ? feat.importance_pct : 0,
                      isPedigree: feat.category === 'pedigree' || feat.is_pedigree,
                    }));
                  } else if (summary?.feature_importances && typeof summary.feature_importances === 'object') {
                    featuresList = Object.entries(summary.feature_importances).map(([fname, val]) => ({
                      name: fname,
                      pct: typeof val === 'number' ? val : 0,
                      isPedigree:
                        (summary?.pedigree_fields && Array.isArray(summary.pedigree_fields))
                          ? summary.pedigree_fields.includes(fname)
                          : ['college_tier', 'college_name', 'is_metro', 'university_tier', 'zip_code'].some(
                              (p) => fname.toLowerCase().includes(p)
                            ),
                    }));
                  }

                  if (featuresList.length === 0) {
                    return <p className="text-xs text-slate-500 italic py-2">No feature breakdown available.</p>;
                  }

                  // Find max percentage to scale relative bars accurately
                  const maxPct = Math.max(...featuresList.map((f) => f.pct), 1);

                  return (
                    <div className="space-y-4">
                      <div className="space-y-3 pt-1">
                        {featuresList.map((feat, idx) => {
                          const isPedigree =
                            feat.isPedigree ||
                            ((summary?.pedigree_fields && Array.isArray(summary.pedigree_fields))
                              ? summary.pedigree_fields.includes(feat.name)
                              : ['college_tier', 'college_name', 'is_metro', 'university_tier', 'zip_code'].some(
                                  (p) => feat.name.toLowerCase().includes(p)
                                ));

                          const relativeBarPct = (feat.pct / maxPct) * 100;
                          // Ensure every non-zero feature is visually legible with minimum 3% rendered bar width
                          const visibleBarPct = Math.max(feat.pct > 0 ? 3 : 1.5, relativeBarPct);

                          return (
                            <div key={idx} className="flex items-center gap-3 text-xs font-mono-tabular">
                              {/* Feature Name & Pill */}
                              <div className="w-32 sm:w-40 shrink-0 flex items-center justify-between pr-2">
                                <span className="font-bold text-slate-800 truncate" title={feat.name}>
                                  {feat.name}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                    isPedigree
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200/80'
                                      : 'bg-blue-100 text-blue-800 border border-blue-200/80'
                                  }`}
                                >
                                  {isPedigree ? 'Pedigree' : 'Skill'}
                                </span>
                              </div>

                              {/* Horizontal Fill Bar */}
                              <div className="flex-1 h-3.5 bg-slate-200/80 rounded-full overflow-hidden border border-slate-200/60 relative">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isPedigree ? 'bg-amber-500' : 'bg-blue-600'
                                  }`}
                                  style={{ width: `${visibleBarPct}%` }}
                                  title={`${feat.name}: ${feat.pct.toFixed(2)}%`}
                                />
                              </div>

                              {/* Numeric Value */}
                              <div className="w-14 text-right font-bold text-slate-800 font-mono-tabular">
                                {feat.pct.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Scale Axis at bottom matching the range */}
                      <div className="pt-2 border-t border-slate-200/80">
                        <div className="flex items-center gap-3 font-mono-tabular text-[10px] text-slate-500">
                          <div className="w-32 sm:w-40 shrink-0 text-right pr-2 font-semibold">Scale Axis</div>
                          <div className="flex-1 flex justify-between px-0.5 font-semibold text-slate-600">
                            <span>0.0%</span>
                            <span>{(maxPct * 0.25).toFixed(1)}%</span>
                            <span>{(maxPct * 0.50).toFixed(1)}%</span>
                            <span>{(maxPct * 0.75).toFixed(1)}%</span>
                            <span>{maxPct.toFixed(1)}%</span>
                          </div>
                          <div className="w-14 text-right font-bold text-slate-700">% Weight</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Strategy Selection Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        size="md"
        title={
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            <span className="text-base font-bold text-slate-900">
              Configure Bias Mitigation Strategy
            </span>
          </div>
        }
      >
        <div className="space-y-5">
          <p className="text-xs text-slate-500 leading-relaxed">
            Select a mitigation algorithm to recalibrate the model. Note that non-implemented strategies are disabled to enforce operational compliance.
          </p>

          <div className="space-y-3">
            {STRATEGIES.map((strat) => {
              const isSelected = selectedStrategy === strat.id;

              return (
                <div
                  key={strat.id}
                  onClick={() => strat.enabled && setSelectedStrategy(strat.id)}
                  className={`p-3.5 rounded-xl border text-xs transition-all ${
                    !strat.enabled
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-500/20 cursor-pointer'
                      : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="mitigation_strategy"
                        checked={isSelected}
                        disabled={!strat.enabled}
                        onChange={() => setSelectedStrategy(strat.id)}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">{strat.name}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                          {strat.description}
                        </p>
                      </div>
                    </div>

                    {!strat.enabled && strat.tag && (
                      <Badge variant="neutral" size="sm">
                        {strat.tag}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" size="md" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleTriggerFix}
              isLoading={isSubmitting}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Apply Mitigation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
