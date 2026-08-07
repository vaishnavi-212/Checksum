import React, { useState } from 'react';
import { Header } from './components/layout/Header';
import { Container } from './components/layout/Container';
import { ToastProvider } from './components/ui/Toast';
import { LandingUploadScreen } from './components/upload/LandingUploadScreen';
import { JobStatusTracker } from './components/dashboard/JobStatusTracker';
import { ResultsDashboard } from './components/dashboard/ResultsDashboard';
import { UploadResponse } from './services/api';

type ScreenState = 'upload' | 'status' | 'results';

function MainApp() {
  const [activeScreen, setActiveScreen] = useState<ScreenState>('upload');
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
