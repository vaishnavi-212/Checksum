import React from 'react';
import { Card } from './Card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  delta?: {
    value: string | number;
    isPositive?: boolean;
    isNeutral?: boolean;
    label?: string;
  };
  icon?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  delta,
  icon,
  variant = 'default',
  className = '',
}) => {
  // Icon badge semantic background styles
  const iconVariantStyles = {
    default: 'bg-blue-50/90 border-blue-200/90 text-blue-600',
    success: 'bg-emerald-50/90 border-emerald-200/90 text-emerald-600',
    warning: 'bg-amber-50/90 border-amber-200/90 text-amber-600',
    danger: 'bg-rose-50/90 border-rose-200/90 text-rose-600',
    info: 'bg-sky-50/90 border-sky-200/90 text-sky-600',
  };

  return (
    <Card className={`p-5 flex flex-col justify-between h-full relative overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.4)] ${className}`}>
      {/* Top Row: Label (left) + Icon Badge (right) */}
      <div className="flex items-start justify-between gap-3 min-h-[36px]">
        <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest leading-tight line-clamp-2">
          {label}
        </span>
        {icon && (
          <div
            className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-200 hover:scale-105 ${
              iconVariantStyles[variant] || iconVariantStyles.default
            }`}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Middle Row: Dominant Tabular Metric */}
      <div className="my-2">
        <span className="text-3xl sm:text-4xl font-extrabold font-mono-tabular text-slate-900 tracking-tight leading-none">
          {value}
        </span>
      </div>

      {/* Bottom Row: Delta/Trend Chip + Context Helper Subtext */}
      <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col gap-1.5 justify-end">
        {delta && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-mono-tabular font-bold px-2 py-0.5 rounded-md border shadow-2xs ${
                delta.isNeutral
                  ? 'bg-slate-100/90 border-slate-200/90 text-slate-700'
                  : delta.isPositive
                  ? 'bg-emerald-50/90 border-emerald-200/90 text-emerald-800'
                  : 'bg-rose-50/90 border-rose-200/90 text-rose-800'
              }`}
            >
              {delta.isNeutral ? (
                <Minus className="w-3 h-3 stroke-[2.5]" />
              ) : delta.isPositive ? (
                <TrendingUp className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <TrendingDown className="w-3 h-3 stroke-[2.5]" />
              )}
              <span>{delta.value}</span>
            </span>
            {delta.label && (
              <span className="text-[11px] text-slate-500 font-medium truncate">{delta.label}</span>
            )}
          </div>
        )}

        {subtext && (
          <p className="text-xs text-slate-500 font-medium leading-normal truncate">
            {subtext}
          </p>
        )}
      </div>
    </Card>
  );
};

