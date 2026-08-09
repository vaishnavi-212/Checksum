import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { EmptyState } from '../ui/EmptyState';
import { CheckCircle2, AlertCircle, HelpCircle, FileCheck } from 'lucide-react';

export interface AvailabilityReportCardProps {
  report?: Record<string, any> | null;
  className?: string;
}

export const AvailabilityReportCard: React.FC<AvailabilityReportCardProps> = ({
  report,
  className = '',
}) => {
  if (!report || typeof report !== 'object' || Object.keys(report).length === 0) {
    return (
      <Card className={`p-6 bg-white border border-slate-200/90 shadow-md ${className}`}>
        <EmptyState
          icon={<FileCheck className="w-8 h-8 text-slate-400" />}
          title="No Dataset Field Coverage Data"
          description="Field coverage assessment was not returned for this audit job."
        />
      </Card>
    );
  }

  // 1. Extract total records count if present
  const totalRecords =
    typeof report.total_records === 'number' ? report.total_records : 0;

  // 2. Extract fields map from report.fields or filter out metadata keys
  let rawFieldsMap: Record<string, any> = {};
  if (report.fields && typeof report.fields === 'object' && !Array.isArray(report.fields)) {
    rawFieldsMap = report.fields;
  } else {
    const metadataKeys = new Set([
      'total_records',
      'model_access_available',
      'audit_mode',
      'fields',
    ]);
    Object.entries(report).forEach(([k, v]) => {
      if (!metadataKeys.has(k) && typeof v === 'object' && v !== null) {
        rawFieldsMap[k] = v;
      }
    });
  }

  const fieldsEntries = Object.entries(rawFieldsMap);

  if (fieldsEntries.length === 0) {
    return (
      <Card className={`p-6 bg-white border border-slate-200/90 shadow-md ${className}`}>
        <EmptyState
          icon={<FileCheck className="w-8 h-8 text-slate-400" />}
          title="No Field Coverage Available"
          description="Dataset feature availability details could not be parsed."
        />
      </Card>
    );
  }

  // Compute summary stats
  let presentCount = 0;
  let inferredCount = 0;
  let missingCount = 0;

  fieldsEntries.forEach(([, rawInfo]) => {
    const info = (rawInfo || {}) as Record<string, any>;

    let presentNum = 0;
    let inferredNum = 0;
    let missingNum = 0;

    if (
      typeof info.present === 'number' ||
      typeof info.missing === 'number' ||
      typeof info.inferred === 'number'
    ) {
      presentNum = typeof info.present === 'number' ? info.present : 0;
      inferredNum = typeof info.inferred === 'number' ? info.inferred : 0;
      missingNum = typeof info.missing === 'number' ? info.missing : 0;
    } else if (typeof info.present === 'boolean') {
      if (info.present) presentNum = totalRecords > 0 ? totalRecords : 1;
      else if (info.inferred) inferredNum = totalRecords > 0 ? totalRecords : 1;
      else missingNum = totalRecords > 0 ? totalRecords : 1;
    } else {
      if (info.status === 'present' || info.coverage_pct === 100)
        presentNum = totalRecords > 0 ? totalRecords : 1;
      else if (info.status === 'inferred')
        inferredNum = totalRecords > 0 ? totalRecords : 1;
      else missingNum = totalRecords > 0 ? totalRecords : 1;
    }

    const sumNum = presentNum + inferredNum + missingNum;
    const effectiveTotal = totalRecords > 0 ? totalRecords : sumNum > 0 ? sumNum : 1;

    if (missingNum === effectiveTotal || (presentNum === 0 && inferredNum === 0)) {
      missingCount++;
    } else if (inferredNum > 0 && presentNum === 0) {
      inferredCount++;
    } else {
      presentCount++;
    }
  });

  return (
    <Card className={`p-6 bg-white border border-slate-200/90 shadow-md space-y-5 ${className}`}>
      {/* Header & Stat Summary Pills */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
            <FileCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Dataset Field Coverage & Feature Availability
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluation of candidate feature completeness across {totalRecords > 0 ? `${totalRecords} ingested candidate records` : 'the dataset'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-mono-tabular font-semibold text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {presentCount} Present
          </span>
          {inferredCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-mono-tabular font-semibold text-amber-800">
              <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
              {inferredCount} Inferred
            </span>
          )}
          {missingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 border border-rose-200 text-[11px] font-mono-tabular font-semibold text-rose-800">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              {missingCount} Missing
            </span>
          )}
          <Badge variant="neutral" size="sm">
            {fieldsEntries.length} Total Fields Evaluated
          </Badge>
        </div>
      </div>

      {/* Structured Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/60">
              <TableHead className="w-[220px]">Field / Feature Name</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[180px]">Coverage</TableHead>
              <TableHead>Audit Impact & Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fieldsEntries.map(([fieldName, rawInfo]) => {
              const info = (rawInfo || {}) as Record<string, any>;

              let presentNum = 0;
              let inferredNum = 0;
              let missingNum = 0;

              if (
                typeof info.present === 'number' ||
                typeof info.missing === 'number' ||
                typeof info.inferred === 'number'
              ) {
                presentNum = typeof info.present === 'number' ? info.present : 0;
                inferredNum = typeof info.inferred === 'number' ? info.inferred : 0;
                missingNum = typeof info.missing === 'number' ? info.missing : 0;
              } else if (typeof info.present === 'boolean') {
                if (info.present) presentNum = totalRecords > 0 ? totalRecords : 1;
                else if (info.inferred) inferredNum = totalRecords > 0 ? totalRecords : 1;
                else missingNum = totalRecords > 0 ? totalRecords : 1;
              } else {
                if (info.status === 'present' || info.coverage_pct === 100)
                  presentNum = totalRecords > 0 ? totalRecords : 1;
                else if (info.status === 'inferred')
                  inferredNum = totalRecords > 0 ? totalRecords : 1;
                else missingNum = totalRecords > 0 ? totalRecords : 1;
              }

              const fieldSum = presentNum + inferredNum + missingNum;
              const effectiveTotal = totalRecords > 0 ? totalRecords : fieldSum > 0 ? fieldSum : 1;

              let coverageNum = 0;
              if (info.coverage_pct !== undefined && typeof info.coverage_pct === 'number') {
                coverageNum = info.coverage_pct;
              } else {
                coverageNum = Math.round(((presentNum + inferredNum) / effectiveTotal) * 1000) / 10;
              }

              const isFullyPresent = presentNum === effectiveTotal && missingNum === 0 && inferredNum === 0;
              const isFullyMissing = missingNum === effectiveTotal || (presentNum === 0 && inferredNum === 0);
              const isInferred = inferredNum > 0 && presentNum === 0;
              const isPartial = !isFullyPresent && !isFullyMissing && !isInferred;

              let statusBadge = <Badge variant="success">Present</Badge>;
              let statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;

              if (isFullyMissing) {
                statusBadge = <Badge variant="danger">Missing</Badge>;
                statusIcon = <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
              } else if (isInferred) {
                statusBadge = <Badge variant="warning">Inferred</Badge>;
                statusIcon = <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
              } else if (isPartial) {
                statusBadge = <Badge variant="primary">{`${presentNum}/${effectiveTotal} Present`}</Badge>;
                statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
              }

              const coverageStr = `${coverageNum.toFixed(1)}%`;

              return (
                <TableRow key={fieldName} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="font-mono-tabular font-bold text-slate-900 text-xs py-3">
                    <div className="flex items-center gap-2">
                      {statusIcon}
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 border border-slate-200/60 font-mono">
                        {fieldName}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell className="py-3">{statusBadge}</TableCell>

                  <TableCell className="py-3 font-mono-tabular text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                        <span>{coverageStr}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {presentNum + inferredNum}/{effectiveTotal}
                        </span>
                      </div>
                      <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isFullyMissing ? 'bg-rose-500' : isInferred ? 'bg-amber-500' : isPartial ? 'bg-blue-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(isFullyMissing ? 0 : 4, Math.min(100, coverageNum))}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-slate-600 py-3 leading-relaxed">
                    {info.note ? (
                      info.note
                    ) : isFullyMissing ? (
                      <span className="text-rose-700 font-medium">
                        Field missing across all candidate records (0/{effectiveTotal}). Counterfactual perturbation on this variable is skipped per Section 4/7.
                      </span>
                    ) : isInferred ? (
                      <span className="text-amber-800 font-medium">
                        Inferred via pipeline translation/arithmetic inference layer.
                      </span>
                    ) : isPartial ? (
                      <span className="text-slate-700 font-medium">
                        Present in {presentNum} of {effectiveTotal} records ({coverageStr} coverage). Records missing this field are excluded from direct perturbation.
                      </span>
                    ) : (
                      <span className="text-slate-600">
                        Fully populated across all {effectiveTotal} candidate records ({coverageStr}). Fully available for SHAP attribution and perturbation testing.
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
