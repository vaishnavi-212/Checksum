/**
 * Checksum Design Tokens System (Light, Bright & Premium Theme)
 * Defined centrally and used across all UI components.
 * Inspired by Stripe, Vercel, Linear, and GitHub light-mode visual design standards.
 */

export const TOKENS = {
  colors: {
    // Canvas & Neutral Scale (Dark Outer Canvas + Elevated White Surface Panels)
    bg: {
      app: 'slate-950',          // #0b0f19 rich dark charcoal canvas
      subtle: 'slate-900',       // #0f172a
      surface: 'white',          // Pure crisp white card background
      elevated: 'white',         // Elevated white surface panel
      border: 'slate-200',       // Hairline border for light surfaces
      borderHover: 'slate-300',  // Interactive hover border
      muted: 'slate-500',        // Subtitle / muted text
      fg: 'slate-900',           // High-contrast primary text inside white cards
      fgBright: 'slate-950',     // Headers / emphatic text inside white cards
    },

    // Single Primary Accent: Crisp Electric Blue / Indigo
    accent: {
      DEFAULT: '#2563eb',        // blue-600
      hover: '#1d4ed8',          // blue-700
      active: '#1e40af',         // blue-800
      subtleBg: 'rgba(37, 99, 235, 0.06)',
      subtleBorder: 'rgba(37, 99, 235, 0.2)',
      text: '#2563eb',
    },

    // Semantic Status Colors for Light Canvas (Text-Only Tactical Status Chips)
    status: {
      done: {
        bg: 'bg-emerald-50/90',
        border: 'border-slate-200/90 border-l-emerald-500',
        text: 'text-emerald-800',
        glow: 'shadow-2xs hover:shadow-emerald-900/10 hover:border-emerald-300',
        label: 'Done',
      },
      passed: {
        bg: 'bg-emerald-50/90',
        border: 'border-slate-200/90 border-l-emerald-500',
        text: 'text-emerald-800',
        glow: 'shadow-2xs hover:shadow-emerald-900/10 hover:border-emerald-300',
        label: 'Passed Audit',
      },
      running: {
        bg: 'bg-amber-50/90',
        border: 'border-amber-200 border-l-amber-500',
        text: 'text-amber-900',
        glow: 'ring-2 ring-amber-400/30 shadow-xs animate-pulse hover:border-amber-400',
        label: 'Running',
      },
      pending: {
        bg: 'bg-blue-50/80',
        border: 'border-slate-200/90 border-l-blue-500',
        text: 'text-blue-800',
        glow: 'shadow-2xs hover:border-blue-300',
        label: 'Pending Stage',
      },
      failed: {
        bg: 'bg-rose-50',
        border: 'border-rose-200 border-l-rose-600',
        text: 'text-rose-900',
        glow: 'shadow-xs shadow-rose-500/15 ring-1 ring-rose-200/80 hover:border-rose-300',
        label: 'Failed Execution',
      },
      excluded: {
        bg: 'bg-slate-100/80',
        border: 'border-slate-200 border-l-slate-400',
        text: 'text-slate-600',
        glow: 'shadow-2xs hover:border-slate-300',
        label: 'Excluded Column',
      },
      high_risk: {
        bg: 'bg-rose-50/95',
        border: 'border-rose-200 border-l-rose-600',
        text: 'text-rose-950',
        glow: 'shadow-sm shadow-rose-500/20 ring-2 ring-rose-500/20 hover:border-rose-300',
        label: 'High Risk',
      },
      medium_risk: {
        bg: 'bg-amber-50/90',
        border: 'border-amber-200 border-l-amber-500',
        text: 'text-amber-800',
        glow: 'shadow-xs shadow-amber-500/10 hover:border-amber-300',
        label: 'Medium Risk',
      },
      low_risk: {
        bg: 'bg-emerald-50/90',
        border: 'border-emerald-200 border-l-emerald-500',
        text: 'text-emerald-800',
        glow: 'shadow-2xs hover:border-emerald-300',
        label: 'Low Risk',
      },
      info: {
        bg: 'bg-sky-50/90',
        border: 'border-sky-200 border-l-sky-500',
        text: 'text-sky-800',
        glow: 'shadow-2xs hover:border-sky-300',
        label: 'Information',
      },
    },
  },

  typography: {
    family: {
      sans: "var(--font-sans)",
      mono: "var(--font-mono)",
    },
    sizes: {
      xs: 'text-xs leading-4',
      sm: 'text-sm leading-5',
      base: 'text-base leading-6',
      lg: 'text-lg leading-7',
      xl: 'text-xl leading-7',
      '2xl': 'text-2xl leading-8',
      '3xl': 'text-3xl leading-9',
      '4xl': 'text-4xl leading-10',
    },
    weights: {
      regular: 'font-normal',
      medium: 'font-medium',
      semibold: 'font-semibold',
      bold: 'font-bold',
    },
  },

  radius: {
    sm: 'rounded-md',    // 6px
    md: 'rounded-lg',    // 8px
    lg: 'rounded-xl',    // 12px
    full: 'rounded-full',
  },

  shadows: {
    subtle: 'shadow-xs shadow-slate-900/5 border border-slate-200/80',
    md: 'shadow-sm shadow-slate-900/5 hover:shadow-md hover:shadow-slate-900/10 transition-all duration-200',
    lg: 'shadow-xl shadow-slate-900/10 border border-slate-200',
    glow: 'shadow-[0_0_20px_rgba(37,99,235,0.12)]',
    canvasCard: 'shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06),0_1px_2px_-1px_rgba(15,23,42,0.04)] border border-slate-200/80',
    headerFloating: 'shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06)] border-b border-slate-200/90',
  },

  motion: {
    duration: 'duration-200',
    ease: 'ease-out',
    transition: 'transition-all duration-200 ease-out',
  },
} as const;

export type StatusType = keyof typeof TOKENS.colors.status;
