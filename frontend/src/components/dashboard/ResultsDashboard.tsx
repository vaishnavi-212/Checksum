import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { SkeletonCard, SkeletonTable } from '../ui/Skeleton';
import { PerturbationView } from './PerturbationView';
import { StatisticalOnlyView } from './StatisticalOnlyView';
import { AvailabilityReportCard } from './AvailabilityReportCard';
import { ExplanationCard } from './ExplanationCard';
import { MitigationPanel } from './MitigationPanel';
import { getJobResults, getJobExplanation, ResultsResponse } from '../../services/api';
import {
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

export interface ResultsDashboardProps {
  jobId: string;
  onBackToUpload?: () => void;
  className?: string;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  jobId,
  onBackToUpload,
  className = '',
}) => {
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<any>(null);

  const fetchResultsData = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const resData = await getJobResults(jobId);
      setResults(resData);

      // Fetch explanation narrative
      try {
        const expData = await getJobExplanation(jobId);
        setExplanation(expData.explanation);
      } catch {
        // Explanation might be optional or in results already
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (jobId) {
      fetchResultsData();
    }
  }, [jobId]);

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Card className="p-6 bg-white border border-slate-200/90 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-1/3 bg-slate-200 rounded animate-pulse" />
            <div className="h-6 w-20 bg-slate-200 rounded-full animate-pulse" />
          </div>
          <div className="h-4 w-2/3 bg-slate-100 rounded animate-pulse" />
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonTable rows={5} columns={6} />
      </div>
    );
  }

  if (error || !results) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToUpload}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Upload
          </Button>
        </div>

        <ErrorState
          error={error}
          title="Could Not Load Audit Results"
          onRetry={() => fetchResultsData(true)}
          isRetrying={isRefreshing}
        />
      </div>
    );
  }

  // Determine mode
  const auditMode = results.audit_mode || 'perturbation';
  const isPerturbationMode = auditMode === 'perturbation';

  return (
    <div className={`space-y-8 ${className}`}>
      {/* 1. Header & Navigation Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3">
          {onBackToUpload && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToUpload}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
              className="bg-white text-slate-700 hover:bg-slate-50 border-slate-200 shadow-2xs"
            >
              New Audit Job
            </Button>
          )}

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Algorithmic Bias Audit Report
              </h1>
              <Badge variant={isPerturbationMode ? 'primary' : 'warning'} size="md">
                {isPerturbationMode ? 'Perturbation Audit' : 'Statistical-Only Audit'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-mono-tabular">
              Job ID: <code className="font-bold text-slate-800">{jobId}</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchResultsData(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            className="text-xs text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Visible Warnings Banner (Never Suppress Warnings) */}
      {results.warnings && results.warnings.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200/90 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Pipeline Audit Warnings ({results.warnings.length})</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs text-amber-900 font-mono-tabular pl-1">
            {results.warnings.map((warn, idx) => (
              <li key={idx} className="leading-relaxed">
                {warn}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 3. Executive Findings Narrative Card */}
      <ExplanationCard explanationText={explanation} />

      {/* 4. Branched Screen Layout based strictly on audit_mode */}
      {isPerturbationMode ? (
        <PerturbationView
          jobId={jobId}
          shapSummary={results.shap_summary}
          perturbationResults={results.perturbation_results}
          scores={results.scores}
        />
      ) : (
        <StatisticalOnlyView
          statisticalResults={results.statistical_results}
          scores={results.scores}
        />
      )}

      {/* 5. Bias Mitigation & Policy Adjustment Panel */}
      <MitigationPanel
        jobId={jobId}
        auditMode={auditMode}
        results={results}
        fixStatus={results.fix_applied ? 'done' : 'idle'}
        onRefreshResults={() => fetchResultsData(true)}
      />

      {/* 6. Shared Availability Report Card */}
      <AvailabilityReportCard report={results.availability_report} />
    </div>
  );
};
