import { useState, useEffect } from 'react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from 'react-router-dom';
import { DomainSelector } from './components/DomainSelector';
import { InterviewRoom } from './components/InterviewRoom';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { ProgressDashboard } from './components/ProgressDashboard';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { SettingsPage } from './components/SettingsPage';
import { ResumeComparePage } from './components/ResumeComparePage';
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
      <div className="auth-loading">
        <div className="spinner" />
        <p>Loading…</p>
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
    <div className="app">
      {/* Ambient background blobs */}
      <div className="bg-blob bg-blob--1" aria-hidden="true" />
      <div className="bg-blob bg-blob--2" aria-hidden="true" />
      <div className="bg-blob bg-blob--3" aria-hidden="true" />

      {/* Top nav */}
      <nav className="topnav">
        <Link to="/" className="topnav__brand">
          <div className="topnav__logo">AI</div>
          <span className="topnav__name">
            Interview <strong>Quasar</strong>
          </span>
        </Link>

        <div className="topnav__right">
          {isAuthenticated && (
            <>
              <Link to="/interview" className="topnav__link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
                Interview
              </Link>
              <Link to="/progress" className="topnav__link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Progress
              </Link>
              <Link to="/resume-compare" className="topnav__link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Resume Check
              </Link>
              <Link to="/settings" className="topnav__link" title="Settings">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </Link>
              <div className="topnav__user">
                <div className="topnav__avatar">{user?.name?.charAt(0).toUpperCase()}</div>
                <span className="topnav__username">{user?.name}</span>
              </div>
              <button onClick={handleLogout} className="topnav__logout" title="Sign out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </>
          )}
          {!isAuthenticated && !loading && (
            <Link to="/login" className="btn-primary btn-small">Sign In</Link>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="app__main">
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/interview" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/interview" replace /> : <RegisterPage />} />
          <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/interview" replace /> : <ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/progress" element={<ProtectedRoute><ProgressDashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/resume-compare" element={<ProtectedRoute><ResumeComparePage /></ProtectedRoute>} />
          <Route path="/interview" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="app__footer">
        <span>Powered by</span>
        <span className="text-accent">Gemini Live API</span>
        <span>•</span>
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
