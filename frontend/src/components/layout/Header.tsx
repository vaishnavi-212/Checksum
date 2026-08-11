import React, { useState, useEffect } from 'react';
import { PlusCircle, Plus, BarChart2, Activity, Home, FileText, HelpCircle, Menu, X } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand & Logo - Clickable to navigate to landing */}
        <button
          type="button"
          onClick={() => {
            setIsMobileMenuOpen(false);
            onNavigate?.('landing');
          }}
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
            <p className="text-[11px] text-slate-500 hidden lg:block">AI Hiring-Bias Audit Platform</p>
          </div>
        </button>

        {/* Desktop / Tablet Navbar Links */}
        <nav className="hidden md:flex items-center gap-0.5 lg:gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => onNavigate?.('landing')}
            className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
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
            className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeScreen === 'upload'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Audit Engine</span>
            <span className="lg:hidden">Audit</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.('how-it-works')}
            className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeScreen === 'how-it-works'
                ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">How It Works</span>
            <span className="lg:hidden">Guide</span>
          </button>

          {activeJobId && (
            <button
              type="button"
              onClick={() => onNavigate?.('results')}
              className={`flex items-center gap-1 lg:gap-1.5 px-2 lg:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeScreen === 'results' || activeScreen === 'status'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/90 font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Audit Results</span>
              <span className="lg:hidden">Results</span>
            </button>
          )}
        </nav>

        {/* Desktop / Tablet Right Side */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3">
          {activeJobId && (
            <div className="hidden xl:flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-mono-tabular text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span>Job:</span>
                <span className="font-bold text-slate-900">{activeJobId.slice(-8)}</span>
              </div>
            </div>
          )}

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
              className="text-xs font-semibold shadow-xs shrink-0"
            >
              Start Audit
            </Button>
          )}

          <div className="hidden lg:flex items-center gap-1.5 lg:gap-2 px-2.5 lg:px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/90 shadow-2xs shrink-0">
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
            <span className="text-slate-300">•</span>
            <span className="text-xs font-mono-tabular text-slate-600 font-medium">
              FastAPI Engine
            </span>
          </div>
        </div>

        {/* Mobile Navbar Control (Hamburger & Status) */}
        <div className="flex md:hidden items-center gap-2">
          <div className="flex items-center px-2 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-medium text-slate-600">
            {isHealthy === null ? (
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" title="Connecting..." />
            ) : isHealthy ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Operational" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-500" title="Degraded" />
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5 text-slate-800" />
            ) : (
              <Menu className="w-5 h-5 text-slate-800" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/90 bg-white/95 backdrop-blur-md px-4 py-3 space-y-3 shadow-lg">
          <nav className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onNavigate?.('landing');
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer text-left ${
                activeScreen === 'landing'
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Home className="w-4 h-4 text-blue-600" />
              <span>Home</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onNavigate?.('upload');
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer text-left ${
                activeScreen === 'upload'
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Audit Engine</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onNavigate?.('how-it-works');
              }}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer text-left ${
                activeScreen === 'how-it-works'
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <HelpCircle className="w-4 h-4 text-blue-600" />
              <span>How It Works</span>
            </button>

            {activeJobId && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onNavigate?.('results');
                }}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer text-left ${
                  activeScreen === 'results' || activeScreen === 'status'
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/60'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  <span>Audit Results</span>
                </div>
                <span className="text-[11px] font-mono-tabular text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  #{activeJobId.slice(-6)}
                </span>
              </button>
            )}
          </nav>

          <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-2.5">
            {activeScreen !== 'upload' && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  if (onNewAudit) {
                    onNewAudit();
                  } else if (onNavigate) {
                    onNavigate('upload');
                  }
                }}
                leftIcon={<Plus className="w-4 h-4" />}
                className="w-full justify-center text-sm font-semibold shadow-xs"
              >
                Start Audit
              </Button>
            )}

            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 font-medium">
              <span className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-slate-500" />
                FastAPI Engine:
              </span>
              {isHealthy === null ? (
                <span className="text-slate-400 font-semibold">Connecting...</span>
              ) : isHealthy ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Operational
                </span>
              ) : (
                <span className="text-amber-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Degraded
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};


