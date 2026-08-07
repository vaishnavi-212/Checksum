import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ children, className = '', ...props }) => (
  <div className="w-full overflow-x-auto rounded-xl border border-slate-200/90 bg-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]">
    <table className={`w-full text-left border-collapse ${className}`} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <thead className={`bg-slate-50/90 border-b border-slate-200/90 text-[10px] font-mono-tabular font-bold text-slate-500 uppercase tracking-widest ${className}`} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <tbody className={`divide-y divide-slate-100/90 text-xs ${className}`} {...props}>
    {children}
  </tbody>
);

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isInteractive?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  isInteractive = false,
  className = '',
  ...props
}) => (
  <tr
    className={`transition-colors duration-150 ease-in-out ${
      isInteractive ? 'hover:bg-slate-50/90 cursor-pointer active:bg-slate-100/70' : 'hover:bg-slate-50/50'
    } ${className}`}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <th className={`px-5 py-3 font-bold text-slate-500 select-none ${className}`} {...props}>
    {children}
  </th>
);

export interface TableSortHeaderProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  currentSortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

export const TableSortHeader: React.FC<TableSortHeaderProps> = ({
  children,
  sortKey,
  currentSortKey,
  sortDirection,
  onSort,
  className = '',
  ...props
}) => {
  const isActive = currentSortKey === sortKey;

  return (
    <th
      className={`px-5 py-3 font-bold text-slate-500 cursor-pointer hover:text-slate-900 select-none group transition-colors ${className}`}
      onClick={() => onSort?.(sortKey)}
      {...props}
    >
      <div className="inline-flex items-center gap-1.5">
        <span>{children}</span>
        {isActive ? (
          sortDirection === 'asc' ? (
            <ChevronUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          )
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        )}
      </div>
    </th>
  );
};

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <td className={`px-5 py-3.5 text-slate-800 align-middle ${className}`} {...props}>
    {children}
  </td>
);

