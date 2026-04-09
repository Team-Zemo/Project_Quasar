import { useState, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Briefcase, Plus, Users, Settings, LogOut,
  ChevronLeft, Menu,
} from 'lucide-react';
import { authState, type User } from '../lib/auth';
import { RecruiterDashboard } from './recruiter/RecruiterDashboard';
import { JobPostingList } from './recruiter/JobPostingList';
import { JobPostingForm } from './recruiter/JobPostingForm';
import { JobPostingDetail } from './recruiter/JobPostingDetail';

type RecruiterView =
  | { type: 'dashboard' }
  | { type: 'jobs' }
  | { type: 'create-job' }
  | { type: 'job-detail'; id: string }
  | { type: 'settings' };

export function RecruiterShell() {
  const [user, setUser] = useState<User | null>(authState.getUser());
  const [view, setView] = useState<RecruiterView>({ type: 'dashboard' });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    return authState.subscribe((snapshot) => setUser(snapshot.user));
  }, []);

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'jobs' as const, label: 'Job Postings', icon: Briefcase },
    { id: 'create-job' as const, label: 'Create Job', icon: Plus },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      authState.setUser(null);
    }
  };

  const renderContent = (): ReactNode => {
    switch (view.type) {
      case 'dashboard':
        return <RecruiterDashboard onNavigate={(v: RecruiterView) => setView(v)} />;
      case 'jobs':
        return <JobPostingList onViewJob={(id: string) => setView({ type: 'job-detail', id })} onCreateJob={() => setView({ type: 'create-job' })} />;
      case 'create-job':
        return <JobPostingForm onComplete={(id: string) => setView({ type: 'job-detail', id })} onCancel={() => setView({ type: 'jobs' })} />;
      case 'job-detail':
        return <JobPostingDetail jobId={view.id} onBack={() => setView({ type: 'jobs' })} />;
      case 'settings':
        return <div className="p-8 text-[var(--c-text-dim)]">Settings page coming soon</div>;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--c-bg)]">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 72 }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="relative flex flex-col bg-[var(--c-surface)] border-r border-[var(--c-border)] z-20 flex-shrink-0"
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-[var(--c-border)]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--c-accent)] to-[#fb923c] flex items-center justify-center text-white font-black text-sm flex-shrink-0">
            Q
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <p className="text-[14px] font-bold text-[var(--c-text)]">Quasar Recruit</p>
                <p className="text-[11px] text-[var(--c-text-mute)]">{user?.company || 'Recruiter'}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="ml-auto p-1.5 rounded-lg hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors"
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = view.type === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView({ type: item.id })}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                  isActive
                    ? 'bg-[var(--c-accent-dim)] text-[var(--c-accent)] font-semibold'
                    : 'text-[var(--c-text-dim)] hover:bg-[var(--c-surface-2)] hover:text-[var(--c-text)]'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="flex-shrink-0" />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
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
        <div className="p-3 border-t border-[var(--c-border)]">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-[var(--c-surface-3)] flex items-center justify-center text-[var(--c-text-dim)] text-[11px] font-bold flex-shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'R'}
            </div>
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-1 overflow-hidden"
                >
                  <p className="text-[12px] font-semibold text-[var(--c-text)] truncate">{user?.name}</p>
                  <p className="text-[11px] text-[var(--c-text-mute)] truncate">{user?.email}</p>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-[var(--c-error-dim)] text-[var(--c-text-mute)] hover:text-[var(--c-error)] transition-colors flex-shrink-0"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={view.type + (view.type === 'job-detail' ? view.id : '')}
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
    </div>
  );
}
