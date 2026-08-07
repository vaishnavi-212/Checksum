import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...props }) => (
  <div
    className={`bg-slate-200/80 rounded animate-shimmer select-none ${className}`}
    {...props}
  />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => (
  <div className={`space-y-2.5 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-3.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-5 rounded-xl border border-slate-200 bg-white space-y-4 shadow-xs ${className}`}>
    <div className="flex items-center justify-between">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <Skeleton className="h-8 w-1/2" />
    <SkeletonText lines={2} />
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 4,
  columns = 4,
  className = '',
}) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs ${className}`}>
    <div className="flex items-center gap-4 pb-3 border-b border-slate-100">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-4 py-2">
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={c} className="h-3.5 flex-1" />
        ))}
      </div>
    ))}
  </div>
);
