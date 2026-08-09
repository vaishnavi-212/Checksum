import React from 'react';
import Markdown from 'react-markdown';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export interface ExplanationCardProps {
  explanationText?: string | null;
  isLoading?: boolean;
  className?: string;
}

const markdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="text-lg font-extrabold text-slate-900 mt-4 mb-2 first:mt-0 tracking-tight">
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-base font-extrabold text-slate-900 mt-4 mb-2 first:mt-0 tracking-tight">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-sm font-bold text-slate-900 mt-3 mb-1.5 first:mt-0">
      {children}
    </h3>
  ),
  p: ({ children }: any) => (
    <p className="text-sm text-slate-800 leading-relaxed mb-3 last:mb-0">
      {children}
    </p>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-inside space-y-1.5 mb-3 text-sm text-slate-800 pl-1">
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-inside space-y-1.5 mb-3 text-sm text-slate-800 pl-1">
      {children}
    </ol>
  ),
  li: ({ children }: any) => (
    <li className="leading-relaxed">
      {children}
    </li>
  ),
  strong: ({ children }: any) => (
    <strong className="font-bold text-slate-900">
      {children}
    </strong>
  ),
  code: ({ children }: any) => (
    <code className="font-mono-tabular text-xs bg-slate-200/70 text-slate-900 px-1.5 py-0.5 rounded font-medium">
      {children}
    </code>
  ),
  blockquote: ({ children }: any) => (
    <blockquote className="border-l-3 border-blue-500 pl-3.5 my-3 text-slate-700 italic text-sm bg-blue-50/50 py-1.5 rounded-r">
      {children}
    </blockquote>
  ),
};

export const ExplanationCard: React.FC<ExplanationCardProps> = ({
  explanationText,
  isLoading = false,
  className = '',
}) => {
  if (isLoading) {
    return (
      <Card className={`p-6 bg-white border border-slate-200/90 shadow-md ${className}`}>
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Generating Audit Findings Narrative</h3>
            <p className="text-xs text-slate-500">Synthesizing statistical evidence & SHAP attribution...</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-4 bg-slate-100 rounded w-full animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse" />
          <div className="h-4 bg-slate-100 rounded w-4/6 animate-pulse" />
        </div>
      </Card>
    );
  }

  if (!explanationText) {
    return null;
  }

  return (
    <Card className={`p-6 bg-white border border-slate-200/90 shadow-md space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900">
                Audit Findings Summary & Narrative
              </h3>
              <Badge variant="primary" size="sm">
                Executive Narrative
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated synthesized explanation derived from model SHAP attribution and counterfactual perturbations
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-tabular font-semibold text-slate-700 bg-slate-100 px-3 py-1 rounded-md border border-slate-200/80 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Verified Findings
        </span>
      </div>

      <div className="p-5 rounded-xl bg-slate-50/90 border border-slate-200/80 text-sm font-sans text-slate-800 leading-relaxed select-text">
        <Markdown components={markdownComponents}>
          {explanationText}
        </Markdown>
      </div>
    </Card>
  );
};

