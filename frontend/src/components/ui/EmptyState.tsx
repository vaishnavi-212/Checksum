import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <Inbox className="w-8 h-8 text-slate-400" />,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`p-8 md:p-12 text-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}>
      <div className="p-3.5 rounded-full bg-white border border-slate-200 mb-4 shadow-xs">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
};
