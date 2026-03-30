import { useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { DomainSelector } from './components/DomainSelector';
import { InterviewRoom } from './components/InterviewRoom';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { ProgressDashboard } from './components/ProgressDashboard';
import { useInterviewSession } from './hooks/useInterviewSession';
import { useAuth } from './hooks/useAuth';
import { logout } from './lib/auth';
import type { SessionConfig } from './types/interview';

function InterviewPage() {
  const [activeDomain, setActiveDomain] = useState('');
  const { status, messages, error, isRecording, sessionId, startInterview, endInterview, resetSession, getTranscript } =
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
          onEnd={endInterview}
          onNewInterview={handleNewInterview}
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

export default function App() {
  const { user, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
              <Link to="/progress" className="topnav__link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                Progress
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
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
          } />
          <Route path="/register" element={
            isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />
          } />
          <Route path="/progress" element={
            <ProtectedRoute><ProgressDashboard /></ProtectedRoute>
          } />
          <Route path="/" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />
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
