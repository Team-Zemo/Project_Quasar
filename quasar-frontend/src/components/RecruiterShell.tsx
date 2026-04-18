import { useState, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Briefcase,
  Plus,
  User,
  LogOut,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import { authState, type User as UserType } from "../lib/auth";
import { RecruiterDashboard } from "./recruiter/RecruiterDashboard";
import { JobPostingList } from "./recruiter/JobPostingList";
import { JobPostingForm } from "./recruiter/JobPostingForm";
import { JobPostingDetail } from "./recruiter/JobPostingDetail";
import { ProfilePage } from "./ProfilePage";
import { IdenticonAvatar } from "./ui/IdenticonAvatar";
import {
  RecruiterTour,
  TOUR_DUMMY_STATS,
  TOUR_DUMMY_JOBS,
} from "./recruiter/RecruiterTour";

type RecruiterView =
  | { type: "dashboard" }
  | { type: "jobs" }
  | { type: "create-job" }
  | { type: "job-detail"; id: string }
  | { type: "profile" };

/** Tailwind md = 768px */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < breakpoint,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

export function RecruiterShell() {
  const [user, setUser] = useState<UserType | null>(authState.getUser());
  const [view, setView] = useState<RecruiterView>({ type: "dashboard" });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    return authState.subscribe((snapshot) => setUser(snapshot.user));
  }, []);

  // Close mobile drawer on navigation
  const navigate = (v: RecruiterView) => {
    setView(v);
    if (isMobile) setMobileSidebarOpen(false);
  };

  const navItems = [
    {
      id: "dashboard" as const,
      label: "Dashboard",
      icon: LayoutDashboard,
      tourId: "tour-nav-dashboard",
    },
    {
      id: "jobs" as const,
      label: "Job Postings",
      icon: Briefcase,
      tourId: "tour-nav-jobs",
    },
    {
      id: "create-job" as const,
      label: "Create Job",
      icon: Plus,
      tourId: "tour-nav-create-job",
    },
    {
      id: "profile" as const,
      label: "Profile",
      icon: User,
      tourId: "tour-nav-profile",
    },
  ];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      authState.setUser(null);
    }
  };

  // Tours calls onNavigate with a view type string — map to proper RecruiterView
  const handleTourNavigate = (v: { type: string }) => {
    const type = v.type as RecruiterView["type"];
    if (
      type === "dashboard" ||
      type === "jobs" ||
      type === "create-job" ||
      type === "profile"
    ) {
      setView({ type });
    }
  };

  const renderContent = (): ReactNode => {
    switch (view.type) {
      case "dashboard":
        return (
          <RecruiterDashboard
            onNavigate={(v) => navigate(v as RecruiterView)}
            dummyStats={tourActive ? TOUR_DUMMY_STATS : undefined}
          />
        );
      case "jobs":
        return (
          <JobPostingList
            onViewJob={(id: string) => navigate({ type: "job-detail", id })}
            onCreateJob={() => navigate({ type: "create-job" })}
            dummyJobs={tourActive ? TOUR_DUMMY_JOBS : undefined}
          />
        );
      case "create-job":
        return (
          <JobPostingForm
            onComplete={(id: string) => navigate({ type: "job-detail", id })}
            onCancel={() => navigate({ type: "jobs" })}
          />
        );
      case "job-detail":
        return (
          <JobPostingDetail
            jobId={view.id}
            onBack={() => navigate({ type: "jobs" })}
          />
        );
      case "profile":
        return <ProfilePage />;
      default:
        return null;
    }
  };

  /* ── Sidebar content (shared between desktop & mobile drawer) ─── */
  const sidebarContent = (isDrawer: boolean) => {
    const expanded = isDrawer ? true : sidebarOpen;
    const handleLogoClick = () => {
      if (!isDrawer && !sidebarOpen) {
        setSidebarOpen(true);
      }
    };

    return (
      <>
        {/* Brand header */}
        <div className="flex items-center gap-3 p-5 border-b border-[var(--c-border)]">
          <button
            type="button"
            onClick={handleLogoClick}
            aria-label="Open sidebar"
            className={`w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--c-accent)] to-[#fb923c] p-1.5 shrink-0 ${
              !isDrawer && !expanded ? "cursor-pointer" : "cursor-default"
            }`}
          >
            <img
              src="/Quasar_transparent.svg"
              alt="Quasar logo"
              className="w-full h-full object-contain"
            />
          </button>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p className="text-[14px] font-bold text-[var(--c-text)]">
                  Quasar Recruit
                </p>
                <p className="text-[11px] text-[var(--c-text-mute)]">
                  {user?.company || "Recruiter"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Desktop: collapse toggle | Mobile drawer: close */}
          {isDrawer ? (
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className="ml-auto p-1.5 rounded-lg hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors"
            >
              <X size={18} />
            </button>
          ) : expanded ? (
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="ml-auto p-1.5 rounded-lg hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          ) : null}
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = view.type === item.id;
            return (
              <button
                key={item.id}
                id={item.tourId}
                onClick={() => navigate({ type: item.id })}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  isActive
                    ? "bg-[var(--c-accent-dim)] text-[var(--c-accent)] font-semibold"
                    : "text-[var(--c-text-dim)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text)]"
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="flex-shrink-0"
                />
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-[13px] overflow-hidden whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {/* User footer */}
        <div
          id="tour-user-footer"
          className="p-3 border-t border-[var(--c-border)]"
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <IdenticonAvatar
              seed={`${user?.email || ""}:${user?.name || "recruiter"}`}
              size={32}
              className="rounded-full flex-shrink-0"
            />
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-1 overflow-hidden"
                >
                  <p className="text-[12px] font-semibold text-[var(--c-text)] truncate">
                    {user?.name}
                  </p>
                  <p className="text-[11px] text-[var(--c-text-mute)] truncate">
                    {user?.email}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            {expanded && (
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-[var(--c-error-dim)] text-[var(--c-text-mute)] hover:text-[var(--c-error)] transition-colors flex-shrink-0"
                title="Logout"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-[var(--c-bg)]">
      {/* ── Mobile top bar ──────────────────────────────────────────── */}
      {isMobile && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[var(--c-surface)] border-b border-[var(--c-border)] flex-shrink-0 z-30">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 -ml-1 rounded-xl hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--c-accent)] to-[#fb923c] p-1.5 shrink-0">
            <img
              src="/Quasar_transparent.svg"
              alt="Quasar logo"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-[14px] font-bold text-[var(--c-text)]">
            Quasar Recruit
          </p>
        </div>
      )}

      {/* ── Mobile drawer overlay ──────────────────────────────────── */}
      <AnimatePresence>
        {isMobile && mobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 z-40"
            />
            {/* Drawer */}
            <motion.aside
              key="sidebar-drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-[280px] flex flex-col bg-[var(--c-surface)] border-r border-[var(--c-border)] z-50"
            >
              {sidebarContent(true)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop sidebar ────────────────────────────────────────── */}
      {!isMobile && (
        <motion.aside
          id="tour-sidebar"
          initial={false}
          animate={{ width: sidebarOpen ? 260 : 72 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="relative flex flex-col bg-[var(--c-surface)] border-r border-[var(--c-border)] z-20 flex-shrink-0"
        >
          {sidebarContent(false)}
        </motion.aside>
      )}

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={view.type + (view.type === "job-detail" ? view.id : "")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Tour ───────────────────────────────────────────────────── */}
      <RecruiterTour
        onNavigate={handleTourNavigate}
        onTourActiveChange={setTourActive}
      />
    </div>
  );
}
