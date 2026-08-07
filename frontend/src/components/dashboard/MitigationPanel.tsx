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

  return (
    <div className="space-y-6">
      {/* Header Banner & Action Button */}
      <Card variant="default" padding="lg" className="border-l-4 border-l-blue-600 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900">
                Automated Bias Mitigation & Policy Adjustment
              </h2>
              {isFixDone && (
                <Badge variant="success" size="sm">
                  Mitigation Applied
                </Badge>
              )}
              {isFixRunning && (
                <Badge variant="warning" size="sm" icon={<RotateCw className="w-3 h-3 animate-spin" />}>
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
        <Card variant="default" padding="lg" className="bg-slate-900 text-slate-100 border-slate-800">
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

            <ProgressBar progress={65} status="running" label="Recalibrating model predictions..." />
          </div>
        </Card>
      )}

      {/* Finished Mitigation Results Display */}
      {isFixDone && !isFixRunning && fixData && (
        <div className="space-y-6">
          {/* Top Metric Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Pedigree Reliance (Before)"
              value={beforePct !== null ? `${beforePct.toFixed(1)}%` : 'N/A'}
              subtitle="Pre-mitigation pedigree weight"
              variant="default"
              icon={<BarChart2 className="w-5 h-5 text-slate-400" />}
            />

            <StatCard
              title="Pedigree Reliance (After)"
              value={afterPct !== null ? `${afterPct.toFixed(1)}%` : 'N/A'}
              subtitle="Post-mitigation pedigree weight"
              variant={isImproved ? 'success' : 'default'}
              trend={
                deltaPct !== null
                  ? {
                      direction: deltaPct < 0 ? 'down' : 'up',
                      value: `${Math.abs(deltaPct).toFixed(1)}%`,
                    }
                  : undefined
              }
              icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
            />

            <Card variant="default" padding="md" className="flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Mitigation Outcome
                </span>
                <div className="mt-2 flex items-center gap-2">
                  {isImproved ? (
                    <Badge variant="success" size="md" icon={<Check className="w-3.5 h-3.5" />}>
                      Pedigree Reliance Reduced
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="md">
                      Minimal Shift Detected
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-500 font-mono-tabular mt-2">
                Strategy: <strong className="text-slate-900">{fixData.strategy_applied || 'group_mean_adjustment'}</strong>
              </div>
            </Card>
          </div>

          {/* Audit Transparency & Candidate Exclusion Disclosures */}
          {meta && (
            <Card variant="default" padding="md" className="bg-slate-50 border-slate-200">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
                Candidate Batch Ingestion Metadata
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono-tabular">
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase">Total Records</span>
                  <span className="text-sm font-bold text-slate-900">{meta.n_total_candidates ?? 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase">Scored Candidates</span>
                  <span className="text-sm font-bold text-emerald-700">{meta.n_candidates_used ?? 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase">Scoring Errors</span>
                  <span className={`text-sm font-bold ${(meta.n_scoring_errors ?? 0) > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {meta.n_scoring_errors ?? 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] uppercase">Dropped Groups</span>
                  <span className="text-sm font-bold text-slate-700">
                    {meta.groups_dropped && meta.groups_dropped.length > 0 ? meta.groups_dropped.join(', ') : 'None'}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* After-Mitigation SHAP Feature Breakdown */}
          {fixData.after_summary && (
            <Card variant="default" padding="lg">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Post-Mitigation Feature Reliance Breakdown
                  </h3>
                </div>
                <Badge variant="info" size="sm">
                  SHAP Recalibrated
                </Badge>
              </div>

              <div className="space-y-3 font-mono-tabular">
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
                      isPedigree: ['college_tier', 'college_name', 'is_metro'].includes(fname),
                    }));
                  }

                  if (featuresList.length === 0) {
                    return <p className="text-xs text-slate-500">No feature breakdown available.</p>;
                  }

                  return featuresList.map((feat, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-slate-800 flex items-center gap-1.5">
                          {feat.name}
                          {feat.isPedigree && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-600 border border-rose-200">
                              Pedigree
                            </span>
                          )}
                        </span>
                        <span className="font-bold text-slate-700">{feat.pct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${feat.isPedigree ? 'bg-amber-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(100, Math.max(0, feat.pct))}%` }}
                        />
                      </div>
                    </div>
                  ));
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
