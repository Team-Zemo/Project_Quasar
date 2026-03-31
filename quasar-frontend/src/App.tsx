import { useState, useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { Mic, TrendingUp, FileText, BarChart2, MessageSquare, Settings, LogOut } from 'lucide-react';
import { DomainSelector } from './components/DomainSelector';
import { InterviewRoom } from './components/InterviewRoom';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { ProgressDashboard } from './components/ProgressDashboard';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { SettingsPage } from './components/SettingsPage';
import { ResumeComparePage } from './components/ResumeComparePage';
import { StatsPage } from './components/StatsPage';
import { CoachChat } from './components/CoachChat';
import { LandingPage } from './landing/LandingPage';
import { useInterviewSession } from './hooks/useInterviewSession';
import { useAuth } from './hooks/useAuth';
import { logout } from './lib/auth';
import type { SessionConfig } from './types/interview';

function InterviewPage() {
  const [activeDomain, setActiveDomain] = useState('');
  const { status, messages, error, isRecording, sessionId, activeCodingQuestion, startInterview, endInterview, resetSession, getTranscript, submitCode } =
    useInterviewSession();

  const isInSession = status === 'connecting' || status === 'active' || status === 'ready';
  const isEnded = status === 'ended' || status === 'error';

  const handleStart = (config: SessionConfig) => {
    setActiveDomain(config.domain);
    startInterview(config);
  };

  const handleNewInterview = () => {
    resetSession();
    setActiveDomain('');
  };

  return (
    <>
      {!isInSession && !isEnded ? (
        <DomainSelector onStart={handleStart} status={status} error={error} />
      ) : (
        <InterviewRoom
          messages={messages}
          status={status}
          isRecording={isRecording}
          domain={activeDomain}
          sessionId={sessionId}
          activeCodingQuestion={activeCodingQuestion}
          onEnd={endInterview}
          onNewInterview={handleNewInterview}
          onSubmitCode={submitCode}
          getTranscript={getTranscript}
        />
      )}
    </>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-[var(--c-text-dim)]">
        <div className="spinner" />
        <p className="text-[14px] font-medium tracking-wide">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/** The app shell with topnav, blobs, and footer — wraps authenticated pages */
function AppShell() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex flex-col min-h-screen relative overflow-x-hidden">
      {/* Ambient background blobs */}
      <div className="bg-blob bg-blob--1" aria-hidden="true" />
      <div className="bg-blob bg-blob--2" aria-hidden="true" />
      <div className="bg-blob bg-blob--3" aria-hidden="true" />

      {/* Top nav */}
      <nav className="fixed top-0 inset-x-0 h-[64px] border-b border-[var(--c-border)] backdrop-blur-md bg-[var(--bg-app)]/80 z-40 flex items-center justify-between px-6 transition-all">
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--c-accent)] to-[#fb923c] flex items-center justify-center text-white font-black text-[14px] shadow-sm group-hover:shadow-[0_0_12px_var(--c-accent-glow)] transition-all">
            AI
          </div>
          <span className="text-[17px] tracking-wide text-[var(--c-text-dim)] font-medium">
            Interview <strong className="font-black text-[var(--c-text)]">Quasar</strong>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {isAuthenticated && (
            <>
              <Link to="/interview" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors">
                <Mic size={16} strokeWidth={2.5} />
                Interview
              </Link>
              <Link to="/progress" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors">
                <TrendingUp size={16} strokeWidth={2.5} />
                Progress
              </Link>
              <Link to="/resume-compare" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors">
                <FileText size={16} strokeWidth={2.5} />
                Resume Check
              </Link>
              <Link to="/stats" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors">
                <BarChart2 size={16} strokeWidth={2.5} />
                Stats
              </Link>
              <Link to="/coach" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors">
                <MessageSquare size={16} strokeWidth={2.5} />
                Coach
              </Link>
              <Link to="/settings" className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors" title="Settings">
                <Settings size={16} strokeWidth={2.5} />
              </Link>
              
              <div className="flex items-center gap-2.5 ml-2 pl-4 border-l border-[var(--c-border)]">
                <div className="flex items-center justify-center w-[30px] h-[30px] rounded-full bg-[var(--c-surface-3)] text-[12px] font-bold border border-[var(--c-border-2)] text-[var(--c-text)] uppercase tracking-wider">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-[13px] font-bold text-[var(--c-text)] hidden md:block">{user?.name}</span>
              </div>
              
              <button onClick={handleLogout} className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--c-text-mute)] hover:text-[var(--c-error)] hover:bg-red-500/10 transition-colors ml-1" title="Sign out">
                <LogOut size={16} strokeWidth={2.5} />
              </button>
            </>
          )}
          {!isAuthenticated && !loading && (
            <Link to="/login" className="btn-primary btn-small">Sign In</Link>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center w-full px-4 md:px-8 pb-8 relative z-10 pt-[80px]">
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/interview" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/interview" replace /> : <RegisterPage />} />
          <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/interview" replace /> : <ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/progress" element={<ProtectedRoute><ProgressDashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/resume-compare" element={<ProtectedRoute><ResumeComparePage /></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
          <Route path="/coach" element={<ProtectedRoute><CoachChat /></ProtectedRoute>} />
          <Route path="/interview" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-2 mb-4 p-4 text-[11px] uppercase tracking-wider font-bold text-[var(--c-text-mute)] z-10 relative mt-auto border-t border-[var(--c-border)] backdrop-blur-sm bg-black/20">
        <span>Powered by</span>
        <span className="text-[var(--c-accent)] text-shadow-sm shadow-orange-500/20">Gemini Live API</span>
        <span className="opacity-50">•</span>
        <span>Node.js + React</span>
      </footer>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.05, // Slower, smoother lerping
      wheelMultiplier: 1, // Standard scroll speed multiplier
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  // Landing page gets its own full-page layout (no app shell)
  if (location.pathname === '/') {
    return <LandingPage />;
  }

  // All other routes use the app shell with topnav
  return <AppShell />;
}
