import { useState, useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import {
  Routes,
  Route,
  Navigate,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Mic,
  TrendingUp,
  FileText,
  BarChart2,
  MessageSquare,
  User,
  LogOut,
  BookOpenCheck,
  Menu,
  X,
  Briefcase,
  FolderOpen,
  PenTool,
} from "lucide-react";
import { DomainSelector } from "./components/DomainSelector";
import { InterviewPermissionGate } from "./components/InterviewPermissionGate.tsx";
import { InterviewRoom } from "./components/InterviewRoom";
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { ProgressDashboard } from "./components/ProgressDashboard";
import { ForgotPasswordPage } from "./components/ForgotPasswordPage";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { ProfilePage } from "./components/ProfilePage";
import { ResumeComparePage } from "./components/ResumeComparePage";
import { StatsPage } from "./components/StatsPage";
import { CoachChat } from "./components/CoachChat";
import { StudyPlanPage } from "./components/StudyPlanPage";
import { LandingPage } from "./landing/LandingPage";
import { RoleSelectionPage } from "./components/RoleSelectionPage";
import { CandidateOnboarding } from "./components/CandidateOnboarding";
import { RecruiterOnboarding } from "./components/RecruiterOnboarding";
import { RecruiterShell } from "./components/RecruiterShell";
import { JobBrowser } from "./components/candidate/JobBrowser";
import { JobDetail } from "./components/candidate/JobDetail";
import { MyApplications } from "./components/candidate/MyApplications";
import { McqTestPage } from "./components/candidate/McqTestPage";
import { DsaTestPage } from "./components/candidate/DsaTestPage";
import { PipelineInterviewPage } from "./components/candidate/PipelineInterviewPage";
import { PlatformContextPage } from "./components/PlatformContextPage";
import { ResumeEditorPage } from "./components/candidate/ResumeEditorPage";
import { useInterviewSession } from "./hooks/useInterviewSession";
import { useAuth } from "./hooks/useAuth";
import { logout } from "./lib/auth";
import type { SessionConfig } from "./types/interview";

function InterviewPage() {
  const navigate = useNavigate();
  const [activeDomain, setActiveDomain] = useState("");
  const [pendingConfig, setPendingConfig] = useState<SessionConfig | null>(
    null,
  );
  const [showPermissionGate, setShowPermissionGate] = useState(false);
  const [startingInterview, setStartingInterview] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [fullscreenCountdown, setFullscreenCountdown] = useState(10);
  const [restoringFullscreen, setRestoringFullscreen] = useState(false);
  const {
    status,
    messages,
    error,
    isRecording,
    isMuted,
    pttEnabled,
    sessionId,
    activeCodingQuestion,
    startInterview,
    endInterview,
    resetSession,
    getTranscript,
    submitCode,
    setMuted,
    setPttEnabled,
  } = useInterviewSession();

  const isInSession =
    status === "connecting" || status === "active" || status === "ready";
  const isEnded = status === "ended" || status === "error";

  useEffect(() => {
    if (!isInSession) {
      setShowFullscreenWarning(false);
      setFullscreenCountdown(10);
      return;
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setShowFullscreenWarning(true);
        setFullscreenCountdown(10);
      } else {
        setShowFullscreenWarning(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isInSession]);

  useEffect(() => {
    if (!showFullscreenWarning) return;

    if (fullscreenCountdown <= 0) {
      setShowFullscreenWarning(false);
      handleEndInterview();
      return;
    }

    const timer = window.setTimeout(() => {
      setFullscreenCountdown((prev) => prev - 1);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showFullscreenWarning, fullscreenCountdown]);

  const requestAppFullscreen = async () => {
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          (el as any).webkitRequestFullscreen();
        } else if ((el as any).msRequestFullscreen) {
          (el as any).msRequestFullscreen();
        }
      }
      return true;
    } catch {
      return false;
    }
  };

  const handleStart = async (config: SessionConfig) => {
    setPendingConfig(config);
    setShowPermissionGate(true);
  };

  const handleStartAfterPermissions = async () => {
    if (!pendingConfig) return;
    setStartingInterview(true);

    const enteredFullscreen = await requestAppFullscreen();
    if (!enteredFullscreen) {
      setStartingInterview(false);
      return;
    }

    navigate("/interview?active=1", { replace: true });
    setActiveDomain(pendingConfig.domain);
    startInterview(pendingConfig);
    setStartingInterview(false);
    setShowPermissionGate(false);
    setPendingConfig(null);
  };

  const handleNewInterview = () => {
    navigate("/interview", { replace: true });
    resetSession();
    setActiveDomain("");
    setPendingConfig(null);
    setShowPermissionGate(false);
  };

  const handleEndInterview = () => {
    navigate("/interview", { replace: true });
    endInterview();
  };

  const handleReturnToFullscreen = async () => {
    setRestoringFullscreen(true);
    const enteredFullscreen = await requestAppFullscreen();
    if (enteredFullscreen) {
      setShowFullscreenWarning(false);
      setFullscreenCountdown(10);
    }
    setRestoringFullscreen(false);
  };

  return (
    <>
      {!isInSession && !isEnded ? (
        showPermissionGate && pendingConfig ? (
          <InterviewPermissionGate
            domain={pendingConfig.domain}
            isStarting={startingInterview}
            onBack={() => {
              setShowPermissionGate(false);
              setStartingInterview(false);
            }}
            onEnter={handleStartAfterPermissions}
          />
        ) : (
          <DomainSelector onStart={handleStart} status={status} error={error} />
        )
      ) : (
        <InterviewRoom
          messages={messages}
          status={status}
          isRecording={isRecording}
          domain={activeDomain}
          sessionId={sessionId}
          activeCodingQuestion={activeCodingQuestion}
          onEnd={handleEndInterview}
          onNewInterview={handleNewInterview}
          onSubmitCode={submitCode}
          getTranscript={getTranscript}
          isMuted={isMuted}
          setMuted={setMuted}
          pttEnabled={pttEnabled}
          setPttEnabled={setPttEnabled}
        />
      )}

      {showFullscreenWarning && isInSession && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[var(--c-error)]/40 bg-[var(--c-surface)] p-6 shadow-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--c-error)]">
              Fullscreen Required
            </p>
            <h3 className="mt-2 text-[20px] font-black text-[var(--c-text)] tracking-tight">
              Return to full screen in {fullscreenCountdown}s
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--c-text-dim)]">
              Do not exit full screen mode again. Click the button below to
              return to full screen now.
            </p>

            <button
              type="button"
              onClick={handleReturnToFullscreen}
              disabled={restoringFullscreen}
              className="mt-5 w-full rounded-xl bg-[var(--c-accent)] px-4 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-[var(--c-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {restoringFullscreen ? "Restoring..." : "Return to Full Screen"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function JobBrowserPage() {
  const location = useLocation();
  const routeState = location.state as { viewJobId?: string } | null;
  const [viewingJobId, setViewingJobId] = useState<string | null>(
    routeState?.viewJobId ?? null,
  );

  // If navigated with a viewJobId (e.g. from Coach Chat), auto-open it
  useEffect(() => {
    if (routeState?.viewJobId && routeState.viewJobId !== viewingJobId) {
      setViewingJobId(routeState.viewJobId);
    }
  }, [routeState?.viewJobId]);

  if (viewingJobId) {
    return (
      <JobDetail jobId={viewingJobId} onBack={() => setViewingJobId(null)} />
    );
  }

  return <JobBrowser onViewJob={(id) => setViewingJobId(id)} />;
}

/**
 * McqTestRoute — standalone route for MCQ test (/mcq-test)
 * Rendered without navbar for proctored exam experience.
 */
function McqTestRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const appId = (location.state as any)?.appId;

  useEffect(() => {
    if (!appId) navigate("/my-applications", { replace: true });
  }, [appId, navigate]);

  if (!appId) return null;

  return (
    <McqTestPage
      appId={appId}
      onComplete={() => {
        navigate("/my-applications", {
          state: { activeAppId: appId, refreshKey: Date.now() },
        });
      }}
      onBack={() => {
        navigate("/my-applications");
      }}
    />
  );
}

/**
 * DsaTestRoute — standalone route for DSA test (/dsa-test)
 * Rendered without navbar for proctored exam experience.
 */
function DsaTestRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const appId = (location.state as any)?.appId;

  useEffect(() => {
    if (!appId) navigate("/my-applications", { replace: true });
  }, [appId, navigate]);

  if (!appId) return null;

  return (
    <DsaTestPage
      appId={appId}
      onComplete={() => {
        navigate("/my-applications", {
          state: { activeAppId: appId, refreshKey: Date.now() },
        });
      }}
      onBack={() => {
        navigate("/my-applications");
      }}
    />
  );
}

/**
 * ApplicationsPage — manages the full pipeline journey:
 * List → Pipeline Tracker → MCQ Test or Live Interview (Tech/HR)
 */
function ApplicationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<
    | { type: "list" }
    | { type: "mcq"; appId: string }
    | { type: "dsa"; appId: string }
  >({ type: "list" });

  // When returning from /pipeline-interview, the route state carries activeAppId + refreshKey
  const routeActiveAppId = (location.state as any)?.activeAppId ?? null;
  const routeRefreshKey = (location.state as any)?.refreshKey ?? null;
  const [activeAppId, setActiveAppId] = useState<string | null>(
    routeActiveAppId,
  );

  // Sync if navigating back from pipeline interview while component is already mounted
  useEffect(() => {
    const fromRoute = (location.state as any)?.activeAppId;
    if (fromRoute) setActiveAppId(fromRoute);
  }, [location.state]);

  if (view.type === "mcq") {
    navigate("/mcq-test", { state: { appId: view.appId } });
    setView({ type: "list" });
    return null;
  }
  if (view.type === "dsa") {
    navigate("/dsa-test", { state: { appId: view.appId } });
    setView({ type: "list" });
    return null;
  }

  return (
    <MyApplications
      activeAppId={activeAppId}
      refreshKey={routeRefreshKey}
      onClearActiveApp={() => setActiveAppId(null)}
      onStartMcq={(appId) => setView({ type: "mcq", appId })}
      onStartDsa={(appId) => setView({ type: "dsa", appId })}
      onStartTechInterview={(
        appId,
        round,
        config,
        jdContext,
        jobTitle,
        company,
        alreadyStarted,
      ) => {
        navigate("/pipeline-interview", {
          state: {
            appId,
            mode: "tech",
            roundNumber: round,
            domain: config?.domain || "Technical",
            durationMinutes: config?.durationMinutes || 30,
            jdContext,
            jobTitle: jobTitle || config?.title || "Technical Interview",
            company: company || "",
            alreadyStarted,
          },
        });
      }}
      onStartHrInterview={(
        appId,
        jdContext,
        jobTitle,
        company,
        durationMinutes,
        alreadyStarted,
      ) => {
        navigate("/pipeline-interview", {
          state: {
            appId,
            mode: "hr",
            roundNumber: 1,
            domain: "HR",
            durationMinutes: durationMinutes || 30,
            jdContext,
            jobTitle: jobTitle || "HR Interview",
            company: company || "",
            alreadyStarted,
          },
        });
      }}
    />
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
  const location = useLocation();
  const isInterview = location.pathname === "/interview";
  const isActiveInterview =
    isInterview && new URLSearchParams(location.search).get("active") === "1";
  const isCoach = location.pathname === "/coach";
  const isFullScreenApp =
    isInterview ||
    location.pathname.startsWith("/pipeline-interview") ||
    location.pathname.startsWith("/mcq-test") ||
    location.pathname.startsWith("/dsa-test");
  // Hide navbar during any fullscreen proctored flow.
  const isProctoredExam =
    isActiveInterview ||
    location.pathname.startsWith("/pipeline-interview") ||
    location.pathname.startsWith("/mcq-test") ||
    location.pathname.startsWith("/dsa-test");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div
      className={`flex flex-col relative overflow-x-hidden ${
        isFullScreenApp || isCoach ? "h-screen overflow-hidden" : "min-h-screen"
      }`}
    >
      {/* Ambient background blobs */}
      <div className="bg-blob bg-blob--1" aria-hidden="true" />
      <div className="bg-blob bg-blob--2" aria-hidden="true" />
      {!isFullScreenApp && (
        <div className="bg-blob bg-blob--3" aria-hidden="true" />
      )}

      {/* Top nav — hidden entirely during proctored exams */}
      {!isProctoredExam && (
        <nav className="fixed top-0 inset-x-0 h-[64px] border-b border-[var(--c-border)] backdrop-blur-md bg-[var(--bg-app)]/80 z-40 flex items-center justify-between px-6 transition-all">
          <Link to="/" className="flex items-center gap-3 no-underline group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--c-accent)] to-[#fb923c] p-1.5 flex items-center justify-center shadow-sm group-hover:shadow-[0_0_12px_var(--c-accent-glow)] transition-all">
              <img
                src="/Quasar_transparent.svg"
                alt="Quasar logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-[17px] tracking-wide text-[var(--c-text-dim)] font-medium">
              <strong className="font-black text-[var(--c-text)]">
                Quasar
              </strong>
            </span>
          </Link>

          <div className="flex items-center md:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--c-surface-2)] text-[var(--c-text)] border border-[var(--c-border)] hover:bg-[var(--c-surface-3)] transition-colors"
            >
              {mobileMenuOpen ? (
                <X size={20} strokeWidth={2.5} />
              ) : (
                <Menu size={20} strokeWidth={2.5} />
              )}
            </button>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated && (
              <>
                <Link
                  to="/interview"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                >
                  <Mic size={16} strokeWidth={2.5} />
                  Interview
                </Link>
                <Link
                  to="/progress"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                >
                  <TrendingUp size={16} strokeWidth={2.5} />
                  Progress
                </Link>
                <Link
                  to="/resume-compare"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                >
                  <FileText size={16} strokeWidth={2.5} />
                  Resume Check
                </Link>
                <Link
                  to="/stats"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                >
                  <BarChart2 size={16} strokeWidth={2.5} />
                  Stats
                </Link>
                <Link
                  to="/coach"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                >
                  <MessageSquare size={16} strokeWidth={2.5} />
                  Coach
                </Link>
                <Link
                  to="/study-plan"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                >
                  <BookOpenCheck size={16} strokeWidth={2.5} />
                  Study Plan
                </Link>
                {user?.role === "candidate" && (
                  <>
                    <Link
                      to="/jobs"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                    >
                      <Briefcase size={16} strokeWidth={2.5} />
                      Jobs
                    </Link>
                    <Link
                      to="/my-applications"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                    >
                      <FolderOpen size={16} strokeWidth={2.5} />
                      Applications
                    </Link>
                    <Link
                      to="/resume-editor"
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                    >
                      <PenTool size={16} strokeWidth={2.5} />
                      Resume Edit
                    </Link>
                  </>
                )}
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                >
                  <User size={16} strokeWidth={2.5} />
                  Profile
                </Link>

                <div className="flex items-center ml-2 pl-4 border-l border-[var(--c-border)]">
                  <span className="text-[13px] font-bold text-[var(--c-text)]">
                    {user?.name}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--c-text-mute)] hover:text-[var(--c-error)] hover:bg-red-500/10 transition-colors ml-1"
                  title="Sign out"
                >
                  <LogOut size={16} strokeWidth={2.5} />
                </button>
              </>
            )}
            {!isAuthenticated && !loading && (
              <Link to="/login" className="btn-primary btn-small">
                Sign In
              </Link>
            )}
          </div>
        </nav>
      )}

      {/* Mobile Drawer Overlay — also hidden during proctored exams */}
      {!isProctoredExam && mobileMenuOpen && (
        <div
          className="fixed inset-x-0 top-[64px] bottom-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="flex flex-col h-full overflow-y-auto bg-[var(--c-surface)] border-b border-[var(--c-border)] shadow-xl p-4 gap-2 pb-8 max-h-[85vh] rounded-b-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[12px] font-black uppercase tracking-widest text-[var(--c-text-mute)] mb-2 mt-2 px-2">
              Menu
            </p>
            {isAuthenticated ? (
              <>
                <Link
                  to="/interview"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-bold text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors bg-[var(--c-surface-2)]/50"
                >
                  <Mic
                    size={20}
                    className="text-[var(--c-text-dim)]"
                    strokeWidth={2.5}
                  />
                  Interview
                </Link>
                <Link
                  to="/progress"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-bold text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors bg-[var(--c-surface-2)]/50"
                >
                  <TrendingUp
                    size={20}
                    className="text-[var(--c-text-dim)]"
                    strokeWidth={2.5}
                  />
                  Progress
                </Link>
                <Link
                  to="/resume-compare"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-bold text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors bg-[var(--c-surface-2)]/50"
                >
                  <FileText
                    size={20}
                    className="text-[var(--c-text-dim)]"
                    strokeWidth={2.5}
                  />
                  Resume Check
                </Link>
                <Link
                  to="/stats"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-bold text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors bg-[var(--c-surface-2)]/50"
                >
                  <BarChart2
                    size={20}
                    className="text-[var(--c-text-dim)]"
                    strokeWidth={2.5}
                  />
                  Stats
                </Link>
                <Link
                  to="/coach"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-bold text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors bg-[var(--c-surface-2)]/50"
                >
                  <MessageSquare
                    size={20}
                    className="text-[var(--c-text-dim)]"
                    strokeWidth={2.5}
                  />
                  Coach
                </Link>
                <Link
                  to="/study-plan"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-bold text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors bg-[var(--c-surface-2)]/50"
                >
                  <BookOpenCheck
                    size={20}
                    className="text-[var(--c-text-dim)]"
                    strokeWidth={2.5}
                  />
                  Study Plan
                </Link>
                <Link
                  to="/resume-editor"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-bold text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors bg-[var(--c-surface-2)]/50"
                >
                  <PenTool
                    size={20}
                    className="text-[var(--c-text-dim)]"
                    strokeWidth={2.5}
                  />
                  Resume Edit
                </Link>
                <div className="h-px bg-[var(--c-border)] my-2"></div>
                <Link
                  to="/profile"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-bold text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-colors"
                >
                  <User
                    size={20}
                    className="text-[var(--c-text-dim)]"
                    strokeWidth={2.5}
                  />
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-bold text-[#f87171] hover:bg-red-500/10 transition-colors w-full text-left"
                >
                  <LogOut size={20} strokeWidth={2.5} />
                  Sign out
                </button>
              </>
            ) : (
              !loading && (
                <Link to="/login" className="btn-primary mt-2">
                  Sign In
                </Link>
              )
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <main
        className={`flex-1 flex flex-col w-full relative z-10 ${
          isProctoredExam
            ? "overflow-hidden p-0 items-stretch min-h-0"
            : isFullScreenApp || isCoach
              ? "overflow-hidden p-0 items-stretch min-h-0 pt-[64px]"
              : "items-center px-4 md:px-8 pb-8 pt-[80px]"
        }`}
      >
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/interview" replace />
              ) : (
                <LoginPage />
              )
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? (
                <Navigate to="/interview" replace />
              ) : (
                <RegisterPage />
              )
            }
          />
          <Route
            path="/forgot-password"
            element={
              isAuthenticated ? (
                <Navigate to="/interview" replace />
              ) : (
                <ForgotPasswordPage />
              )
            }
          />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <ProgressDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resume-compare"
            element={
              <ProtectedRoute>
                <ResumeComparePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <StatsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/coach"
            element={
              <ProtectedRoute>
                <CoachChat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/study-plan"
            element={
              <ProtectedRoute>
                <StudyPlanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interview"
            element={
              <ProtectedRoute>
                <InterviewPage />
              </ProtectedRoute>
            }
          />
          {/* Candidate job routes */}
          <Route
            path="/jobs"
            element={
              <ProtectedRoute>
                <JobBrowserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-applications"
            element={
              <ProtectedRoute>
                <ApplicationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pipeline-interview"
            element={
              <ProtectedRoute>
                <PipelineInterviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mcq-test"
            element={
              <ProtectedRoute>
                <McqTestRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dsa-test"
            element={
              <ProtectedRoute>
                <DsaTestRoute />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platforms"
            element={
              <ProtectedRoute>
                <PlatformContextPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resume-editor"
            element={
              <ProtectedRoute>
                <ResumeEditorPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer — show only for logged-out/public routes */}
      {!isAuthenticated && !isFullScreenApp && !isCoach && (
        <footer className="flex items-center justify-center gap-2 mb-4 p-4 text-[11px] uppercase tracking-wider font-bold text-[var(--c-text-mute)] z-10 relative mt-auto border-t border-[var(--c-border)] backdrop-blur-sm bg-black/20">
          <span>Powered by</span>
          <span className="text-[var(--c-accent)] text-shadow-sm shadow-orange-500/20">
            Gemini Live API
          </span>
          <span className="opacity-50">•</span>
          <span>Node.js + React</span>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const { user, isAuthenticated, loading } = useAuth();

  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.05,
      wheelMultiplier: 1,
      prevent: (node) => {
        return (
          node.classList?.contains?.("overflow-y-auto") ||
          node.classList?.contains?.("overflow-auto") ||
          node.nodeName === "TEXTAREA"
        );
      },
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  // Landing page gets its own full-page layout (no app shell)
  if (location.pathname === "/") {
    return <LandingPage />;
  }

  // Login & Register pages get their own full-page split layout
  if (["/login", "/register"].includes(location.pathname)) {
    return (
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/interview" replace />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/interview" replace />
            ) : (
              <RegisterPage />
            )
          }
        />
      </Routes>
    );
  }

  // Public auth routes — no onboarding gate needed
  const publicPaths = ["/forgot-password", "/reset-password"];
  if (publicPaths.includes(location.pathname)) {
    return <AppShell />;
  }

  // Everything below requires auth — show spinner while loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--c-bg)]">
        <div className="bg-blob bg-blob--1" aria-hidden="true" />
        <div className="bg-blob bg-blob--2" aria-hidden="true" />
        <div className="spinner !w-8 !h-8 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ── Onboarding gates (render standalone, NO navbar) ──────────
  if (!user?.role) {
    return <RoleSelectionPage />;
  }

  if (!user?.profileComplete) {
    return user.role === "candidate" ? (
      <CandidateOnboarding />
    ) : (
      <RecruiterOnboarding />
    );
  }

  // ── Recruiter shell (separate layout) ────────────────────────
  if (user.role === "recruiter") {
    return <RecruiterShell />;
  }

  // ── Candidate: standard app shell with topnav ────────────────
  return <AppShell />;
}
