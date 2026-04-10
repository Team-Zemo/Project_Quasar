import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, ArrowUpCircle, ArrowDownCircle, AlertTriangle,
  Target, Clock, ArrowRight,
} from 'lucide-react';
import { apiGet } from '../../lib/api';

interface AgentStatsData {
  stats?: {
    totalProcessed: number;
    totalAdvanced: number;
    totalRejected: number;
    totalEscalated: number;
    currentFinalists: number;
  };
  status?: string;
  enabled?: boolean;
  targetFinalists?: number;
  pendingEscalations: number;
  todayEvents: number;
}

interface AgentJobSummary {
  jobId: string;
  jobTitle: string;
  company: string;
  stats: AgentStatsData;
}

interface Props {
  onNavigate: (view: { type: string; id?: string }) => void;
}

export function AgentStatsCard({ onNavigate }: Props) {
  const [agents, setAgents] = useState<AgentJobSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all published jobs and check each for agent config
    async function load() {
      try {
        const jobsRes = await apiGet<{ jobs: Array<{ _id: string; title: string; company: string; agentEnabled?: boolean }> }>('/api/recruiter/jobs');
        if (!jobsRes.success) return;

        const agentJobs = (jobsRes.data.jobs || jobsRes.data as unknown as Array<{ _id: string; title: string; company: string; agentEnabled?: boolean }>)
          .filter(j => j.agentEnabled);

        const summaries: AgentJobSummary[] = [];

        for (const job of agentJobs.slice(0, 5)) {
          try {
            const statsRes = await apiGet<AgentStatsData>(`/api/recruiter/agent/${job._id}/stats`);
            if (statsRes.success && statsRes.data) {
              summaries.push({
                jobId: job._id,
                jobTitle: job.title,
                company: job.company,
                stats: statsRes.data,
              });
            }
          } catch { /* skip */ }
        }

        setAgents(summaries);
      } catch { /* empty */ }
      setLoading(false);
    }

    load();
  }, []);

  if (loading) return null;
  if (agents.length === 0) return null;

  // Aggregate totals
  const totalProcessed = agents.reduce((s, a) => s + (a.stats.stats?.totalProcessed || 0), 0);
  const totalAdvanced = agents.reduce((s, a) => s + (a.stats.stats?.totalAdvanced || 0), 0);
  const totalEscalations = agents.reduce((s, a) => s + (a.stats.pendingEscalations || 0), 0);
  const finalistProgress = agents.map(a => ({
    current: a.stats.stats?.currentFinalists || 0,
    target: a.stats.targetFinalists || 5,
  }));
  const totalFinalists = finalistProgress.reduce((s, f) => s + f.current, 0);
  const totalTarget = finalistProgress.reduce((s, f) => s + f.target, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8"
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[15px] font-bold text-[var(--c-text)] flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--c-accent-dim), var(--c-purple-dim))' }}
          >
            <Bot size={16} className="text-[var(--c-accent)]" />
          </div>
          AI Agent Status
        </h2>
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--c-success-dim)] text-[var(--c-success)]">
          {agents.length} active
        </span>
      </div>

      {/* Aggregate stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Processed', value: totalProcessed, Icon: Bot, color: 'var(--c-text-dim)' },
          { label: 'Advanced', value: totalAdvanced, Icon: ArrowUpCircle, color: 'var(--c-success)' },
          { label: 'Finalists', value: `${totalFinalists}/${totalTarget}`, Icon: Target, color: 'var(--c-purple)' },
          { label: 'Escalations', value: totalEscalations, Icon: AlertTriangle, color: totalEscalations > 0 ? 'var(--c-error)' : 'var(--c-text-mute)' },
        ].map(item => (
          <div key={item.label} className="bg-[var(--c-surface-2)] rounded-xl p-3 text-center">
            <item.Icon size={14} className="mx-auto mb-1.5 opacity-60" style={{ color: item.color }} />
            <p className="text-lg font-black" style={{ color: item.color }}>{item.value}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c-text-mute)]">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Per-job breakdown */}
      <div className="space-y-2">
        {agents.map(agent => {
          const pending = agent.stats.pendingEscalations || 0;
          return (
            <button
              key={agent.jobId}
              onClick={() => onNavigate({ type: 'job-detail', id: agent.jobId })}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--c-surface-2)] rounded-xl hover:bg-[var(--c-surface-3)] transition-colors text-left group"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: agent.stats.status === 'running'
                    ? 'var(--c-success)'
                    : agent.stats.status === 'paused'
                    ? 'var(--c-accent)'
                    : 'var(--c-text-mute)',
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[var(--c-text)] truncate">{agent.jobTitle}</p>
                <p className="text-[10px] text-[var(--c-text-mute)]">
                  {agent.stats.stats?.currentFinalists || 0}/{agent.stats.targetFinalists || 5} finalists
                  {pending > 0 && (
                    <span className="ml-2 text-[var(--c-error)] font-bold">• {pending} pending</span>
                  )}
                </p>
              </div>
              <ArrowRight size={14} className="text-[var(--c-text-mute)] group-hover:text-[var(--c-accent)] transition-colors" />
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
