import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { AvailabilityReportItem } from '../../services/api';
import { CheckCircle2, AlertTriangle, HelpCircle, FileCheck } from 'lucide-react';

export interface AvailabilityReportCardProps {
  report?: Record<string, AvailabilityReportItem> | null;
  className?: string;
}

export const AvailabilityReportCard: React.FC<AvailabilityReportCardProps> = ({
  report,
  className = '',
}) => {
  if (!report || Object.keys(report).length === 0) {
    return null;
  }

  const fields = Object.entries(report);

  return (
    <Card className={`p-6 bg-white border border-slate-200/90 shadow-md space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
            <FileCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Dataset Field Coverage & Availability
            </h3>
            <p className="text-xs text-slate-500">
              Inspection of declared bias-relevant candidate features across uploaded dataset
            </p>
          </div>
        </div>

        <Badge variant="neutral" size="sm">
          {fields.length} Fields Evaluated
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field / Feature</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Coverage %</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map(([fieldName, rawInfo]) => {
            const info = rawInfo as AvailabilityReportItem;
            const isPresent = info.present ?? (info.status === 'present' || info.coverage_pct === 100);
            const isInferred = info.inferred ?? info.status === 'inferred';
            const isMissing = info.missing ?? (info.status === 'missing' || info.coverage_pct === 0);

            let statusBadge = <Badge variant="success">Present</Badge>;
            if (isMissing) {
              statusBadge = <Badge variant="danger">Missing</Badge>;
            } else if (isInferred) {
              statusBadge = <Badge variant="warning">Inferred</Badge>;
            }

            const coverage =
              info.coverage_pct !== undefined
                ? typeof info.coverage_pct === 'number'
                  ? `${info.coverage_pct.toFixed(1)}%`
                  : String(info.coverage_pct)
                : isPresent
                ? '100.0%'
                : isMissing
                ? '0.0%'
                : 'N/A';

            return (
              <TableRow key={fieldName}>
                <TableCell className="font-mono-tabular font-bold text-slate-900 text-xs">
                  {fieldName}
                </TableCell>
                <TableCell>{statusBadge}</TableCell>
                <TableCell className="font-mono-tabular text-xs font-semibold">
                  {coverage}
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {isMissing
                    ? 'Field missing from CSV. Cannot run direct perturbation on this variable.'
                    : isInferred
                    ? 'Inferred from proxy indicators in candidate profile.'
                    : 'Present in input dataset.'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};
