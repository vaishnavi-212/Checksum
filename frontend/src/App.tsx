import React, { useEffect, useState } from 'react';
import { Header } from './components/layout/Header';
import { Container } from './components/layout/Container';
import { ToastProvider } from './components/ui/Toast';
import { LandingPage } from './components/landing/LandingPage';
import { HowItWorksPage } from './components/howItWorks/HowItWorksPage';
import { LandingUploadScreen } from './components/upload/LandingUploadScreen';
import { JobStatusTracker } from './components/dashboard/JobStatusTracker';
import { ResultsDashboard } from './components/dashboard/ResultsDashboard';
import { UploadResponse } from './services/api';

type ScreenState = 'landing' | 'upload' | 'status' | 'results' | 'how-it-works';

/** Read ?job=<id>&view=results so a refresh or a shared link reopens the audit. */
function readUrlState(): { jobId: string | null; screen: ScreenState } {
  try {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get('job');
    if (jobId && /^[a-zA-Z0-9_-]{1,64}$/.test(jobId)) {
      return { jobId, screen: params.get('view') === 'results' ? 'results' : 'status' };
    }
  } catch {
    // ignore malformed URLs
  }
  return { jobId: null, screen: 'landing' };
}

function writeUrlState(jobId: string | null, screen: ScreenState) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('job');
    url.searchParams.delete('view');
    if (jobId && (screen === 'status' || screen === 'results')) {
      url.searchParams.set('job', jobId);
      if (screen === 'results') url.searchParams.set('view', 'results');
    }
    window.history.replaceState(null, '', url.toString());
  } catch {
    // history API unavailable (e.g. sandboxed preview) - not critical
  }
}

function MainApp() {
  const initial = readUrlState();
  const [activeScreen, setActiveScreenState] = useState<ScreenState>(initial.screen);
  const [activeJobId, setActiveJobId] = useState<string | null>(initial.jobId);
  const [, setCreatedJobs] = useState<UploadResponse[]>([]);

  useEffect(() => {
    writeUrlState(activeJobId, activeScreen);
  }, [activeJobId, activeScreen]);

  const setActiveScreen = (screen: ScreenState) => setActiveScreenState(screen);

  const handleJobCreated = (job: UploadResponse) => {
    setCreatedJobs((prev) => [job, ...prev]);
    setActiveJobId(job.job_id);
    setActiveScreen('status');
  };

  return (
    <div className="min-h-screen text-slate-900 pb-16 bg-dot-pattern">
      <Header
        activeScreen={activeScreen}
        activeJobId={activeJobId}
        onNavigate={(screen) => setActiveScreen(screen)}
        onNewAudit={() => {
          setActiveJobId(null);
          setActiveScreen('upload');
        }}
      />

      <main className="pt-6">
        <Container size="lg" className="space-y-6">
          {activeScreen === 'landing' && (
            <LandingPage
              onGetStarted={() => setActiveScreen('upload')}
              onHowItWorks={() => setActiveScreen('how-it-works')}
            />
          )}

          {activeScreen === 'how-it-works' && (
            <HowItWorksPage onStartAudit={() => setActiveScreen('upload')} />
          )}

          {activeScreen === 'upload' && (
            <LandingUploadScreen onJobCreated={handleJobCreated} />
          )}

          {activeScreen === 'status' && activeJobId && (
            <JobStatusTracker
              jobId={activeJobId}
              onViewResults={() => setActiveScreen('results')}
              onBackToUpload={() => setActiveScreen('upload')}
            />
          )}

          {activeScreen === 'results' && activeJobId && (
            <ResultsDashboard
              jobId={activeJobId}
              onBackToUpload={() => setActiveScreen('upload')}
            />
          )}
        </Container>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
