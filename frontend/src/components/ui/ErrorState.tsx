import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { ApiErrorPayload } from '../../types/common';

export interface ErrorStateProps {
  error?: ApiErrorPayload | string | null;
  errorCode?: string;
  detail?: string;
  title?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  errorCode: customErrorCode,
  detail: customDetail,
  title = 'An error occurred',
  onRetry,
  isRetrying = false,
  className = '',
}) => {
  let errorCode = customErrorCode;
  let detail = customDetail;

  if (typeof error === 'string') {
    detail = error;
  } else if (error && typeof error === 'object') {
    errorCode = errorCode || error.error_code;
    detail = detail || error.detail;
  }

  return (
    <div className={`p-5 rounded-xl border border-rose-200 bg-rose-50/60 shadow-xs ${className}`}>
      <div className="flex items-start gap-3.5">
        <div className="p-2 rounded-lg bg-rose-100 border border-rose-200 text-rose-700 shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h4 className="text-sm font-semibold text-rose-950">{title}</h4>
            {errorCode && (
              <span className="px-2 py-0.5 rounded font-mono-tabular text-[11px] font-semibold bg-rose-100 border border-rose-300 text-rose-800">
                {errorCode}
              </span>
            )}
          </div>

          <p className="text-xs text-rose-900 mt-1.5 leading-relaxed font-mono-tabular">
            {detail || 'Failed to complete request. Please verify system logs or contact support.'}
          </p>

          {onRetry && (
            <div className="mt-3.5">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                isLoading={isRetrying}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                className="border-rose-300 text-rose-800 bg-white hover:bg-rose-50"
              >
                Retry Request
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
