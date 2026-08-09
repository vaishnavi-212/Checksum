import React, { useState, useEffect } from 'react';
import { PlusCircle, Plus, ArrowRight, BarChart2, Activity, Home, FileText, HelpCircle } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { getHealth } from '../../services/api';

export interface HeaderProps {
  activeScreen?: 'landing' | 'upload' | 'status' | 'results' | 'how-it-works';
  activeJobId?: string | null;
  onNavigate?: (screen: 'landing' | 'upload' | 'status' | 'results' | 'how-it-works') => void;
  onNewAudit?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeScreen = 'landing',
  activeJobId = null,
  onNavigate,
  onNewAudit,
}) => {
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    getHealth()
      .then((res) => {
        if (isMounted) {
          setIsHealthy(res.status === 'ok' || !!res.app);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsHealthy(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Brand & Logo - Clickable to navigate to landing */}
        <button
          type="button"
          onClick={() => onNavigate?.('landing')}
          className="flex items-center gap-2 sm:gap-3 shrink-0 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1 hover:opacity-90 transition-opacity cursor-pointer group"
          aria-label="Checksum Home"
        >
          <div className="p-1.5 sm:p-2 rounded-lg bg-blue-600 text-white shadow-xs border border-blue-500/30 group-hover:bg-blue-700 transition-colors">
            <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">Checksum</span>
              <span className="px-1 sm:px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-mono-tabular font-bold bg-blue-50 text-blue-700 border border-blue-200">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">AI Hiring-Bias Audit Platform</p>
          </div>
        </button>

        {/* Center Navbar Links: Home / Audit Engine / How It Works / Dashboard & Audit Pages */}
        <nav className="flex items-center gap-0.5 sm:gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => onNavigate?.('landing')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
              activeScreen === 'landing'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('upload')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
              activeScreen === 'upload'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Audit Engine</span>
            <span className="sm:hidden">Audit</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('how-it-works')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
              activeScreen === 'how-it-works'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">How It Works</span>
            <span className="sm:hidden">Guide</span>
          </button>

          {activeJobId && (
            <button
              type="button"
              onClick={() => onNavigate?.('results')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                activeScreen === 'results' || activeScreen === 'status'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Audit Results</span>
              <span className="sm:hidden">Results</span>
            </button>
          )}
        </nav>

        {/* Right Side: Persistent Start Audit CTA, Active Job Context & System Health */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Job Context Pill & Action */}
          {activeJobId && (
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-mono-tabular text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>Job:</span>
                <span className="font-bold text-slate-900">{activeJobId.slice(-8)}</span>
              </div>
            </div>
          )}

          {/* Persistent Start Audit CTA button (when not on upload screen) */}
          {activeScreen !== 'upload' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (onNewAudit) {
                  onNewAudit();
                } else if (onNavigate) {
                  onNavigate('upload');
                }
              }}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              className="text-xs font-semibold shadow-xs hidden md:inline-flex"
            >
              Start Audit
            </Button>
          )}

          {/* System Health Status Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/90 shadow-2xs">
            {isHealthy === null ? (
              <Badge variant="neutral" size="sm" icon={<Activity className="w-3 h-3 animate-spin text-slate-400" />}>
                Connecting...
              </Badge>
            ) : isHealthy ? (
              <Badge variant="passed" size="sm">
                Operational
              </Badge>
            ) : (
              <Badge variant="warning" size="sm">
                Degraded
              </Badge>
            )}
            <span className="text-slate-300 hidden md:inline">•</span>
            <span className="text-xs font-mono-tabular text-slate-600 font-medium hidden md:inline">
              FastAPI Engine
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

