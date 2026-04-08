import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Users, CheckCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react';
import { apiGet } from '../../lib/api';
import type { DashboardStats } from '../../types/recruitment';

interface Props {
  onNavigate: (view: { type: string; id?: string }) => void;
}

export function RecruiterDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DashboardStats>('/api/recruiter/dashboard/stats')
      .then(res => { if (res.success) setStats(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statCards = stats ? [
    { label: 'Active Postings', value: stats.activePostings, icon: Briefcase, color: 'var(--c-accent)', bg: 'var(--c-accent-dim)' },
    { label: 'Total Applicants', value: stats.totalApplicants, icon: Users, color: 'var(--c-user)', bg: 'var(--c-user-dim)' },
    { label: 'Selected', value: stats.selectedCandidates, icon: CheckCircle, color: 'var(--c-success)', bg: 'var(--c-success-dim)' },
    { label: 'This Week', value: stats.recentApplications, icon: TrendingUp, color: 'var(--c-purple)', bg: 'var(--c-purple-dim)' },
  ] : [];

  const funnelStages = stats?.pipelineFunnel ? [
    { label: 'Applied', count: (stats.pipelineFunnel['applied'] || 0) + (stats.pipelineFunnel['screening'] || 0) + (stats.pipelineFunnel['screening_passed'] || 0) },
    { label: 'MCQ', count: (stats.pipelineFunnel['mcq_pending'] || 0) + (stats.pipelineFunnel['mcq_in_progress'] || 0) + (stats.pipelineFunnel['mcq_passed'] || 0) },
    { label: 'Tech', count: (stats.pipelineFunnel['tech_pending'] || 0) + (stats.pipelineFunnel['tech_in_progress'] || 0) + (stats.pipelineFunnel['tech_passed'] || 0) },
    { label: 'HR', count: (stats.pipelineFunnel['hr_pending'] || 0) + (stats.pipelineFunnel['hr_in_progress'] || 0) + (stats.pipelineFunnel['hr_passed'] || 0) },
    { label: 'Selected', count: stats.pipelineFunnel['selected'] || 0 },
  ] : [];

  const maxFunnel = Math.max(...funnelStages.map(s => s.count), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner !w-8 !h-8 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--c-text)] tracking-tight">Dashboard</h1>
        <p className="text-[var(--c-text-dim)] text-[14px] mt-1">Your recruitment pipeline at a glance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: card.bg }}>
                  <Icon size={20} style={{ color: card.color }} />
                </div>
              </div>
              <p className="text-3xl font-black text-[var(--c-text)]">{card.value}</p>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--c-text-mute)] mt-1">{card.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Pipeline Funnel */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 mb-8"
      >
        <h2 className="text-[15px] font-bold text-[var(--c-text)] mb-5">Pipeline Funnel</h2>
        <div className="space-y-3">
          {funnelStages.map((stage) => (
            <div key={stage.label} className="flex items-center gap-4">
              <span className="w-16 text-[12px] font-semibold text-[var(--c-text-dim)] text-right">{stage.label}</span>
              <div className="flex-1 h-8 bg-[var(--c-surface-2)] rounded-lg overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(stage.count / maxFunnel) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[var(--c-accent)] to-[#fb923c] rounded-lg flex items-center justify-end pr-3"
                  style={{ minWidth: stage.count > 0 ? '40px' : '0' }}
                >
                  {stage.count > 0 && (
                    <span className="text-[11px] font-bold text-black">{stage.count}</span>
                  )}
                </motion.div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => onNavigate({ type: 'create-job' })}
          className="flex items-center gap-4 p-5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl hover:border-[var(--c-accent)]/30 hover:bg-[var(--c-accent-dim)] transition-all group text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--c-accent-dim)] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Briefcase size={22} className="text-[var(--c-accent)]" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-[var(--c-text)]">Create New Job Posting</p>
            <p className="text-[12px] text-[var(--c-text-mute)]">Set up a new hiring pipeline</p>
          </div>
          <ArrowRight size={16} className="text-[var(--c-text-mute)] group-hover:text-[var(--c-accent)] transition-colors" />
        </motion.button>

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          onClick={() => onNavigate({ type: 'jobs' })}
          className="flex items-center gap-4 p-5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl hover:border-[var(--c-user-border)] hover:bg-[var(--c-user-dim)] transition-all group text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--c-user-dim)] flex items-center justify-center group-hover:scale-105 transition-transform">
            <Users size={22} className="text-[var(--c-user)]" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-[var(--c-text)]">View All Postings</p>
            <p className="text-[12px] text-[var(--c-text-mute)]">Manage applicants & pipeline</p>
          </div>
          <ArrowRight size={16} className="text-[var(--c-text-mute)] group-hover:text-[var(--c-user)] transition-colors" />
        </motion.button>
      </div>
    </div>
  );
}
