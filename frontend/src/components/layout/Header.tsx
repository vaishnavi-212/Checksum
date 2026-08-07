import React, { useState, useEffect } from 'react';
import { ShieldCheck, Plus, ArrowRight, BarChart2, Activity } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { getHealth } from '../../services/api';

export interface HeaderProps {
  activeScreen?: 'upload' | 'status' | 'results';
  activeJobId?: string | null;
  onNavigate?: (screen: 'upload' | 'status' | 'results') => void;
  onNewAudit?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeScreen = 'upload',
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
    <header className="sticky top-0 z-40 w-full bg-white/85 backdrop-blur-md border-b border-slate-200/90 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs border border-blue-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 tracking-tight">Checksum</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-bold bg-blue-50 text-blue-700 border border-blue-200">
                v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">AI Hiring-Bias Audit Platform</p>
          </div>
        </div>

        {/* Right Side: System Health Status & Active Job Navigation */}
        <div className="flex items-center gap-3">
          {/* Active Job Context Pill & Action */}
          {activeJobId && (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/80 text-[11px] font-mono-tabular text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>Job:</span>
                <span className="font-bold text-slate-900">{activeJobId.slice(-8)}</span>
              </div>

              {activeScreen === 'upload' ? (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<BarChart2 className="w-3.5 h-3.5 text-blue-600" />}
                  rightIcon={<ArrowRight className="w-3 h-3 text-slate-400" />}
                  onClick={() => onNavigate?.('results')}
                  className="text-xs font-semibold"
                >
                  View Active Audit
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5 text-blue-600" />}
                  onClick={() => {
                    if (onNewAudit) {
                      onNewAudit();
                    } else if (onNavigate) {
                      onNavigate('upload');
                    }
                  }}
                  className="text-xs font-semibold"
                >
                  New Audit
                </Button>
              )}
            </div>
          )}

          {/* System Health Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/90 shadow-2xs">
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
            <span className="text-xs font-mono-tabular text-slate-600 font-medium hidden sm:inline">
              FastAPI Engine
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

