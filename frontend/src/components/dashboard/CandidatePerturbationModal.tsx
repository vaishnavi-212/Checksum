import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { ScoreItem, perturbCandidate, PerturbCandidateResponse } from '../../services/api';
import {
  Sliders,
  Sparkles,
  ArrowRight,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react';

export interface CandidatePerturbationModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  candidate: ScoreItem | null;
}

const FIELD_CONFIGS = [
  { id: 'gender', label: 'Gender (Protected)', type: 'select', options: ['Male', 'Female', 'Non-binary'] },
  { id: 'college_tier', label: 'College Tier (Socioeconomic Proxy)', type: 'select', options: [1, 2, 3] },
  { id: 'is_metro', label: 'Is Metro (Geographic Proxy)', type: 'select', options: [1, 0] },
  { id: 'age', label: 'Age (Protected)', type: 'number', min: 18, max: 80 },
  { id: 'career_gap_months', label: 'Career Gap Months', type: 'number', min: 0, max: 60 },
  { id: 'experience_years', label: 'Experience Years', type: 'number', min: 0, max: 40 },
  { id: 'screening_score', label: 'Screening Score', type: 'number', min: 0, max: 100 },
];

export const CandidatePerturbationModal: React.FC<CandidatePerturbationModalProps> = ({
  isOpen,
  onClose,
  jobId,
  candidate,
}) => {
  const [selectedField, setSelectedField] = useState<string>('gender');
  const [newValue, setNewValue] = useState<any>('Male');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [perturbResult, setPerturbResult] = useState<PerturbCandidateResponse | null>(null);
  const [error, setError] = useState<any>(null);

  // When candidate or field changes, set defaults
  useEffect(() => {
    if (candidate) {
      setPerturbResult(null);
      setError(null);

      // Default value based on current candidate field or fallback
      const fieldConfig = FIELD_CONFIGS.find((f) => f.id === selectedField);
      if (fieldConfig) {
        if (fieldConfig.type === 'select') {
          const orig = candidate[selectedField];
          const defaultOpt = fieldConfig.options?.[0];
          setNewValue(orig !== undefined && orig !== null ? orig : defaultOpt);
        } else if (fieldConfig.type === 'number') {
          const origNum = Number(candidate[selectedField]);
          setNewValue(!isNaN(origNum) ? origNum : 25);
        }
      }
    }
  }, [candidate, selectedField]);

  if (!candidate) return null;

  const currentFieldConfig = FIELD_CONFIGS.find((f) => f.id === selectedField);
  const originalVal = candidate[selectedField] !== undefined ? String(candidate[selectedField]) : 'N/A';

  const handleRunTest = async () => {
    setIsSubmitting(true);
    setError(null);
    setPerturbResult(null);

    try {
      // Format number if needed
      let formattedValue = newValue;
      if (currentFieldConfig?.type === 'number') {
        formattedValue = Number(newValue);
      } else if (selectedField === 'is_metro' || selectedField === 'college_tier') {
        formattedValue = isNaN(Number(newValue)) ? newValue : Number(newValue);
      }

      const res = await perturbCandidate(jobId, candidate.candidate_id, selectedField, formattedValue);
      setPerturbResult(res);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const delta = perturbResult?.delta ?? 0;
  const isPositiveDelta = delta > 0;
  const isNegativeDelta = delta < 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Counterfactual What-If Perturbation
            </h2>
            <p className="text-xs text-slate-500 font-mono-tabular">
              Candidate ID: <strong className="text-slate-900">{candidate.candidate_id}</strong>
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Candidate Context Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono-tabular">
          <div>
            <span className="text-slate-400 block text-[11px] uppercase">Candidate ID</span>
            <span className="font-bold text-slate-900">{candidate.candidate_id}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] uppercase">Original Score</span>
            <span className="font-bold text-slate-900">
              {candidate.score !== null && candidate.score !== undefined ? candidate.score.toFixed(1) : 'N/A'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] uppercase">Initial Decision</span>
            <Badge variant="neutral" size="sm">
              {candidate.decision || 'Scored'}
            </Badge>
          </div>
        </div>

        {/* Form Controls */}
        <div className="space-y-4 p-5 rounded-xl bg-white border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            Configure What-If Field Modification
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Field Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Target Field</label>
              <select
                value={selectedField}
                onChange={(e) => setSelectedField(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {FIELD_CONFIGS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 font-mono-tabular">
                Original Value: <strong className="text-slate-700">{originalVal}</strong>
              </p>
            </div>

            {/* New Value Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">Perturbed New Value</label>

              {currentFieldConfig?.type === 'select' ? (
                <select
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {currentFieldConfig.options?.map((opt) => (
                    <option key={String(opt)} value={opt}>
                      {String(opt)} {selectedField === 'is_metro' ? (opt === 1 ? '(Metro)' : '(Non-Metro)') : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min={currentFieldConfig?.min}
                  max={currentFieldConfig?.max}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono-tabular focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              variant="primary"
              size="md"
              onClick={handleRunTest}
              isLoading={isSubmitting}
              leftIcon={<Sparkles className="w-4 h-4" />}
            >
              Run Perturbation API Test
            </Button>
          </div>
        </div>

        {/* Error State if candidate scoring failed */}
        {error && (
          <ErrorState
            error={error}
            title="Candidate Perturbation Test Failed"
            errorCode={error.error_code || 'PERTURBATION_FAILED'}
          />
        )}

        {/* Perturbation Result View */}
        {perturbResult && (
          <div className="p-5 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 space-y-4 animate-in fade-in duration-200 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Live Perturbation Response
                </span>
              </div>
              <Badge variant={isPositiveDelta ? 'success' : isNegativeDelta ? 'danger' : 'neutral'} size="sm">
                Delta: {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)} pts
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center font-mono-tabular">
              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Original Score</span>
                <span className="text-lg font-bold text-white">
                  {perturbResult.original_score.toFixed(1)}
                </span>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Perturbed Score</span>
                <span className="text-lg font-bold text-blue-400">
                  {perturbResult.perturbed_score.toFixed(1)}
                </span>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase">Score Shift</span>
                <span className={`text-lg font-extrabold ${isPositiveDelta ? 'text-emerald-400' : isNegativeDelta ? 'text-rose-400' : 'text-slate-300'}`}>
                  {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/80 text-xs text-slate-300 font-mono-tabular leading-relaxed">
              Changing <strong>{perturbResult.field}</strong> from{' '}
              <span className="text-amber-400 font-bold">{String(perturbResult.original_value)}</span> to{' '}
              <span className="text-emerald-400 font-bold">{String(perturbResult.new_value)}</span> caused candidate{' '}
              <strong>{perturbResult.candidate_id}</strong>'s score to shift by{' '}
              <strong className={isPositiveDelta ? 'text-emerald-400' : isNegativeDelta ? 'text-rose-400' : 'text-slate-200'}>
                {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)} pts
              </strong>.
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
