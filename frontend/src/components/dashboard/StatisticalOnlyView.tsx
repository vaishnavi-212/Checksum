import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StatCard } from '../ui/StatCard';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { ErrorState } from '../ui/ErrorState';
import { StatisticalResults, ScoreItem } from '../../services/api';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Scale,
  Users,
  Info,
  GitCompare,
  Percent,
} from 'lucide-react';

export interface StatisticalOnlyViewProps {
  statisticalResults?: StatisticalResults | null;
  scores?: ScoreItem[] | null;
  className?: string;
}

export const StatisticalOnlyView: React.FC<StatisticalOnlyViewProps> = ({
  statisticalResults,
  scores,
  className = '',
}) => {
  if (!statisticalResults) {
    return (
      <ErrorState
        title="No Statistical Audit Results Available"
        detail="The audit job did not return a statistical_results payload."
        className={className}
      />
    );
  }

  // Handle job-level statistical error (e.g. missing columns)
  if (statisticalResults.error) {
    return (
      <ErrorState
        title="Statistical Audit Could Not Run"
        detail={statisticalResults.error}
        errorCode="STATISTICAL_AUDIT_FAILED"
        className={className}
      />
    );
  }

  const groupField = statisticalResults.group_field || 'group_field';
  const outcomeField = statisticalResults.outcome_field || 'outcome_field';
  const nGroups = statisticalResults.n_groups ?? 0;
  const selectionRates = statisticalResults.selection_rates || {};

  const fourFifths = statisticalResults.four_fifths_rule;
  const isFourFifthsFlagged = fourFifths?.flag ?? false;

  const demoParity = statisticalResults.demographic_parity;
  const isDemoParityFlagged = demoParity?.flag ?? false;

  const matchedPair = statisticalResults.matched_pair;

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Context Banner Card */}
      <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold text-slate-900">
                  Statistical-Only Historical Decisions Audit
                </h2>
                <Badge variant="warning" size="sm">
                  Path 2B • Query-Only Mode
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Evaluating adverse impact & parity across historical decisions dataset without model endpoint query access
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap font-mono-tabular text-xs">
            <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
              Group Column: <strong className="text-slate-900">{groupField}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
              Outcome Column: <strong className="text-slate-900">{outcomeField}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-amber-100/80 border border-amber-200 text-amber-900 font-bold">
              {nGroups} Subgroups
            </span>
          </div>
        </div>

        {/* Top Tier Stat Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* EEOC 4/5ths Rule Card */}
          <Card className={`p-5 space-y-3 ${isFourFifthsFlagged ? 'bg-rose-50/70 border-rose-200/90' : 'bg-emerald-50/70 border-emerald-200/90'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-tabular font-bold text-slate-600 uppercase tracking-wider">
                EEOC 4/5ths Rule Test
              </span>
              {isFourFifthsFlagged ? (
                <Badge variant="danger" size="sm">
                  Adverse Impact
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  Compliant
                </Badge>
              )}
            </div>

            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
              {isFourFifthsFlagged ? 'Flagged (< 80%)' : 'Passed Compliance'}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-mono-tabular">
              {isFourFifthsFlagged
                ? 'At least one protected subgroup selection rate falls below 80% of the highest selection rate group.'
                : 'All protected subgroup selection rates exceed 80% of the top-performing benchmark group.'}
            </p>
          </Card>

          {/* Demographic Parity Card */}
          <Card className={`p-5 space-y-3 ${isDemoParityFlagged ? 'bg-amber-50/70 border-amber-200/90' : 'bg-slate-50 border-slate-200/90'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-tabular font-bold text-slate-600 uppercase tracking-wider">
                Demographic Parity Gap
              </span>
              {isDemoParityFlagged ? (
                <Badge variant="warning" size="sm">
                  Gap Exceeded
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  Within Limit
                </Badge>
              )}
            </div>

            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
              {demoParity?.difference !== undefined ? `${(demoParity.difference * 100).toFixed(1)}%` : 'N/A'}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-mono-tabular">
              Difference between max rate ({(demoParity?.max_rate ?? 0) * 100}%) and min rate ({(demoParity?.min_rate ?? 0) * 100}%). Threshold: {((demoParity?.threshold ?? 0.2) * 100).toFixed(0)}%.
            </p>
          </Card>

          {/* Matched Pair Card */}
          <Card className="p-5 space-y-3 bg-slate-50 border border-slate-200/90">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-tabular font-bold text-slate-600 uppercase tracking-wider">
                Matched-Pair Fisher Test
              </span>
              {matchedPair?.flag ? (
                <Badge variant="danger" size="sm">
                  Disparity
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  {matchedPair?.p_value !== undefined ? `p = ${matchedPair.p_value}` : 'Info'}
                </Badge>
              )}
            </div>

            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
              {matchedPair?.n_pairs !== undefined ? `${matchedPair.n_pairs} Pairs` : 'N/A'}
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-mono-tabular">
              {matchedPair?.assumptions || 'Score-binned Fisher exact test comparing selection rates across groups.'}
            </p>
          </Card>
        </div>
      </Card>

      {/* Group Selection Rates Table */}
      <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest block">
              SUBGROUP SELECTION RATES & RATIOS
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">
              Selection Rates & 80% Rule Benchmark Ratios
            </h3>
          </div>

          <Badge variant="neutral" size="sm">
            {Object.keys(selectionRates).length} Groups Measured
          </Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subgroup ({groupField})</TableHead>
              <TableHead className="text-right">Selection Rate (%)</TableHead>
              <TableHead className="text-right">Ratio vs. Top Group</TableHead>
              <TableHead>EEOC 4/5ths Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(selectionRates).map(([groupName, rawRate]) => {
              const rate = Number(rawRate);
              const ratePct = (rate * 100).toFixed(1);
              const ratio = Number(fourFifths?.ratios?.[groupName] ?? 1.0);
              const ratioStr = (ratio * 100).toFixed(1);
              const isFlagged = fourFifths?.flagged_groups?.[groupName] !== undefined || ratio < 0.8;

              return (
                <TableRow key={groupName}>
                  <TableCell className="font-mono-tabular font-bold text-slate-900 text-xs">
                    {groupName}
                  </TableCell>
                  <TableCell className="text-right font-mono-tabular font-extrabold text-xs text-slate-900">
                    {ratePct}%
                  </TableCell>
                  <TableCell className="text-right font-mono-tabular text-xs">
                    <span className={ratio < 0.8 ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                      {ratioStr}%
                    </span>
                  </TableCell>
                  <TableCell>
                    {isFlagged ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono-tabular font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Adverse Impact (&lt; 80%)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-mono-tabular font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Pass
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Matched Pair Breakdown or Error State */}
      {matchedPair && (
        <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <GitCompare className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">
                Matched-Pair Disparity Analysis
              </h3>
            </div>
            {matchedPair.p_value !== undefined && (
              <Badge variant={matchedPair.flag ? 'danger' : 'neutral'} size="sm">
                p-value = {matchedPair.p_value}
              </Badge>
            )}
          </div>

          {matchedPair.error || matchedPair.note?.includes('Insufficient') ? (
            <ErrorState
              title="Matched-Pair Test Note / Limitation"
              detail={matchedPair.error || matchedPair.note}
              errorCode="MATCHED_PAIR_NOTE"
            />
          ) : (
            <div className="space-y-3 font-mono-tabular text-xs text-slate-700">
              <p>
                <strong>Reference Group:</strong> {matchedPair.reference_group || 'N/A'} |{' '}
                <strong>Comparison Group:</strong> {matchedPair.comparison_group || 'N/A'}
              </p>
              {matchedPair.contingency_table && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase">Contingency Matrix</span>
                  <p className="text-slate-600">
                    [[Selected, Rejected]]: {JSON.stringify(matchedPair.contingency_table)}
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
