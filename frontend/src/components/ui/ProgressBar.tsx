import React from 'react';
import { JobStage } from '../../types/common';
import { Check, Loader2, XCircle } from 'lucide-react';

export interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  status?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  showPercentage = true,
  size = 'md',
  status = 'default',
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const heightStyles = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-3.5',
  };

  const statusGradients = {
    default: 'bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 shadow-[0_0_12px_rgba(37,99,235,0.35)]',
    success: 'bg-gradient-to-r from-emerald-600 to-teal-500 shadow-[0_0_12px_rgba(16,185,129,0.35)]',
    warning: 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_0_12px_rgba(245,158,11,0.35)]',
    danger: 'bg-gradient-to-r from-rose-600 to-red-500 shadow-[0_0_12px_rgba(244,63,94,0.35)]',
  };

  return (
    <div className={`w-full space-y-2 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs text-slate-800 font-semibold tracking-tight">
          {label && <span className="truncate">{label}</span>}
          {showPercentage && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200/80 text-blue-700 font-mono-tabular font-bold text-xs shadow-2xs">
              {Math.round(clampedValue)}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-slate-100 border border-slate-200/80 rounded-full p-0.5 overflow-hidden shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)] ${heightStyles[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out relative ${statusGradients[status]}`}
          style={{ width: `${clampedValue}%` }}
        >
          {/* Leading edge light highlight */}
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/40 rounded-full blur-[1px]" />
        </div>
      </div>
    </div>
  );
};

export interface StepperProps {
  stages: JobStage[];
  currentStageId?: string;
  title?: string;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  stages,
  title = 'AUDIT PIPELINE PROGRESS STEPS',
  className = '',
}) => {
  return (
    <div className={`w-full space-y-3 ${className}`}>
      {/* Header Label */}
      {title && (
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest">
            {title}
          </span>
          <span className="text-[11px] font-mono-tabular font-semibold text-slate-400">
            {stages.filter((s) => s.status === 'done').length} / {stages.length} Completed
          </span>
        </div>
      )}

      {/* Vertical Stack of Step Rows */}
      <div className="space-y-2.5">
        {stages.map((stage, idx) => {
          const isDone = stage.status === 'done';
          const isRunning = stage.status === 'running';
          const isFailed = stage.status === 'failed';
          const isPending = stage.status === 'pending';

          return (
            <div
              key={stage.id}
              className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${
                isDone
                  ? 'bg-slate-50/90 border-slate-200/80 text-slate-900 shadow-2xs hover:border-slate-300'
                  : isRunning
                  ? 'bg-blue-50/90 border-2 border-blue-500/90 shadow-sm shadow-blue-500/10 text-blue-950 scale-[1.01]'
                  : isFailed
                  ? 'bg-rose-50/90 border-2 border-rose-500/90 text-rose-950 shadow-xs'
                  : 'bg-white/40 border-dashed border-slate-200/90 text-slate-400 hover:border-slate-300 opacity-70 hover:opacity-100'
              }`}
            >
              {/* Left Side: Status Icon/Number + Text Block */}
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Status Indicator */}
                <div className="shrink-0 flex items-center justify-center">
                  {isDone ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs shadow-emerald-600/30">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : isRunning ? (
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/30">
                      <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                    </div>
                  ) : isFailed ? (
                    <div className="w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs shadow-rose-600/30">
                      <XCircle className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full border border-slate-300/80 bg-white/80 text-slate-400 font-mono-tabular text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </div>
                  )}
                </div>

                {/* Text Block */}
                <div className="min-w-0 space-y-0.5">
                  <div
                    className={`text-xs sm:text-sm font-bold truncate leading-tight ${
                      isDone
                        ? 'text-slate-900'
                        : isRunning
                        ? 'text-blue-950 font-extrabold'
                        : isFailed
                        ? 'text-rose-950'
                        : 'text-slate-500 font-semibold'
                    }`}
                  >
                    {stage.label}
                  </div>
                  {stage.description && (
                    <div
                      className={`text-[11px] font-mono-tabular truncate leading-tight ${
                        isDone
                          ? 'text-slate-500'
                          : isRunning
                          ? 'text-blue-800/90 font-medium'
                          : isFailed
                          ? 'text-rose-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {stage.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Status Tag */}
              <div className="shrink-0 pl-3">
                {isDone && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 text-[10px] font-mono-tabular font-bold uppercase tracking-wider border border-emerald-200/60">
                    Done
                  </span>
                )}
                {isRunning && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-mono-tabular font-bold uppercase tracking-wider shadow-2xs animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    Running
                  </span>
                )}
                {isFailed && (
                  <span className="inline-flex px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-mono-tabular font-bold uppercase tracking-wider border border-rose-200">
                    Failed
                  </span>
                )}
                {isPending && (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[10px] font-mono-tabular font-bold uppercase tracking-wider border border-slate-200/60">
                    Pending
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


