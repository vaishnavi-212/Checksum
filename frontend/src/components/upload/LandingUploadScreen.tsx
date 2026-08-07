import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Globe,
  Sparkles,
  Check,
  Copy,
  ArrowRight,
  ShieldCheck,
  Cpu,
  BarChart3,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { FileDropzone } from '../ui/FileDropzone';
import { ErrorState } from '../ui/ErrorState';
import { useToast } from '../ui/Toast';
import {
  uploadCandidatesOnly,
  uploadCandidatesExternal,
  UploadResponse,
} from '../../services/api';
import { ApiErrorPayload } from '../../types/common';

export interface LandingUploadScreenProps {
  onJobCreated?: (response: UploadResponse) => void;
  className?: string;
}

type AuditPathType = '1' | '2a' | '2b';

export const LandingUploadScreen: React.FC<LandingUploadScreenProps> = ({
  onJobCreated,
  className = '',
}) => {
  const { addToast } = useToast();

  // Selected Audit Path state
  const [activePath, setActivePath] = useState<AuditPathType>('1');

  // File Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // External Endpoint state (Path 2a)
  const [externalEndpoint, setExternalEndpoint] = useState<string>('');
  const [endpointError, setEndpointError] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedJob, setSubmittedJob] = useState<UploadResponse | null>(null);
  const [apiError, setApiError] = useState<ApiErrorPayload | null>(null);
  const [copiedJobId, setCopiedJobId] = useState<boolean>(false);

  // URL validation for Path 2a
  const validateUrl = (url: string): boolean => {
    if (!url || url.trim().length === 0) return false;
    try {
      const parsed = new URL(url.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleEndpointChange = (val: string) => {
    setExternalEndpoint(val);
    setApiError(null);
    if (val.trim() && !validateUrl(val)) {
      setEndpointError('URL must start with http:// or https://');
    } else {
      setEndpointError(null);
    }
  };

  // Quick sample dataset loader
  const handleLoadSampleDataset = () => {
    const csvContent = `candidate_id,gender,age,years_exp,skill_score,education_level,prior_decisions
CAND_101,Female,34,8,88,Masters,Shortlisted
CAND_102,Male,29,5,76,Bachelors,Shortlisted
CAND_103,Female,45,14,92,Doctorate,Shortlisted
CAND_104,Male,24,2,61,Bachelors,Rejected
CAND_105,Non-Binary,38,10,84,Masters,Shortlisted
CAND_106,Female,52,20,95,Masters,Rejected
CAND_107,Male,31,6,79,Bachelors,Shortlisted
CAND_108,Female,28,4,82,Masters,Rejected`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const sampleFile = new File([blob], 'checksum_candidate_dataset_sample.csv', {
      type: 'text/csv',
    });

    setSelectedFile(sampleFile);
    setApiError(null);
    setSubmittedJob(null);

    addToast({
      type: 'info',
      title: 'Sample Dataset Loaded',
      message: 'Loaded checksum_candidate_dataset_sample.csv (8 records, 4 protected classes).',
    });
  };

  // Form validity check
  const isFormValid = (): boolean => {
    if (!selectedFile) return false;
    if (activePath === '2a') {
      return validateUrl(externalEndpoint);
    }
    return true;
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !isFormValid()) return;

    setIsSubmitting(true);
    setApiError(null);
    setSubmittedJob(null);

    try {
      let result: UploadResponse;

      if (activePath === '1') {
        result = await uploadCandidatesOnly(selectedFile);
      } else if (activePath === '2a') {
        result = await uploadCandidatesExternal(selectedFile, externalEndpoint.trim());
      } else {
        // Path 2b (Decisions-only, no endpoint)
        result = await uploadCandidatesExternal(selectedFile);
      }

      setSubmittedJob(result);
      onJobCreated?.(result);

      addToast({
        type: 'success',
        title: 'Audit Job Created',
        message: `Job ID ${result.job_id.substring(0, 12)}... successfully queued for path ${result.path.toUpperCase()}`,
      });
    } catch (err) {
      const errorPayload = err as ApiErrorPayload;
      setApiError(errorPayload);

      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: errorPayload.detail || 'Could not queue audit job.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyJobId = () => {
    if (!submittedJob) return;
    navigator.clipboard.writeText(submittedJob.job_id);
    setCopiedJobId(true);
    setTimeout(() => setCopiedJobId(false), 2000);
  };

  return (
    <div className={`w-full space-y-8 ${className}`}>
      {/* 1. Hero / Intro Section on Dark Canvas */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/90 p-6 md:p-8 shadow-md">
        <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
        
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Badge variant="primary" className="shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Ingestion & Audit Pipeline
            </Badge>
            <span className="text-xs font-mono-tabular text-slate-500 font-medium">
              Multi-Path Pipeline Architecture
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
            AI Hiring-Bias Audit & Algorithmic Fairness Platform
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Ingest candidate records, evaluate propensity scores against Checksum's vectorized hiring agent or external REST endpoints, and run counterfactual perturbation tests to audit EEOC 4/5ths Rule compliance.
          </p>
        </div>
      </div>

      {/* 2. Main Ingestion Card */}
      <Card className="p-6 md:p-8 space-y-6 bg-white border border-slate-200/90 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest block">
              STEP 1 • SELECT AUDIT PATH
            </span>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              Choose Scoring Model & Audit Strategy
            </h2>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLoadSampleDataset}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-blue-600" />}
            className="text-xs text-blue-700 hover:bg-blue-50/80 border border-blue-200/60 self-start sm:self-auto shadow-2xs"
          >
            Load Sample Candidates CSV
          </Button>
        </div>

        {/* Path Selection Cards */}
        <div
          role="radiogroup"
          aria-label="Audit Strategy & Path Selection"
          className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch"
        >
          {/* Path 1 Tab */}
          <button
            type="button"
            role="radio"
            aria-checked={activePath === '1'}
            onClick={() => {
              setActivePath('1');
              setApiError(null);
            }}
            className={`group p-5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between h-full min-h-[210px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.99] ${
              activePath === '1'
                ? 'bg-blue-50/70 border-2 border-blue-600 shadow-sm text-slate-900 -translate-y-0.5'
                : 'bg-white border-slate-200/90 text-slate-700 shadow-xs hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 border border-blue-200/80 text-[10px] font-mono-tabular font-bold uppercase tracking-wider">
                  Path 1
                </span>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                    activePath === '1'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
                  }`}
                >
                  <Cpu className="w-4 h-4 stroke-[2.2]" />
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-900 mt-3 mb-1">
                Checksum Hiring Agent
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Audit candidate CSV against native vectorized XGBoost scoring model with full SHAP attribution.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono-tabular text-slate-600 font-medium">
              <span>Model Access: <strong className="text-slate-800">Full</strong></span>
              {activePath === '1' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-white/90 px-2 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 fill-blue-100" />
                  Selected
                </span>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-300 group-hover:border-blue-400 transition-colors" />
              )}
            </div>
          </button>

          {/* Path 2a Tab */}
          <button
            type="button"
            role="radio"
            aria-checked={activePath === '2a'}
            onClick={() => {
              setActivePath('2a');
              setApiError(null);
            }}
            className={`group p-5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between h-full min-h-[210px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 active:scale-[0.99] ${
              activePath === '2a'
                ? 'bg-purple-50/70 border-2 border-purple-600 shadow-sm text-slate-900 -translate-y-0.5'
                : 'bg-white border-slate-200/90 text-slate-700 shadow-xs hover:border-purple-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-800 border border-purple-200/80 text-[10px] font-mono-tabular font-bold uppercase tracking-wider">
                  Path 2a
                </span>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                    activePath === '2a'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-purple-50 group-hover:text-purple-600'
                  }`}
                >
                  <Globe className="w-4 h-4 stroke-[2.2]" />
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-900 mt-3 mb-1">
                External Model Endpoint
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Query a third-party REST endpoint dynamically during counterfactual perturbation scoring.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono-tabular text-slate-600 font-medium">
              <span>Model Access: <strong className="text-slate-800">REST Endpoint</strong></span>
              {activePath === '2a' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-white/90 px-2 py-0.5 rounded-full border border-purple-200 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 fill-purple-100" />
                  Selected
                </span>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-300 group-hover:border-purple-400 transition-colors" />
              )}
            </div>
          </button>

          {/* Path 2b Tab */}
          <button
            type="button"
            role="radio"
            aria-checked={activePath === '2b'}
            onClick={() => {
              setActivePath('2b');
              setApiError(null);
            }}
            className={`group p-5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between h-full min-h-[210px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 active:scale-[0.99] ${
              activePath === '2b'
                ? 'bg-amber-50/70 border-2 border-amber-600 shadow-sm text-slate-900 -translate-y-0.5'
                : 'bg-white border-slate-200/90 text-slate-700 shadow-xs hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-200/80 text-[10px] font-mono-tabular font-bold uppercase tracking-wider">
                  Path 2b
                </span>
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                    activePath === '2b'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-amber-50 group-hover:text-amber-600'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 stroke-[2.2]" />
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-900 mt-3 mb-1">
                Decisions-Only Dataset
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Audit pre-computed hiring decisions and historical scores without model endpoint access.
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono-tabular text-slate-600 font-medium">
              <span>Model Access: <strong className="text-slate-800">Statistical Only</strong></span>
              {activePath === '2b' ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-white/90 px-2 py-0.5 rounded-full border border-amber-200 shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 fill-amber-100" />
                  Selected
                </span>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-300 group-hover:border-amber-400 transition-colors" />
              )}
            </div>
          </button>
        </div>

        {/* Path 2a Conditional External Endpoint Field */}
        {activePath === '2a' && (
          <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-2 animate-in fade-in duration-200">
            <label htmlFor="external-endpoint-url" className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-purple-600" />
              External Scoring Model Endpoint URL <span className="text-rose-600">*</span>
            </label>
            <input
              id="external-endpoint-url"
              type="url"
              value={externalEndpoint}
              onChange={(e) => handleEndpointChange(e.target.value)}
              placeholder="https://api.yourcompany.ai/v1/score"
              className={`w-full px-3.5 py-2 text-xs font-mono-tabular bg-white rounded-lg border focus:outline-none transition-all ${
                endpointError
                  ? 'border-rose-300 focus:ring-2 focus:ring-rose-500/20 text-rose-950'
                  : 'border-purple-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-slate-900'
              }`}
            />
            {endpointError ? (
              <p className="text-[11px] text-rose-600 font-mono-tabular">{endpointError}</p>
            ) : (
              <p className="text-[11px] text-slate-500 leading-relaxed flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-slate-400" />
                Endpoint must accept candidate JSON feature payloads and return propensity scores.
              </p>
            )}
          </div>
        )}

        {/* File Dropzone */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest block">
              STEP 2 • INGEST CANDIDATE DATASET
            </span>
            <span className="text-xs text-slate-400 font-mono-tabular">Supported: .CSV</span>
          </div>

          <FileDropzone
            accept=".csv"
            maxSizeMB={25}
            selectedFile={selectedFile}
            onFileSelect={(file) => {
              setSelectedFile(file);
              setApiError(null);
              setSubmittedJob(null);
            }}
          />
        </div>

        {/* API Error Box if backend rejected upload */}
        {apiError && (
          <ErrorState
            error={apiError}
            title="Upload Rejected by Audit Engine"
            className="animate-in fade-in duration-150"
          />
        )}

        {/* Submit Action */}
        <form onSubmit={handleSubmit} className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
          <div className="text-xs text-slate-500 font-mono-tabular text-center sm:text-left">
            {selectedFile ? (
              <span className="text-slate-800 font-semibold">
                Ready: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            ) : (
              <span>Select a CSV file to begin job orchestration.</span>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            disabled={!isFormValid() || isSubmitting}
            leftIcon={<UploadCloud className="w-4 h-4 stroke-[2.5]" />}
            className="w-full sm:w-auto shadow-md"
          >
            {isSubmitting ? 'Queuing Audit Job...' : 'Start Bias Audit'}
          </Button>
        </form>
      </Card>

      {/* 3. Success Feedback Banner / Job Created Overlay */}
      {submittedJob && (
        <Card className="p-6 bg-emerald-50/80 border border-emerald-200/90 shadow-md animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Check className="w-5 h-5 stroke-[3]" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-emerald-950">
                    Audit Job Successfully Queued
                  </h3>
                  <span className="px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900 text-[10px] font-mono-tabular font-bold uppercase tracking-wider border border-emerald-300">
                    Status: {submittedJob.status}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-900 text-[10px] font-mono-tabular font-bold uppercase tracking-wider border border-emerald-300">
                    Path: {submittedJob.path.toUpperCase()}
                  </span>
                </div>

                <p className="text-xs text-emerald-800 leading-relaxed">
                  The audit job has been registered in the job store and passed to the LangGraph pipeline.
                </p>

                <div className="pt-2 flex items-center gap-2">
                  <span className="text-[11px] font-mono-tabular text-emerald-900 font-bold">Job ID:</span>
                  <code className="px-2 py-1 bg-white/90 rounded border border-emerald-300 text-xs font-mono-tabular text-emerald-950 font-bold select-all">
                    {submittedJob.job_id}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyJobId}
                    leftIcon={copiedJobId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    className="text-xs text-emerald-800 hover:bg-emerald-100/80 border border-emerald-200"
                  >
                    {copiedJobId ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  if (submittedJob) {
                    onJobCreated?.(submittedJob);
                  }
                }}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full md:w-auto shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Track Audit Status
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
