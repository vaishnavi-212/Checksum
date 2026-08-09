import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { StatCard } from '../ui/StatCard';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSortHeader } from '../ui/Table';
import { CandidatePerturbationModal } from './CandidatePerturbationModal';
import { PerturbationResultItem, ShapSummaryItem, ScoreItem } from '../../services/api';
import {
  Brain,
  Sliders,
  Users,
  AlertOctagon,
  Scale,
  CheckCircle,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Sparkles,
} from 'lucide-react';

export interface PerturbationViewProps {
  jobId?: string;
  shapSummary?: ShapSummaryItem | null;
  perturbationResults?: PerturbationResultItem[] | null;
  scores?: ScoreItem[] | null;
  className?: string;
}

export const PerturbationView: React.FC<PerturbationViewProps> = ({
  jobId = '',
  shapSummary,
  perturbationResults,
  scores,
  className = '',
}) => {
  // Score table sorting state
  const [scoreSortCol, setScoreSortCol] = useState<string>('candidate_id');
  const [scoreSortDir, setScoreSortDir] = useState<'asc' | 'desc'>('asc');

  // Candidate Scores filtering/pagination
  const [showAllScores, setShowAllScores] = useState<boolean>(false);

  // Single candidate perturbation modal state
  const [selectedCandidate, setSelectedCandidate] = useState<ScoreItem | null>(null);
  const [isPerturbModalOpen, setIsPerturbModalOpen] = useState<boolean>(false);

  // Sorting handler for scores table
  const handleScoreSort = (col: string) => {
    if (scoreSortCol === col) {
      setScoreSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setScoreSortCol(col);
      setScoreSortDir('asc');
    }
  };

  const sortedScores = React.useMemo(() => {
    if (!scores) return [];
    const copy = [...scores];
    copy.sort((a, b) => {
      let valA: any = a.input_features?.[scoreSortCol] ?? a[scoreSortCol];
      let valB: any = b.input_features?.[scoreSortCol] ?? b[scoreSortCol];

      if (valA === null || valA === undefined) valA = -99999;
      if (valB === null || valB === undefined) valB = -99999;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return scoreSortDir === 'asc' ? valA - valB : valB - valA;
      }

      return scoreSortDir === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
    return copy;
  }, [scores, scoreSortCol, scoreSortDir]);

  const displayedScores = showAllScores ? sortedScores : sortedScores.slice(0, 10);

  // SHAP Skill vs Pedigree split values
  const skillPct = shapSummary?.skill_reliance_pct ?? 0;
  const pedigreePct = shapSummary?.pedigree_reliance_pct ?? 0;
  const explainMethod = shapSummary?.method || 'N/A';
  const isPedigreeFlagged = pedigreePct >= 20;

  // Feature importances as array sorted by importance
  const featureImportances = React.useMemo(() => {
    if (!shapSummary?.feature_importances) return [];
    const entries = Object.entries(shapSummary.feature_importances) as [string, number][];
    entries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
    const maxVal = entries.length > 0 ? Math.max(...entries.map(([, v]) => Math.abs(v))) : 1;
    return entries.map(([name, val]) => ({
      name,
      val,
      pct: maxVal > 0 ? (Math.abs(val) / maxVal) * 100 : 0,
    }));
  }, [shapSummary]);

  const maxImportanceVal = React.useMemo(() => {
    if (featureImportances.length === 0) return 1;
    const max = Math.max(...featureImportances.map((f) => Math.abs(f.val)));
    return max > 0 ? max : 1;
  }, [featureImportances]);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* 1. SHAP Summary Section */}
      {shapSummary && (
        <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest block">
                  LAYER 2 • SHAP FEATURE ATTRIBUTION
                </span>
                <Badge variant="primary" size="sm">
                  {explainMethod}
                </Badge>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                Skill Reliance vs. Pedigree Bias Split
              </h2>
            </div>

            {/* Metadata Badges */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
              <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                Candidates Tested: <strong>{shapSummary.n_candidates_tested ?? 'N/A'}</strong>
              </span>
              {shapSummary.n_candidates_total !== undefined && (
                <span className="px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 font-semibold">
                  Total Population: <strong>{shapSummary.n_candidates_total}</strong>
                </span>
              )}
              {!!shapSummary.n_candidates_skipped && (
                <span className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-semibold">
                  Skipped: <strong>{shapSummary.n_candidates_skipped}</strong>
                </span>
              )}
              {!!shapSummary.n_model_scoring_errors && (
                <span className="px-3 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-semibold">
                  Scoring Errors: <strong>{shapSummary.n_model_scoring_errors}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Skill vs Pedigree Visual Bar & Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Split Cards */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  label="Skill Reliance"
                  value={`${skillPct}%`}
                  subtext="Merit-based feature weight"
                  variant="success"
                  icon={<Brain className="w-5 h-5 text-emerald-600" />}
                />

                <StatCard
                  label="Pedigree Reliance"
                  value={`${pedigreePct}%`}
                  subtext={pedigreePct >= 40 ? 'High bias concentration' : pedigreePct >= 20 ? 'Moderate bias leak' : 'Low pedigree leak'}
                  variant={pedigreePct >= 40 ? 'danger' : pedigreePct >= 20 ? 'warning' : 'info'}
                  icon={<Scale className="w-5 h-5" />}
                />
              </div>

              {/* Stacked Percentage Bar */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono-tabular font-bold">
                  <span className="text-emerald-700">Skill Drivers ({skillPct}%)</span>
                  <span className="text-rose-700">Pedigree/Proxy Drivers ({pedigreePct}%)</span>
                </div>

                <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${Math.max(2, skillPct)}%` }}
                    title={`Skill reliance: ${skillPct}%`}
                  />
                  <div
                    className="h-full bg-rose-600 transition-all duration-500"
                    style={{ width: `${Math.max(2, pedigreePct)}%` }}
                    title={`Pedigree reliance: ${pedigreePct}%`}
                  />
                </div>
              </div>
            </div>

            {/* Feature Importance Rankings */}
            <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
                <span className="text-xs font-mono-tabular font-bold text-slate-700 uppercase tracking-wider">
                  Ranked Feature Importances (Mean |SHAP|)
                </span>
                <span className="text-[11px] text-slate-400 font-mono-tabular">Top Model Features</span>
              </div>

              {featureImportances.length > 0 ? (
                <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1">
                  {featureImportances.map((f) => {
                    const isPedigree =
                      (shapSummary?.pedigree_fields && Array.isArray(shapSummary.pedigree_fields))
                        ? shapSummary.pedigree_fields.includes(f.name)
                        : ['college_tier', 'college_name', 'is_metro', 'university_tier', 'zip_code'].some(
                            (p) => f.name.toLowerCase().includes(p)
                          );
                    const barWidthPct = maxImportanceVal > 0 ? (Math.abs(f.val) / maxImportanceVal) * 100 : 0;
                    const visibleWidth = Math.min(100, Math.max(Math.abs(f.val) > 0 ? 3 : 1.5, barWidthPct));

                    return (
                      <div key={f.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-mono-tabular">
                          <span className="font-bold text-slate-800">{f.name}</span>
                          <span className="text-slate-700 font-semibold">{f.val.toFixed(4)}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200/90 rounded-full overflow-hidden border border-slate-200/60">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isPedigree ? 'bg-amber-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${visibleWidth}%` }}
                            title={`${f.name}: ${f.val.toFixed(4)}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-4">No feature importances declared or computed.</p>
              )}
            </div>
          </div>

          {/* Metadata Note */}
          {shapSummary.note && (
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900 font-mono-tabular flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{shapSummary.note}</p>
            </div>
          )}
        </Card>
      )}

      {/* 2. Perturbation Results Section (Layer 3) */}
      <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest block">
              LAYER 3 • COUNTERFACTUAL PERTURBATION TESTS
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 mt-1">
              Field-by-Field Sensitivity & Wilcoxon Significance
            </h2>
          </div>

          <Badge variant="neutral" size="sm">
            {perturbationResults ? `${perturbationResults.length} Fields Tested` : '0 Fields'}
          </Badge>
        </div>

        {perturbationResults && perturbationResults.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
            {perturbationResults.map((res) => {
              const isSig = res.statistically_significant;
              const deltaVal = res.avg_delta_pts ?? 0;
              const deltaFormatted = deltaVal > 0 ? `+${deltaVal.toFixed(1)} pts` : `${deltaVal.toFixed(1)} pts`;

              return (
                <Card
                  key={res.field_tested}
                  variant="default"
                  className="p-5 bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono-tabular font-bold text-slate-900 truncate" title={res.field_tested}>
                        {res.field_tested}
                      </span>
                      {res.severity && (
                        <Badge
                          variant={
                            res.severity.toUpperCase() === 'HIGH'
                              ? 'danger'
                              : res.severity.toUpperCase() === 'MED' || res.severity.toUpperCase() === 'MEDIUM'
                              ? 'warning'
                              : 'done'
                          }
                          size="sm"
                        >
                          {res.severity.toUpperCase()}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-mono-tabular font-medium text-slate-500 block">Average Delta</span>
                      <div className="text-2xl sm:text-3xl font-extrabold font-mono-tabular tracking-tight">
                        <span
                          className={
                            isSig
                              ? 'text-rose-600'
                              : deltaVal > 0
                              ? 'text-blue-600'
                              : deltaVal < 0
                              ? 'text-amber-600'
                              : 'text-slate-800'
                          }
                        >
                          {deltaFormatted}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    {isSig ? (
                      <Badge variant="danger" size="md" icon={<AlertTriangle className="w-3.5 h-3.5" />}>
                        Significant
                      </Badge>
                    ) : (
                      <Badge variant="done" size="md" icon={<CheckCircle className="w-3.5 h-3.5" />}>
                        Insignificant
                      </Badge>
                    )}

                    {res.p_value !== undefined && (
                      <span className="text-[11px] font-mono-tabular text-slate-500 font-semibold">
                        p = {res.p_value < 0.001 ? '< 0.001' : res.p_value.toFixed(3)}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic py-4">No field perturbation tests recorded.</p>
        )}
      </Card>

      {/* 3. Candidate Scores & Decisions Table */}
      {scores && scores.length > 0 && (
        <Card className="p-6 md:p-8 bg-white border border-slate-200/90 shadow-md space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <span className="text-[11px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest block">
                CANDIDATE SCORES & SELECTION OUTCOMES
              </span>
              <h2 className="text-xl font-extrabold text-slate-900 mt-1">
                Scored Candidates & Decision Roster
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant="neutral" size="sm">
                Showing {displayedScores.length} of {scores.length}
              </Badge>
              {scores.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllScores(!showAllScores)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  {showAllScores ? 'Collapse' : 'Show All'}
                  {showAllScores ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableSortHeader
                  sortKey="candidate_id"
                  currentSortKey={scoreSortCol}
                  sortDirection={scoreSortDir}
                  onSort={handleScoreSort}
                >
                  Candidate ID
                </TableSortHeader>
                <TableSortHeader
                  sortKey="screening_score"
                  currentSortKey={scoreSortCol}
                  sortDirection={scoreSortDir}
                  onSort={handleScoreSort}
                  className="text-right"
                >
                  Screening Score
                </TableSortHeader>
                <TableSortHeader
                  sortKey="college_tier"
                  currentSortKey={scoreSortCol}
                  sortDirection={scoreSortDir}
                  onSort={handleScoreSort}
                >
                  College Tier
                </TableSortHeader>
                <TableSortHeader
                  sortKey="is_metro"
                  currentSortKey={scoreSortCol}
                  sortDirection={scoreSortDir}
                  onSort={handleScoreSort}
                >
                  Location
                </TableSortHeader>
                <TableSortHeader
                  sortKey="experience_years"
                  currentSortKey={scoreSortCol}
                  sortDirection={scoreSortDir}
                  onSort={handleScoreSort}
                >
                  Experience
                </TableSortHeader>
                <TableSortHeader
                  sortKey="score"
                  currentSortKey={scoreSortCol}
                  sortDirection={scoreSortDir}
                  onSort={handleScoreSort}
                  className="text-right"
                >
                  Model Score
                </TableSortHeader>
                <TableSortHeader
                  sortKey="decision"
                  currentSortKey={scoreSortCol}
                  sortDirection={scoreSortDir}
                  onSort={handleScoreSort}
                >
                  Decision
                </TableSortHeader>
                <TableHead>Field Status / Missing</TableHead>
                <TableHead className="text-right">What-If Test</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedScores.map((c) => {
                const hasScore = c.score !== null && c.score !== undefined;
                const decisionStr = c.decision ? String(c.decision) : 'N/A';
                const isShortlisted =
                  ['shortlisted', 'selected', 'hired', '1', 'true', 'yes'].includes(decisionStr.toLowerCase());

                // Extract feature values directly from c.input_features
                const inputFeats = c.input_features || {};

                const rawScreening = inputFeats.screening_score;
                const screeningScore =
                  rawScreening !== null && rawScreening !== undefined && rawScreening !== ''
                    ? Number(rawScreening)
                    : null;
                const validScreening = screeningScore !== null && !isNaN(screeningScore);

                const rawTier = inputFeats.college_tier;
                const collegeTierStr =
                  rawTier !== null && rawTier !== undefined && rawTier !== ''
                    ? String(rawTier).trim()
                    : null;
                const formattedTier = collegeTierStr
                  ? collegeTierStr.startsWith('Tier')
                    ? collegeTierStr
                    : `Tier ${collegeTierStr}`
                  : null;

                const rawMetro = inputFeats.is_metro;
                let locationStr: string | null = null;
                if (rawMetro !== null && rawMetro !== undefined && rawMetro !== '') {
                  const metroLower = String(rawMetro).toLowerCase().trim();
                  if (rawMetro === 1 || rawMetro === '1' || rawMetro === true || metroLower === 'true' || metroLower === 'metro') {
                    locationStr = 'Metro';
                  } else if (rawMetro === 0 || rawMetro === '0' || rawMetro === false || metroLower === 'false' || metroLower === 'non-metro') {
                    locationStr = 'Non-Metro';
                  } else {
                    locationStr = String(rawMetro);
                  }
                }

                const rawExpYears = inputFeats.experience_years;
                const rawGapMonths = inputFeats.career_gap_months;

                const expNum =
                  rawExpYears !== null && rawExpYears !== undefined && rawExpYears !== ''
                    ? Number(rawExpYears)
                    : null;
                const gapNum =
                  rawGapMonths !== null && rawGapMonths !== undefined && rawGapMonths !== ''
                    ? Number(rawGapMonths)
                    : null;

                const validExp = expNum !== null && !isNaN(expNum);
                const validGap = gapNum !== null && !isNaN(gapNum);

                let experienceText: string | null = null;
                if (validExp && validGap) {
                  experienceText = `${expNum} yrs (${gapNum}m gap)`;
                } else if (validExp) {
                  experienceText = `${expNum} yrs`;
                } else if (validGap) {
                  experienceText = `${gapNum}m gap`;
                }

                return (
                  <TableRow key={c.candidate_id}>
                    <TableCell className="font-mono-tabular font-bold text-slate-900 text-xs whitespace-nowrap">
                      {c.candidate_id}
                    </TableCell>

                    {/* Screening Score (raw input score) */}
                    <TableCell className="text-right whitespace-nowrap font-mono-tabular">
                      {validScreening ? (
                        <span className="font-semibold text-slate-800 text-xs">
                          {screeningScore.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal text-xs">—</span>
                      )}
                    </TableCell>

                    {/* College Tier */}
                    <TableCell className="whitespace-nowrap">
                      {formattedTier ? (
                        <Badge variant="neutral" size="sm">
                          {formattedTier}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 font-normal text-xs font-mono-tabular">—</span>
                      )}
                    </TableCell>

                    {/* Location (is_metro) */}
                    <TableCell className="whitespace-nowrap font-mono-tabular text-xs text-slate-700">
                      {locationStr ? (
                        <span>{locationStr}</span>
                      ) : (
                        <span className="text-slate-400 font-normal text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Experience */}
                    <TableCell className="whitespace-nowrap font-mono-tabular text-xs text-slate-700">
                      {experienceText ? (
                        <span>{experienceText}</span>
                      ) : (
                        <span className="text-slate-400 font-normal text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Model Score */}
                    <TableCell className="text-right whitespace-nowrap">
                      {hasScore ? (
                        <span className="font-mono-tabular font-extrabold text-sm text-slate-900">
                          {c.score?.toFixed(1)}
                        </span>
                      ) : (
                        <Badge variant="danger" size="sm">
                          Not scored
                        </Badge>
                      )}
                    </TableCell>

                    {/* Decision */}
                    <TableCell className="whitespace-nowrap">
                      {isShortlisted ? (
                        <Badge variant="success" size="sm">
                          {decisionStr}
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">
                          {decisionStr}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Field Status / Missing */}
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap font-mono-tabular">
                      {c.missing_fields && c.missing_fields.length > 0 ? (
                        <span className="text-rose-600 font-semibold">
                          Missing: {c.missing_fields.join(', ')}
                        </span>
                      ) : c.error ? (
                        <span className="text-rose-600 font-semibold">{c.error}</span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Complete</span>
                      )}
                    </TableCell>

                    {/* What-If Test Action */}
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCandidate(c);
                          setIsPerturbModalOpen(true);
                        }}
                        leftIcon={<Sliders className="w-3 h-3 text-blue-600" />}
                        className="bg-white hover:bg-blue-50 border-slate-200 text-xs py-1"
                      >
                        Perturb
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Candidate Perturbation Modal */}
      <CandidatePerturbationModal
        isOpen={isPerturbModalOpen}
        onClose={() => setIsPerturbModalOpen(false)}
        jobId={jobId}
        candidate={selectedCandidate}
      />
    </div>
  );
};
