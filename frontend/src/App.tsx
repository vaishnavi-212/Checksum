import React, { useState } from 'react';
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

function MainApp() {
  const [activeScreen, setActiveScreen] = useState<ScreenState>('landing');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [, setCreatedJobs] = useState<UploadResponse[]>([]);

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
