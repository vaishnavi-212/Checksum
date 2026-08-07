import React, { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Stepper } from '../ui/ProgressBar';
import { ErrorState } from '../ui/ErrorState';
import { getJobStatus, AuditStatusResponse } from '../../services/api';
import { JobStage } from '../../types/common';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Cpu,
  Clock,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';

export interface JobStatusTrackerProps {
  jobId: string;
  onViewResults: () => void;
  onBackToUpload?: () => void;
  className?: string;
}

const DEFAULT_STAGES: JobStage[] = [
  {
    id: 'node_ingest',
    label: 'Dataset Ingestion & Translation',
    description: 'Parsing candidate CSV features and mapping column synonyms',
    status: 'pending',
  },
  {
    id: 'node_score',
    label: 'Propensity Scoring',
    description: 'Running candidate vectors through scoring model',
    status: 'pending',
  },
  {
    id: 'node_audit_full',
    label: 'Bias Audit & Perturbation Suite',
    description: 'Executing SHAP attribution and counterfactual field perturbations',
    status: 'pending',
  },
  {
    id: 'node_explain',
    label: 'Findings Narrative Synthesis',
    description: 'Generating human-readable executive audit summary',
    status: 'pending',
  },
];

export const JobStatusTracker: React.FC<JobStatusTrackerProps> = ({
  jobId,
  onViewResults,
  onBackToUpload,
  className = '',
}) => {
  const [statusData, setStatusData] = useState<AuditStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchStatus = async () => {
    try {
      const data = await getJobStatus(jobId);
      setStatusData(data);
      setError(null);

      // Auto view results if done and user has not clicked yet
      if (data.status === 'done') {
        // We leave option for user to click "View Results" or auto-trigger
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Poll every 1.5 seconds if job is queued or running
    const interval = setInterval(() => {
      if (statusData?.status === 'done' || statusData?.status === 'failed') {
        clearInterval(interval);
        return;
      }
      fetchStatus();
    }, 1500);

    return () => clearInterval(interval);
  }, [jobId, statusData?.status]);

  // Compute stages progress
  const stages: JobStage[] = DEFAULT_STAGES.map((s) => {
    if (!statusData) return s;

    if (statusData.status === 'done') {
      return { ...s, status: 'done' };
    }

    if (statusData.status === 'failed') {
      if (statusData.progress === s.id) {
        return { ...s, status: 'failed' };
      }
    }

    if (statusData.progress === s.id) {
      return { ...s, status: 'running' };
    }

    // Determine done steps based on order
    const stageIds = DEFAULT_STAGES.map((x) => x.id);
    const currIdx = stageIds.indexOf(statusData.progress || '');
    const thisIdx = stageIds.indexOf(s.id);

    if (currIdx !== -1 && thisIdx < currIdx) {
      return { ...s, status: 'done' };
    }

    return s;
  });

  const isDone = statusData?.status === 'done';
  const isFailed = statusData?.status === 'failed';
  const isRunning = statusData?.status === 'running' || statusData?.status === 'queued';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Card */}
      <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              {isRunning ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isDone ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold text-slate-900">
                  Audit Job Execution Status
                </h2>
                <Badge
                  variant={isDone ? 'success' : isFailed ? 'danger' : 'primary'}
                  size="md"
                >
                  {statusData?.status ? statusData.status.toUpperCase() : 'QUEUED'}
                </Badge>
                {statusData?.audit_mode && (
                  <Badge variant="neutral" size="sm">
                    Mode: {statusData.audit_mode}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 font-mono-tabular mt-1">
                Tracking Job ID: <strong className="text-slate-900">{jobId}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onBackToUpload && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToUpload}
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                className="text-xs text-slate-600 hover:bg-slate-50 border border-slate-200"
              >
                Back to Upload
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStatus}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="text-xs text-slate-600 hover:bg-slate-50 border border-slate-200"
            >
              Poll Status
            </Button>
          </div>
        </div>

        {/* Stepper showing stage progress */}
        <Stepper stages={stages} title="AUDIT PIPELINE NODE STAGES" />

        {/* Error message if job failed */}
        {isFailed && (
          <ErrorState
            title="Audit Job Failed"
            detail={statusData?.error || 'Execution encountered an error during graph execution.'}
            errorCode="JOB_EXECUTION_FAILED"
          />
        )}

        {/* Action Button when done */}
        {isDone && (
          <div className="p-5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-emerald-950">
                  Audit Execution Completed Successfully
                </h3>
                <p className="text-xs text-emerald-800">
                  SHAP attribution and counterfactual perturbations are ready for review.
                </p>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={onViewResults}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              View Audit Results
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};
