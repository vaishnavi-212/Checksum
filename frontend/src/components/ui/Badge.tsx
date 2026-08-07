import React from 'react';
import { TOKENS, StatusType } from '../../tokens/tokens';

export type BadgeVariant = StatusType | 'neutral' | 'primary';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  showDot?: boolean; // Maintained for API compatibility, strictly ignored (text-only design)
  icon?: React.ReactNode; // Maintained for API compatibility, strictly ignored (text-only design)
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  showDot,
  icon,
  className = '',
  ...props
}) => {
  const statusConfig = (
    TOKENS.colors.status as Record<
      string,
      { bg: string; border: string; text: string; glow: string; label: string }
    >
  )[variant];

  const sizeStyles = {
    sm: 'px-2.5 py-0.5 text-[10px] leading-4 tracking-wider',
    md: 'px-3 py-1 text-[11px] leading-4 tracking-widest',
  };

  const baseClasses =
    'inline-flex items-center rounded-md border border-l-[3px] font-mono-tabular font-bold uppercase whitespace-nowrap select-none transition-all duration-200 hover:-translate-y-0.5';

  if (statusConfig) {
    return (
      <span
        className={`${baseClasses} ${statusConfig.bg} ${statusConfig.border} ${statusConfig.text} ${statusConfig.glow} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        <span>{children || statusConfig.label}</span>
      </span>
    );
  }

  // Custom fallback variants (neutral & primary)
  const customVariants = {
    neutral:
      'bg-slate-100/90 border-slate-200/90 border-l-slate-400 text-slate-700 shadow-2xs hover:border-slate-300',
    primary:
      'bg-blue-50/90 border-blue-200/90 border-l-blue-600 text-blue-800 shadow-2xs hover:border-blue-300',
  };

  return (
    <span
      className={`${baseClasses} ${customVariants[variant as 'neutral' | 'primary'] || customVariants.neutral} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      <span>{children}</span>
    </span>
  );
};

