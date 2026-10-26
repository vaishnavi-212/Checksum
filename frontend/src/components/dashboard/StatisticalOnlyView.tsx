import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { ErrorState } from '../ui/ErrorState';
import { StatisticalResults, ScoreItem } from '../../services/api';
import { BarChart3, AlertTriangle, CheckCircle, GitCompare, Info, Layers } from 'lucide-react';

export interface StatisticalOnlyViewProps {
  statisticalResults?: StatisticalResults | null;
  scores?: ScoreItem[] | null;
  className?: string;
}

const pct = (v?: number | null, digits = 1) =>
  v === undefined || v === null || Number.isNaN(Number(v)) ? '—' : `${(Number(v) * 100).toFixed(digits)}%`;

const fmtP = (p?: number | null) =>
  p === undefined || p === null ? '—' : p < 0.001 ? '< 0.001' : Number(p).toFixed(3);

const fieldLabel = (f?: string) => (f ? f.replace(/_/g, ' ') : 'group');

/** True when any of the three tests flagged this factor. */
const isFlagged = (r?: StatisticalResults | null) =>
  !!(r && (r.four_fifths_rule?.flag || r.demographic_parity?.flag || r.matched_pair?.flag));

export const StatisticalOnlyView: React.FC<StatisticalOnlyViewProps> = ({ statisticalResults, className = '' }) => {
  if (!statisticalResults) {
    return (
      <ErrorState
        title="No Statistical Audit Results Available"
        detail="The audit job did not return a statistical_results payload."
        className={className}
      />
    );
  }

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
  const selectionRates = statisticalResults.selection_rates || {};
  const groupSizes = statisticalResults.group_sizes || {};
  const minGroupSize = statisticalResults.min_group_size;
  const smallGroups = new Set(statisticalResults.insufficient_sample_groups || []);

  const fourFifths = statisticalResults.four_fifths_rule;
  const isFourFifthsFlagged = fourFifths?.flag ?? false;
  const fourFifthsEvaluable = !!fourFifths && Object.keys(fourFifths.ratios || {}).length >= 2;
  const notSignificant = fourFifths?.below_four_fifths_not_significant || {};

  const demoParity = statisticalResults.demographic_parity;
  const isDemoParityFlagged = demoParity?.flag ?? false;

  const matchedPair = statisticalResults.matched_pair;

  const allFactors: [string, StatisticalResults][] = [
    [groupField, statisticalResults],
    ...Object.entries(statisticalResults.additional_group_audits || {}),
  ];
  const flaggedFactors = statisticalResults.fields_flagged || allFactors.filter(([, r]) => isFlagged(r)).map(([f]) => f);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Context + headline tests for the primary factor */}
      <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold text-slate-900">Statistical-Only Historical Decisions Audit</h2>
                <Badge variant="warning" size="sm">
                  Path 2B • Decisions Only
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Compares selection rates between groups using the uploaded decisions. No scoring model was queried.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap font-mono-tabular text-xs">
            <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
              Group: <strong className="text-slate-900">{groupField}</strong>
            </span>
            <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
              Outcome: <strong className="text-slate-900">{outcomeField}</strong>
            </span>
            {minGroupSize !== undefined && (
              <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                Min group size: <strong className="text-slate-900">{minGroupSize}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Four-fifths */}
          <Card
            className={`p-5 space-y-3 ${
              isFourFifthsFlagged ? 'bg-rose-50/70 border-rose-200/90' : 'bg-emerald-50/70 border-emerald-200/90'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-tabular font-bold text-slate-600 uppercase tracking-wider">
                EEOC 4/5ths Rule
              </span>
              {isFourFifthsFlagged ? (
                <Badge variant="danger" size="sm">
                  Adverse Impact
                </Badge>
              ) : fourFifthsEvaluable ? (
                <Badge variant="success" size="sm">
                  Not Flagged
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  Not Evaluable
                </Badge>
              )}
            </div>
            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
              {isFourFifthsFlagged ? 'Flagged (< 80%)' : fourFifthsEvaluable ? 'Within 4/5ths' : 'N/A'}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-mono-tabular">
              {isFourFifthsFlagged
                ? 'At least one group is selected at under 80% of the top group’s rate, and the gap is statistically significant.'
                : fourFifths?.note ||
                  (Object.keys(notSignificant).length > 0
                    ? 'Some groups fall below 80%, but the gap is small enough to be chance at this sample size.'
                    : 'Every group is selected at 80% or more of the top group’s rate.')}
            </p>
          </Card>

          {/* Demographic parity */}
          <Card
            className={`p-5 space-y-3 ${
              isDemoParityFlagged ? 'bg-amber-50/70 border-amber-200/90' : 'bg-slate-50 border-slate-200/90'
            }`}
          >
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
                  Not Flagged
                </Badge>
              )}
            </div>
            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">{pct(demoParity?.difference)}</div>
            <p className="text-xs text-slate-600 leading-relaxed font-mono-tabular">
              Highest rate {pct(demoParity?.max_rate)} vs lowest {pct(demoParity?.min_rate)}. Flagged when the gap is over{' '}
              {pct(demoParity?.threshold ?? 0.15, 0)} and statistically significant (p = {fmtP(demoParity?.p_value)}).
            </p>
          </Card>

          {/* Matched comparison */}
          <Card className="p-5 space-y-3 bg-slate-50 border border-slate-200/90">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-tabular font-bold text-slate-600 uppercase tracking-wider">
                Like-for-like comparison
              </span>
              {matchedPair?.flag ? (
                <Badge variant="danger" size="sm">
                  Disparity
                </Badge>
              ) : (
                <Badge variant="neutral" size="sm">
                  {matchedPair?.p_value !== undefined ? `p = ${fmtP(matchedPair.p_value)}` : 'Info'}
                </Badge>
              )}
            </div>
            <div className="text-2xl font-extrabold font-mono-tabular text-slate-900">
              {matchedPair?.n_pairs ? `${matchedPair.n_pairs} score bands` : 'N/A'}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-mono-tabular">
              Compares candidates with similar screening scores, group by group, against the best-treated group
              (Cochran–Mantel–Haenszel test).
            </p>
          </Card>
        </div>
      </Card>

      {/* Every factor at a glance */}
      {allFactors.length > 1 && (
        <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-start gap-2.5">
              <Layers className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest block">
                  ALL FACTORS AUDITED
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">Selection gaps across every factor</h3>
              </div>
            </div>
            <Badge variant={flaggedFactors.length ? 'danger' : 'success'} size="sm">
              {flaggedFactors.length ? `${flaggedFactors.length} factor(s) flagged` : 'No factor flagged'}
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factor</TableHead>
                <TableHead>Groups (n)</TableHead>
                <TableHead className="text-right">Lowest / highest rate</TableHead>
                <TableHead>4/5ths</TableHead>
                <TableHead>Parity</TableHead>
                <TableHead>Like-for-like</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allFactors.map(([field, r]) => {
                const rates = Object.values(r.selection_rates || {});
                const sizes = r.group_sizes || {};
                const flag = (on?: boolean) =>
                  on ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                      <AlertTriangle className="w-3.5 h-3.5" /> Flagged
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle className="w-3.5 h-3.5" /> OK
                    </span>
                  );
                return (
                  <TableRow key={field}>
                    <TableCell className="font-mono-tabular font-bold text-slate-900 text-xs">
                      {fieldLabel(field)}
                      {r.grouping?.startsWith('binned') && (
                        <span className="block text-[10px] font-normal text-slate-500">grouped into ranges</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono-tabular text-xs text-slate-700">
                      {Object.keys(r.selection_rates || {})
                        .map((g) => `${g} (${sizes[g] ?? '?'})`)
                        .join(', ')}
                    </TableCell>
                    <TableCell className="text-right font-mono-tabular text-xs">
                      {rates.length ? `${pct(Math.min(...rates))} / ${pct(Math.max(...rates))}` : '—'}
                    </TableCell>
                    <TableCell>{flag(r.four_fifths_rule?.flag)}</TableCell>
                    <TableCell>{flag(r.demographic_parity?.flag)}</TableCell>
                    <TableCell>{flag(r.matched_pair?.flag)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-[11px] text-slate-500 leading-relaxed flex gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            A flag needs a statistically significant gap after correcting for testing several factors at once. Groups
            with fewer than {minGroupSize ?? 30} candidates are shown but never flagged.
          </p>
        </Card>
      )}

      {/* Primary factor detail */}
      <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest block">
              SUBGROUP SELECTION RATES & RATIOS
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">{fieldLabel(groupField)}: rates and 80% rule ratios</h3>
          </div>
          <Badge variant="neutral" size="sm">
            {Object.keys(selectionRates).length} Groups
          </Badge>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group ({groupField})</TableHead>
              <TableHead className="text-right">Candidates</TableHead>
              <TableHead className="text-right">Selection Rate</TableHead>
              <TableHead className="text-right">Ratio vs. Top Group</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(selectionRates).map(([groupName, rawRate]) => {
              const ratioRaw = fourFifths?.ratios?.[groupName];
              const ratio = ratioRaw === undefined ? null : Number(ratioRaw);
              const flagged = fourFifths?.flagged_groups?.[groupName] !== undefined;
              const chance = notSignificant[groupName] !== undefined;
              const tooSmall = smallGroups.has(groupName);

              return (
                <TableRow key={groupName}>
                  <TableCell className="font-mono-tabular font-bold text-slate-900 text-xs">{groupName}</TableCell>
                  <TableCell className="text-right font-mono-tabular text-xs text-slate-700">
                    {groupSizes[groupName] ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono-tabular font-extrabold text-xs text-slate-900">
                    {pct(Number(rawRate))}
                  </TableCell>
                  <TableCell className="text-right font-mono-tabular text-xs">
                    <span className={flagged ? 'text-rose-600 font-bold' : 'text-slate-800'}>{pct(ratio)}</span>
                  </TableCell>
                  <TableCell>
                    {flagged ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono-tabular font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Adverse Impact
                      </span>
                    ) : tooSmall ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono-tabular font-semibold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        Too few candidates
                      </span>
                    ) : chance ? (
                      <span className="inline-flex items-center gap-1 text-xs font-mono-tabular font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Below 80%, may be chance
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

      {/* Like-for-like detail */}
      {matchedPair && (
        <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <GitCompare className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-slate-900">Like-for-like comparison by score band</h3>
            </div>
            {matchedPair.p_value !== undefined && (
              <Badge variant={matchedPair.flag ? 'danger' : 'neutral'} size="sm">
                p = {fmtP(matchedPair.p_value)}
              </Badge>
            )}
          </div>

          {matchedPair.error || !matchedPair.n_pairs ? (
            <ErrorState
              title="Comparison not possible"
              detail={matchedPair.error || matchedPair.note || 'Not enough comparable candidates.'}
              errorCode="MATCHED_PAIR_NOTE"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Group vs. reference ({matchedPair.reference_group})</TableHead>
                  <TableHead className="text-right">Score bands</TableHead>
                  <TableHead className="text-right">Odds ratio</TableHead>
                  <TableHead className="text-right">p (adjusted)</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(matchedPair.comparisons || []).map((c) => (
                  <TableRow key={c.comparison_group}>
                    <TableCell className="font-mono-tabular font-bold text-xs text-slate-900">{c.comparison_group}</TableCell>
                    <TableCell className="text-right font-mono-tabular text-xs">{c.n_pairs}</TableCell>
                    <TableCell className="text-right font-mono-tabular text-xs">{c.common_odds_ratio ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono-tabular text-xs">{fmtP(c.p_value)}</TableCell>
                    <TableCell>
                      {c.flag ? (
                        <span className="text-xs font-bold text-rose-700">Disparity at equal scores</span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700">No significant difference</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-[11px] text-slate-500">
            Odds ratio above 1 means the reference group was more likely to be selected than this group at the same
            screening score.
          </p>
        </Card>
      )}
    </div>
  );
};
