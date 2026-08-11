import React, { useRef, useState, useEffect } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'motion/react';
import {
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Cpu,
  FileSpreadsheet,
  Globe,
  BarChart3,
  Scale,
  Sliders,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  MapPin,
  CalendarX,
  Check,
  FileCheck2,
  Info,
  UserCheck,
  UserX,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardContent } from '../ui/Card';

export interface LandingPageProps {
  onGetStarted: () => void;
  onHowItWorks?: () => void;
}

/**
 * HeroIsometricIllustration:
 * Interactive 3D Parallax & Layered SVG/Card Isometric Illustration.
 * Inspired directly by the multi-panel isometric reference illustration composition:
 * - Blue & white brand palette with layered 3D isometric platforms
 * - Precision-aligned analytics screens, bar chart attribution, candidate evaluation card,
 *   what-if perturbation panel, detailed isometric human figures, and potted plant accents
 * - Floating animation loops and mouse-tracked 3D tilt perspective.
 */
const HeroIsometricIllustration: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Motion values for normalized mouse positions (-0.5 to 0.5)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Smooth springs for 3D tilt rotation
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [12, -12]), {
    stiffness: 140,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-16, 16]), {
    stiffness: 140,
    damping: 18,
  });

  // Layer parallax translate offsets for multi-layer depth
  const layer1X = useSpring(useTransform(mouseX, [-0.5, 0.5], [-10, 10]), { stiffness: 140, damping: 20 });
  const layer1Y = useSpring(useTransform(mouseY, [-0.5, 0.5], [-10, 10]), { stiffness: 140, damping: 20 });

  const layer2X = useSpring(useTransform(mouseX, [-0.5, 0.5], [-20, 20]), { stiffness: 140, damping: 18 });
  const layer2Y = useSpring(useTransform(mouseY, [-0.5, 0.5], [-20, 20]), { stiffness: 140, damping: 18 });

  const layer3X = useSpring(useTransform(mouseX, [-0.5, 0.5], [-32, 32]), { stiffness: 140, damping: 16 });
  const layer3Y = useSpring(useTransform(mouseY, [-0.5, 0.5], [-32, 32]), { stiffness: 140, damping: 16 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full min-h-[420px] sm:min-h-[460px] lg:min-h-[500px] flex items-center justify-center p-2 select-none"
      style={{ perspective: 1200 }}
    >
      {/* Background Ambient Soft Blue Glow */}
      <div className="absolute inset-0 bg-blue-500/15 rounded-full blur-3xl pointer-events-none transform scale-95" />

      {/* 3D Tilt Wrapper */}
      <motion.div
        style={{
          rotateX: shouldReduceMotion ? 0 : rotateX,
          rotateY: shouldReduceMotion ? 0 : rotateY,
          transformStyle: 'preserve-3d',
        }}
        className="relative w-full h-full max-w-xl min-h-[420px] sm:min-h-[460px] flex items-center justify-center transition-transform duration-100 ease-out"
      >
        {/* BASE SVG LAYER: Multi-Platform Isometric Base Slabs & Detailed Human Figures & Plant */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <svg
            className="w-full h-full drop-shadow-2xl"
            viewBox="0 0 560 480"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="iso-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#1e40af" />
              </linearGradient>
              <linearGradient id="iso-light-blue" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f0f9ff" />
                <stop offset="100%" stopColor="#e0f2fe" />
              </linearGradient>
              <linearGradient id="iso-accent-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
              <linearGradient id="human-shirt-1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="human-shirt-2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0369a1" />
              </linearGradient>
            </defs>

            {/* Back-Left Platform Slab */}
            <path
              d="M 50 230 L 210 140 L 330 210 L 170 300 Z"
              fill="url(#iso-blue-grad)"
              fillOpacity="0.9"
              stroke="#60a5fa"
              strokeWidth="1.5"
            />
            {/* Front-Center Tablet Mat Slab */}
            <path
              d="M 130 340 L 330 230 L 480 310 L 280 420 Z"
              fill="url(#iso-light-blue)"
              stroke="#3b82f6"
              strokeWidth="2"
            />
            {/* Right Side Platform Slab */}
            <path
              d="M 350 270 L 510 180 L 540 200 L 380 290 Z"
              fill="#2563eb"
              fillOpacity="0.95"
            />

            {/* Potted Plant Accent (Right Side) */}
            <g transform="translate(440, 140)">
              {/* Pot */}
              <ellipse cx="20" cy="40" rx="16" ry="8" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
              <path d="M 4 20 L 36 20 L 32 40 L 8 40 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <ellipse cx="20" cy="20" rx="16" ry="6" fill="#cbd5e1" />
              {/* Green Leaves */}
              <path d="M 20 20 C 8 8, -4 10, 0 -8 C 14 2, 20 14, 20 20 Z" fill="#34d399" />
              <path d="M 20 20 C 26 4, 42 -2, 34 -14 C 28 0, 22 14, 20 20 Z" fill="#10b981" />
              <path d="M 20 20 C 16 8, 10 -6, 20 -20 C 24 -2, 22 12, 20 20 Z" fill="#059669" />
            </g>

            {/* Small Potted Plant Accent (Left Base) */}
            <g transform="translate(65, 270)">
              <ellipse cx="14" cy="28" rx="10" ry="5" fill="#f1f5f9" />
              <path d="M 4 14 L 24 14 L 21 28 L 7 28 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              <path d="M 14 14 C 6 4, 0 6, 2 -6 C 10 0, 14 10, 14 14 Z" fill="#34d399" />
              <path d="M 14 14 C 18 2, 28 -2, 22 -10 C 18 -2, 15 10, 14 14 Z" fill="#059669" />
            </g>

            {/* DETAILED ISOMETRIC HUMAN FIGURE 1: Standing Model Auditor */}
            <g transform="translate(135, 100)">
              {/* Shadow */}
              <ellipse cx="12" cy="54" rx="10" ry="4" fill="#0f172a" fillOpacity="0.25" />
              {/* Hair / Head */}
              <path d="M 7 6 C 7 1, 17 1, 17 6 C 17 12, 7 12, 7 6 Z" fill="#1e293b" />
              <circle cx="12" cy="8" r="4" fill="#f8fafc" />
              {/* Torso / Jacket */}
              <path d="M 5 14 L 19 14 L 17 32 L 7 32 Z" fill="url(#human-shirt-1)" />
              {/* Collar detail */}
              <path d="M 10 14 L 12 20 L 14 14" stroke="#ffffff" strokeWidth="1" />
              {/* Trousers */}
              <path d="M 7 32 L 10 52 L 12 52 L 11 32 Z" fill="#0f172a" />
              <path d="M 13 32 L 14 52 L 16 52 L 17 32 Z" fill="#1e293b" />
              {/* Shoes */}
              <ellipse cx="11" cy="53" rx="2.5" ry="1.5" fill="#020617" />
              <ellipse cx="15" cy="53" rx="2.5" ry="1.5" fill="#020617" />
            </g>

            {/* DETAILED ISOMETRIC HUMAN FIGURE 2: Standing Auditor Holding Clipboard */}
            <g transform="translate(265, 225)">
              <ellipse cx="12" cy="50" rx="9" ry="3.5" fill="#0f172a" fillOpacity="0.2" />
              {/* Head */}
              <circle cx="12" cy="7" r="4.5" fill="#334155" />
              <path d="M 8 5 C 8 2, 16 2, 16 5 C 16 8, 8 8, 8 5 Z" fill="#0f172a" />
              {/* Torso */}
              <path d="M 6 13 L 18 13 L 16 30 L 8 30 Z" fill="url(#human-shirt-2)" />
              {/* Legs */}
              <path d="M 8 30 L 9 48 L 11 48 L 12 30 Z" fill="#1e293b" />
              <path d="M 12 30 L 13 48 L 15 48 L 16 30 Z" fill="#334155" />
              {/* Clipboard with Audit Checkmark */}
              <rect x="17" y="16" width="11" height="14" rx="1.5" fill="#ffffff" stroke="#2563eb" strokeWidth="1" />
              <path d="M 19 21 L 22 24 L 26 19" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* DETAILED ISOMETRIC HUMAN FIGURE 3: Seated Data Scientist with Laptop */}
            <g transform="translate(370, 295)">
              <ellipse cx="12" cy="38" rx="12" ry="4" fill="#0f172a" fillOpacity="0.2" />
              {/* Head */}
              <circle cx="12" cy="7" r="4.5" fill="#475569" />
              <path d="M 8 4 C 8 1, 16 1, 16 4 Z" fill="#0f172a" />
              {/* Shirt */}
              <path d="M 6 13 L 18 13 L 16 26 L 8 26 Z" fill="#2563eb" />
              {/* Seated Legs */}
              <path d="M 8 26 L 2 34 L -6 34" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M 16 26 L 22 34 L 28 34" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
              {/* Laptop Screen & Keyboard */}
              <path d="M 4 20 L 16 20 L 18 27 L 2 27 Z" fill="#ffffff" stroke="#3b82f6" strokeWidth="1.2" />
              <path d="M 6 22 L 14 22 M 5 24 L 15 24" stroke="#93c5fd" strokeWidth="1" />
            </g>
          </svg>
        </div>

        {/* LAYER 1 (Back-Left Panel): Model Attribution Analytics Screen */}
        <motion.div
          style={{
            x: shouldReduceMotion ? 0 : layer1X,
            y: shouldReduceMotion ? 0 : layer1Y,
            translateZ: -30,
          }}
          animate={shouldReduceMotion ? {} : { y: [0, -8, 0] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute left-2 top-2 w-[56%] sm:w-[52%] p-[1px] rounded-2xl bg-gradient-to-b from-blue-400/60 via-blue-200/50 to-indigo-300/60 shadow-2xl backdrop-blur-md transform -rotate-3 scale-95 z-0"
        >
          <div className="bg-white/95 rounded-[15px] p-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[10px] font-mono-tabular">
              <span className="flex items-center gap-1.5 font-bold text-slate-800">
                <BarChart3 className="w-3.5 h-3.5 text-blue-600" /> MODEL ATTRIBUTION
              </span>
              <span className="text-blue-700 font-bold bg-blue-50/90 px-2 py-0.5 rounded-full border border-blue-200 text-[9px] shadow-2xs">
                88.4% FAIR
              </span>
            </div>

            {/* SVG Bar Chart Panel */}
            <div className="mt-2.5 flex items-end justify-between gap-1.5 h-16 px-1">
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gradient-to-t from-blue-700 to-blue-500 rounded-t h-12 shadow-xs" />
                <span className="text-[8px] font-mono-tabular text-slate-600 font-bold">Exp</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gradient-to-t from-blue-500 to-blue-300 rounded-t h-10 shadow-xs" />
                <span className="text-[8px] font-mono-tabular text-slate-600 font-bold">Skills</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gradient-to-t from-amber-500 to-amber-300 rounded-t h-6 shadow-xs" />
                <span className="text-[8px] font-mono-tabular text-slate-600 font-bold">Gap</span>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t h-8 shadow-xs" />
                <span className="text-[8px] font-mono-tabular text-slate-600 font-bold">Tier</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* LAYER 2 (Center Main Panel): Candidate Evaluation Card */}
        <motion.div
          style={{
            x: shouldReduceMotion ? 0 : layer2X,
            y: shouldReduceMotion ? 0 : layer2Y,
            translateZ: 25,
          }}
          animate={shouldReduceMotion ? {} : { y: [0, -12, 0] }}
          transition={{ duration: 4.4, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          className="absolute right-2 top-10 w-[66%] sm:w-[60%] p-[1px] rounded-2xl bg-gradient-to-b from-blue-500/50 via-slate-200 to-blue-400/40 shadow-2xl z-10 transform rotate-1"
        >
          <div className="bg-white rounded-[15px] p-4 text-slate-900">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-mono-tabular font-bold text-xs text-slate-900 block">
                    CANDIDATE #IND-8942
                  </span>
                  <span className="text-[9px] text-slate-500 block font-medium">Software Engineer • Bangalore</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono-tabular font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                0.78 SCORE
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100/80 shadow-2xs">
                <div className="text-[8px] text-slate-500 uppercase font-mono-tabular font-bold">College</div>
                <div className="text-[10px] font-bold text-slate-900 mt-0.5">Tier-2 State</div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100/80 shadow-2xs">
                <div className="text-[8px] text-slate-500 uppercase font-mono-tabular font-bold">Location</div>
                <div className="text-[10px] font-bold text-slate-900 mt-0.5">Non-Metro</div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-100/80 shadow-2xs">
                <div className="text-[8px] text-slate-500 uppercase font-mono-tabular font-bold">Gap</div>
                <div className="text-[10px] font-bold text-slate-900 mt-0.5">1.5y UPSC</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* LAYER 3 (Foreground Right Panel): Counterfactual Shift & Audit Status Card */}
        <motion.div
          style={{
            x: shouldReduceMotion ? 0 : layer3X,
            y: shouldReduceMotion ? 0 : layer3Y,
            translateZ: 65,
          }}
          animate={shouldReduceMotion ? {} : { y: [0, -16, 0] }}
          transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          className="absolute left-6 bottom-4 w-[78%] p-[1px] rounded-2xl bg-gradient-to-r from-blue-500/80 via-indigo-500/60 to-blue-400/80 shadow-2xl backdrop-blur-md z-20 transform rotate-2"
        >
          <div className="bg-slate-900 rounded-[15px] p-3.5">
            <div className="flex items-center justify-between text-[10px] font-mono-tabular">
              <span className="text-blue-300 font-bold flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" /> WHAT-IF PERTURBATION
              </span>
              <span className="text-emerald-300 font-bold bg-blue-950 px-2 py-0.5 rounded-full border border-blue-700/80 shadow-2xs">
                +24% SHIFT
              </span>
            </div>

            <p className="text-[11px] text-slate-200 mt-1.5 font-medium leading-relaxed">
              Shifting <span className="font-mono-tabular text-blue-300 font-bold">college_tier</span> from Tier-2 to Tier-1 increases selection probability from <span className="text-amber-400 font-bold font-mono-tabular">0.54</span> to <span className="text-emerald-400 font-bold font-mono-tabular">0.78</span>.
            </p>

            <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[9px] text-slate-400 font-mono-tabular">Dual Auditor Validation</span>
              <span className="text-[9px] text-blue-400 font-mono-tabular font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                VERIFIED
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onHowItWorks }) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isCarouselHovered, setIsCarouselHovered] = useState(false);

  // Helper for smooth hardware-accelerated scroll movement
  const smoothScrollTo = (targetX: number) => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollTo({
      left: Math.max(0, targetX),
      behavior: 'smooth',
    });
  };

  // Helper to calculate exact scroll step (card width + gap) dynamically
  const getScrollStep = () => {
    if (!carouselRef.current) return 320;
    const firstCard = carouselRef.current.firstElementChild as HTMLElement | null;
    if (firstCard) {
      const gap = window.innerWidth < 640 ? 16 : 24;
      return firstCard.offsetWidth + gap;
    }
    return window.innerWidth < 640 ? 296 : 364;
  };

  // Automatic moving carousel effect
  useEffect(() => {
    if (isCarouselHovered) return;

    const interval = setInterval(() => {
      if (carouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
        const step = getScrollStep();
        if (scrollLeft + clientWidth >= scrollWidth - 30) {
          smoothScrollTo(0);
        } else {
          smoothScrollTo(scrollLeft + step);
        }
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isCarouselHovered]);

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const step = getScrollStep();
      const currentScroll = carouselRef.current.scrollLeft;
      const target = direction === 'left' ? currentScroll - step : currentScroll + step;
      smoothScrollTo(target);
    }
  };

  const features = [
    {
      id: 'path1',
      badge: 'PATH 1 AUDIT',
      badgeVariant: 'primary' as const,
      icon: <Cpu className="w-5 h-5 text-blue-600" />,
      title: 'Checksum Hiring Agent',
      subtitle: 'Native XGBoost Scoring Engine',
      description:
        'Audit candidate resumes against Checksum’s native vectorized XGBoost model with full SHAP feature attribution and global model explanations.',
      techPoints: ['Native vectorized inference', 'Global SHAP summary plot', 'Subgroup parity metrics'],
    },
    {
      id: 'path2a',
      badge: 'PATH 2A AUDIT',
      badgeVariant: 'neutral' as const,
      icon: <Globe className="w-5 h-5 text-blue-600" />,
      title: 'External Model Endpoint',
      subtitle: 'Dynamic REST API Integration',
      description:
        'Connect any external scoring endpoint via REST URL, send real-time candidate payloads, and run counterfactual perturbation scoring across protected attributes.',
      techPoints: ['Live REST endpoint querying', 'Dynamic payload mapping', 'Counterfactual delta analysis'],
    },
    {
      id: 'path2b',
      badge: 'PATH 2B AUDIT',
      badgeVariant: 'passed' as const,
      icon: <FileSpreadsheet className="w-5 h-5 text-emerald-600" />,
      title: 'Decisions-Only Dataset',
      subtitle: 'EEOC 4/5ths Rule & Statistical Audit',
      description:
        'Audit pre-computed hiring decisions and historical score spreadsheets without requiring direct model code or API endpoint access.',
      techPoints: ['EEOC 80% adverse impact test', 'Disparate impact ratio', 'Statistical significance testing'],
    },
    {
      id: 'shap',
      badge: 'INTERPRETABILITY',
      badgeVariant: 'neutral' as const,
      icon: <BarChart3 className="w-5 h-5 text-blue-600" />,
      title: 'SHAP Feature Attribution',
      subtitle: 'Explainable AI Feature Importance',
      description:
        'Uncover the exact magnitude and direction (|SHAP| values) that each resume feature contributes to candidate screening scores.',
      techPoints: ['Ranked feature importance', 'Directional impact (+/-)', 'Subgroup feature breakdown'],
    },
    {
      id: 'perturbation',
      badge: 'STRESS TESTING',
      badgeVariant: 'warning' as const,
      icon: <Sliders className="w-5 h-5 text-amber-600" />,
      title: 'Counterfactual Perturbation',
      subtitle: 'Single-Candidate "What-If" Analysis',
      description:
        'Interactively modify candidate profile attributes (college tier, location, career gaps) to observe instant deltas in selection probability.',
      techPoints: ['Live profile attribute editing', 'Instant delta score shift', 'Bias sensitivity curve'],
    },
    {
      id: 'synthesis',
      badge: 'COMPLIANCE',
      badgeVariant: 'primary' as const,
      icon: <Sparkles className="w-5 h-5 text-blue-600" />,
      title: 'Automated Narrative Synthesis',
      subtitle: 'AI Audit Explanation Reports',
      description:
        'Synthesize complex SHAP matrix outputs and counterfactual deltas into clear, plain-language narrative reports ready for HR and legal compliance.',
      techPoints: ['Plain-language audit summary', 'Key risk factors highlighted', 'Defensibility assessment'],
    },
    {
      id: 'mitigation',
      badge: 'REMEDIATION',
      badgeVariant: 'neutral' as const,
      icon: <Scale className="w-5 h-5 text-indigo-600" />,
      title: 'Mitigation & Recalibration',
      subtitle: 'Subgroup Threshold Optimization',
      description:
        'Apply subgroup threshold recalibration and re-scoring to eliminate adverse impact while preserving candidate ranking performance.',
      techPoints: ['Equalized odds recalibration', 'Before-vs-after comparison', 'Mitigated SHAP breakdown'],
    },
  ];

  return (
    <div className="space-y-8 sm:space-y-12 pb-8">
      {/* Hero Section */}
      <section className="relative pt-1 sm:pt-2 pb-2">
        {/* 2-Column Grid: Headline & Subhead on Left, 3D Moving Illustration on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center">
          {/* Left Column - Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="space-y-4 sm:space-y-5"
          >
            {/* Platform Tag & Version */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/90 border border-blue-300 text-blue-900 text-xs font-mono-tabular font-bold shadow-xs">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>CHECKSUM FAIRNESS PLATFORM v1.0</span>
            </div>

            {/* Main Headline - Exact Requested Copy */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black text-slate-900 tracking-tight leading-[1.15]">
              Every score hides a decision.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900">
                Checksum makes it explain itself.
              </span>
            </h1>

            {/* Subtitle / Tagline - Exact Requested Copy */}
            <p className="text-base sm:text-lg text-slate-700 font-medium leading-relaxed max-w-2xl">
              Before a hiring model's verdict reaches a real candidate, Checksum interrogates it — tracing every score to the features that shaped it, and testing what happens when one variable changes.
            </p>

            {/* CTA Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="primary"
                size="lg"
                onClick={onGetStarted}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="px-6 py-2.5 text-sm font-bold shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40"
              >
                Start Audit
              </Button>
              <button
                type="button"
                onClick={() => {
                  if (onHowItWorks) {
                    onHowItWorks();
                  } else {
                    const el = document.getElementById('what-is-checksum');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-800 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition-all duration-200 cursor-pointer"
              >
                <Info className="w-4 h-4 text-blue-700" />
                How It Works
              </button>
            </div>
          </motion.div>

          {/* Right Column - Custom Animated 3D Parallax Isometric Illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
            className="w-full relative flex items-center justify-center"
          >
            <HeroIsometricIllustration />
          </motion.div>
        </div>

        {/* Ecosystem Fairness - Positioned cleanly BELOW the 2-column Hero Grid */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 sm:mt-8 p-[1px] rounded-2xl bg-gradient-to-r from-blue-500/40 via-indigo-500/30 to-blue-600/40 shadow-xl"
        >
          <div className="rounded-[15px] bg-slate-900/95 p-6 sm:p-8 relative overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 w-36 h-36 bg-blue-600/15 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold font-mono-tabular uppercase tracking-wider text-blue-300">
                  ECOSYSTEM FAIRNESS
                </span>
              </div>
              <span className="text-[11px] font-mono-tabular font-bold text-blue-300 bg-blue-950/90 px-2.5 py-0.5 rounded-full border border-blue-700/80 shadow-xs">
                🇮🇳 Indian Hiring Market
              </span>
            </div>

            {/* Indian Hiring Market Explicit Copy */}
            <p className="text-xs sm:text-sm text-slate-100 mt-3 leading-relaxed font-semibold">
              Built where bias actually lives in the <span className="text-blue-300 underline decoration-blue-500/50 underline-offset-2">Indian hiring market</span> — audited against college tier, metro access, and career gaps, not imported Western checklists that were never written for local hiring realities.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-blue-500/50 transition-colors shadow-xs space-y-1">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                  <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                  <span>College Tier</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Audits systemic bias toward Tier-1 IIT/NIT/BITS vs Tier-2/3 state universities across India.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-blue-500/50 transition-colors shadow-xs space-y-1">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>Metro Access</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Detects automated penalties against candidates from Tier-2/3 non-metro Indian regions.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 hover:border-blue-500/50 transition-colors shadow-xs space-y-1">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                  <CalendarX className="w-3.5 h-3.5 shrink-0" />
                  <span>Career Gaps</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Distinguishes caregiving & UPSC/higher-ed competitive exam prep gaps from skill deprecation.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* "What is Checksum?" Section - Nicer Glowing Card Effects & Poetic Copy */}
      <section id="what-is-checksum" className="scroll-mt-20">
        <div className="p-[1px] rounded-2xl bg-gradient-to-r from-blue-500/40 via-indigo-500/40 to-blue-600/40 shadow-2xl relative overflow-hidden">
          <div className="rounded-[15px] bg-slate-900/95 p-6 sm:p-8 relative overflow-hidden backdrop-blur-xl">
            {/* Ambient Backlight Glow */}
            <div className="absolute -top-12 -right-12 w-56 h-56 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full space-y-3.5 relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-950/80 text-blue-300 text-xs font-mono-tabular font-bold border border-blue-800/80 shadow-xs">
                <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
                <span>PLATFORM OVERVIEW</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                What is Checksum?
              </h2>

              {/* Poetic & Poignant Text */}
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal w-full">
                In computing, a checksum verifies data integrity — catching the silent bit that shouldn't have flipped. Ours catches the human context that shouldn't have been silenced. Checksum sits between your hiring model and its verdicts — whether scoring via your native agent, a live REST endpoint, or historical decisions — holding every outcome accountable to truth through SHAP feature attribution, counterfactual perturbation, and the EEOC four-fifths line.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal Feature Carousel Section */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono-tabular font-bold bg-blue-100 text-blue-900 border border-blue-300 uppercase tracking-wider mb-2">
              AUDIT CAPABILITIES
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Comprehensive Audit & Fairness Engine
            </h2>
            <p className="text-sm sm:text-base text-slate-700 font-medium mt-1 max-w-2xl">
              Seven purpose-built audit modules and evaluation tools available directly inside Checksum.
            </p>
          </div>

          {/* Carousel Navigation Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => scrollCarousel('left')}
              className="p-2.5 rounded-lg bg-white text-slate-800 hover:text-slate-950 hover:bg-slate-100 border border-slate-300 shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scrollCarousel('right')}
              className="p-2.5 rounded-lg bg-white text-slate-800 hover:text-slate-950 hover:bg-slate-100 border border-slate-300 shadow-xs transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel Scroll Container - Auto-moving with 3D Cards & Pause on Hover */}
        <div
          ref={carouselRef}
          onMouseEnter={() => setIsCarouselHovered(true)}
          onMouseLeave={() => setIsCarouselHovered(false)}
          onTouchStart={() => setIsCarouselHovered(true)}
          onTouchEnd={() => setIsCarouselHovered(false)}
          className="flex gap-4 sm:gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory sm:snap-proximity pb-8 pt-3 px-0 scrollbar-none border-b border-slate-200"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {features.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ y: -8, rotateX: 3, rotateY: -3, scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="snap-start shrink-0 w-[84vw] max-w-[320px] sm:w-[340px] flex flex-col transform-gpu"
              style={{ perspective: 1000 }}
            >
              <div className="h-full rounded-2xl p-[1px] bg-gradient-to-b from-slate-200 via-blue-200/60 to-slate-200 hover:from-blue-500 hover:via-indigo-400 hover:to-blue-600 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-blue-500/20 group">
                <Card variant="default" className="h-full flex flex-col justify-between rounded-[15px] bg-white group-hover:bg-slate-50/90 transition-all duration-300 border-0">
                  <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Header: Icon & Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="p-2.5 rounded-xl bg-blue-50/90 border border-blue-100 group-hover:scale-110 group-hover:bg-blue-100/90 transition-transform duration-300 shadow-xs">
                          {item.icon}
                        </div>
                        <Badge variant={item.badgeVariant} size="sm">
                          {item.badge}
                        </Badge>
                      </div>

                      {/* Title & Subtitle */}
                      <h3 className="text-base font-bold text-slate-900 tracking-tight group-hover:text-blue-900 transition-colors">
                        {item.title}
                      </h3>
                      <div className="text-xs font-semibold text-blue-600 mt-0.5 font-mono-tabular">
                        {item.subtitle}
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    {/* Bullet Tech Points */}
                    <div className="pt-4 border-t border-slate-100 space-y-1.5 mt-4">
                      {item.techPoints.map((pt, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                          <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{pt}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* "Why Checksum?" Section - Premium 3D Glassmorphic Card & Glowing Ambient Highlights */}
      <motion.section
        whileHover={{ y: -4, scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="p-[1px] rounded-2xl bg-gradient-to-r from-blue-500/50 via-indigo-500/40 to-blue-600/50 shadow-2xl hover:shadow-blue-500/25 transition-all duration-300 transform-gpu"
        style={{ perspective: 1000 }}
      >
        <div className="rounded-[15px] bg-slate-900/95 p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden group">
          {/* Ambient Background Glowing Orbs */}
          <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/30 transition-all duration-500" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-500/25 transition-all duration-500" />

          <div className="w-full space-y-4 relative z-10">
            {/* Header Row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-600/25 text-blue-400 border border-blue-500/40 shadow-xs group-hover:scale-110 transition-transform duration-300">
                  <ShieldCheck className="w-5 h-5 text-blue-300" />
                </div>
                <span className="text-xs font-mono-tabular font-extrabold text-blue-300 uppercase tracking-widest bg-blue-950/80 px-3 py-1 rounded-full border border-blue-800/80">
                  THE PHILOSOPHY
                </span>
              </div>
              <span className="text-xs font-mono-tabular font-bold text-slate-400 bg-slate-800/70 px-3 py-1 rounded-full border border-slate-700/80">
                Data Integrity Standard
              </span>
            </div>

            {/* Section Title */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-100 tracking-tight">
              Why <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-blue-200">"Checksum"</span>?
            </h2>

            {/* Poetic & Compelling Statement */}
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal sm:font-medium w-full">
              A checksum never asks for blind faith; it demands proof of integrity. Checksum expects the same standard from automated hiring decisions — asking not merely <span className="italic text-blue-200 font-semibold">"was this candidate rejected,"</span> but <span className="italic text-emerald-300 font-semibold">"would they have been rejected if evaluated with complete fairness."</span> That is the fundamental boundary between an opaque score and a defensible verdict.
            </p>

            {/* Key Assurance Feature Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90 hover:border-blue-500/40 transition-colors shadow-xs space-y-1">
                <span className="text-xs font-bold text-blue-300 block font-mono-tabular">01 • Mathematical Rigor</span>
                <span className="text-[11px] text-slate-400 block leading-snug">SHAP attributions calculate exact feature contribution vectors.</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90 hover:border-blue-500/40 transition-colors shadow-xs space-y-1">
                <span className="text-xs font-bold text-blue-300 block font-mono-tabular">02 • EEOC 80% Benchmark</span>
                <span className="text-[11px] text-slate-400 block leading-snug">Automated four-fifths adverse impact ratio verification.</span>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/90 hover:border-blue-500/40 transition-colors shadow-xs space-y-1">
                <span className="text-xs font-bold text-blue-300 block font-mono-tabular">03 • Defensible Verdicts</span>
                <span className="text-[11px] text-slate-400 block leading-snug">Export legal-ready compliance reports and subgroup audits.</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80">
              <Button
                variant="primary"
                size="md"
                onClick={onGetStarted}
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="font-bold shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 px-6 py-2.5 text-sm"
              >
                Launch Your First Audit
              </Button>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono-tabular font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>3 Flexible Audit Paths • Instant Report Generation</span>
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
};
