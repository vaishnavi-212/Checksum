import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'subtle' | 'outline' | 'interactive';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = 'default', className = '', ...props }, ref) => {
    const baseStyles = 'rounded-xl transition-all duration-200 ease-out';
    
    const variantStyles = {
      default: 'bg-white border border-slate-200/90 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.35),0_2px_8px_-2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.9)] relative text-slate-900',
      subtle: 'bg-slate-50/95 border border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.25)] text-slate-900',
      outline: 'bg-white/10 backdrop-blur-md border border-slate-200/40 text-white shadow-lg',
      interactive: 'bg-white border border-slate-200/90 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-blue-400/80 hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.45)] hover:-translate-y-1 transition-all duration-200 cursor-pointer active:translate-y-0 text-slate-900',
    };

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 pb-3 border-b border-slate-100 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-base font-semibold text-slate-900 tracking-tight ${className}`} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-xs text-slate-500 mt-1 leading-relaxed ${className}`} {...props}>
    {children}
  </p>
);

export const CardContent = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 ${className}`} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-4 px-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between rounded-b-xl ${className}`} {...props}>
    {children}
  </div>
);
