import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, ArrowUpCircle, ArrowDownCircle, AlertTriangle,
  Mail, CheckCircle, XCircle, Clock, Shield,
  ChevronDown, ChevronUp, RefreshCw, Activity,
} from 'lucide-react';
import { apiGet } from '../../lib/api';

interface AgentEventItem {
  _id: string;
  applicationId: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  eventType: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  details: Record<string, unknown>;
  resolved: boolean;
  resolution: string | null;
  createdAt: string;
}

interface Props {
  jobId: string;
  refreshTrigger?: number;
}

const eventIcons: Record<string, typeof Bot> = {
  screening_auto_advanced: ArrowUpCircle,
  screening_auto_rejected: ArrowDownCircle,
  mcq_invitation_sent: Mail,
  mcq_auto_advanced: ArrowUpCircle,
  mcq_auto_rejected: ArrowDownCircle,
  tech_invitation_sent: Mail,
  tech_auto_advanced: ArrowUpCircle,
  tech_auto_rejected: ArrowDownCircle,
  hr_invitation_sent: Mail,
  hr_auto_advanced: ArrowUpCircle,
  hr_auto_rejected: ArrowDownCircle,
  escalation_threshold: AlertTriangle,
  escalation_proctor: Shield,
  escalation_confidence: AlertTriangle,
  escalation_target_reached: CheckCircle,
  escalation_deadline: Clock,
  recruiter_resolved: CheckCircle,
  agent_started: Bot,
  agent_paused: Clock,
  agent_resumed: Bot,
  agent_completed: CheckCircle,
  digest_sent: Mail,
};

const severityStyles: Record<string, { color: string; bg: string; border: string }> = {
  info: { color: 'var(--c-text-dim)', bg: 'var(--c-surface-2)', border: 'var(--c-border)' },
  success: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', border: 'var(--c-success)' },
  warning: { color: 'var(--c-accent)', bg: 'var(--c-accent-dim)', border: 'var(--c-accent)' },
  critical: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', border: 'var(--c-error)' },
};

function formatEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    screening_auto_advanced: 'Screening Passed → Advanced',
    screening_auto_rejected: 'Screening Failed → Rejected',
    mcq_invitation_sent: 'MCQ Invitation Sent',
    mcq_auto_advanced: 'MCQ Passed → Advanced',
    mcq_auto_rejected: 'MCQ Failed → Rejected',
    tech_invitation_sent: 'Tech Interview Invitation Sent',
    tech_auto_advanced: 'Tech Interview Passed → Advanced',
    tech_auto_rejected: 'Tech Interview Failed → Rejected',
    hr_invitation_sent: 'HR Interview Invitation Sent',
    hr_auto_advanced: 'HR Interview Passed → Advanced',
    hr_auto_rejected: 'HR Interview Failed → Rejected',
    escalation_threshold: '⚖️ Borderline Score Escalation',
    escalation_proctor: '🚩 Proctoring Violation Escalation',
    escalation_confidence: '🤔 Low AI Confidence Escalation',
    escalation_target_reached: '🎯 Finalist Target Reached',
    escalation_deadline: '⏰ Deadline Alert',
    recruiter_resolved: 'Escalation Resolved by Recruiter',
    agent_started: '🤖 Agent Activated',
    agent_paused: '⏸ Agent Paused',
    agent_resumed: '▶ Agent Resumed',
    agent_completed: '✅ Agent Completed',
    digest_sent: '📊 Daily Digest Sent',
  };
  return labels[eventType] || eventType;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function AgentActivityFeed({ jobId, refreshTrigger }: Props) {
  const [events, setEvents] = useState<AgentEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const fetchEvents = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      const res = await apiGet<{
        events: AgentEventItem[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/api/recruiter/agent/${jobId}/events?page=${pageNum}&limit=20`);
      if (res.success) {
        setEvents(res.data.events);
        setPage(res.data.page);
        setTotalPages(res.data.totalPages);
      }
    } catch { /* empty */ }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents, refreshTrigger]);

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--c-border)]">
        <h3 className="text-[14px] font-bold text-[var(--c-text)] flex items-center gap-2">
          <Activity size={16} className="text-[var(--c-accent)]" />
          Agent Activity Feed
        </h3>
        <button
          onClick={() => fetchEvents(1)}
          className="p-2 rounded-lg hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-accent)] transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {events.length === 0 && !loading && (
        <div className="py-12 text-center">
          <Bot size={40} className="mx-auto text-[var(--c-text-mute)] mb-3 opacity-40" />
          <p className="text-[13px] text-[var(--c-text-mute)]">No agent activity yet</p>
          <p className="text-[11px] text-[var(--c-text-mute)] mt-1">Start the agent to see decisions here</p>
        </div>
      )}

      {loading && events.length === 0 && (
        <div className="py-12 flex justify-center">
          <div className="spinner !w-6 !h-6 !border-[var(--c-accent)] !border-t-transparent" />
        </div>
      )}

      <div className="divide-y divide-[var(--c-border)]">
        {events.map((event, i) => {
          const sv = severityStyles[event.severity] || severityStyles.info;
          const Icon = eventIcons[event.eventType] || Bot;
          const isExpanded = expandedEvent === event._id;
          const details = event.details || {};

          return (
            <motion.div
              key={event._id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="hover:bg-[var(--c-surface-2)] transition-colors"
            >
              <button
                onClick={() => setExpandedEvent(isExpanded ? null : event._id)}
                className="w-full flex items-start gap-3 p-4 text-left"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: sv.bg }}
                >
                  <Icon size={14} style={{ color: sv.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--c-text)]">
                    {formatEventLabel(event.eventType)}
                  </p>
                  {event.candidateName && (
                    <p className="text-[11px] text-[var(--c-text-mute)] mt-0.5">
                      {event.candidateName}
                      {event.candidateEmail && ` • ${event.candidateEmail}`}
                    </p>
                  )}
                  {(details as { message?: string }).message && (
                    <p className="text-[11px] text-[var(--c-text-dim)] mt-0.5 line-clamp-1">
                      {(details as { message: string }).message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {event.eventType.startsWith('escalation_') && (
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${event.resolved ? 'bg-[var(--c-success-dim)] text-[var(--c-success)]' : 'bg-[var(--c-error-dim)] text-[var(--c-error)]'}`}>
                      {event.resolved ? 'Resolved' : 'Pending'}
                    </span>
                  )}
                  <span className="text-[10px] text-[var(--c-text-mute)] whitespace-nowrap">{timeAgo(event.createdAt)}</span>
                  <ChevronDown size={12} className={`text-[var(--c-text-mute)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 ml-11">
                      <div className="bg-[var(--c-surface-2)] rounded-xl p-3 text-[11px] text-[var(--c-text-dim)]">
                        <pre className="whitespace-pre-wrap break-words font-mono text-[10px]">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-[var(--c-border)] text-[10px] text-[var(--c-text-mute)]">
                          <span>ID: {event._id}</span>
                          <span>{new Date(event.createdAt).toLocaleString()}</span>
                          {event.resolved && event.resolution && (
                            <span className="text-[var(--c-success)]">Resolution: {event.resolution}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--c-border)]">
          <button
            onClick={() => fetchEvents(page - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--c-text-mute)] hover:bg-[var(--c-surface-2)] disabled:opacity-30 transition-colors"
          >
            <ChevronUp size={12} className="inline mr-1 rotate-[-90deg]" /> Prev
          </button>
          <span className="text-[11px] text-[var(--c-text-mute)]">Page {page} of {totalPages}</span>
          <button
            onClick={() => fetchEvents(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--c-text-mute)] hover:bg-[var(--c-surface-2)] disabled:opacity-30 transition-colors"
          >
            Next <ChevronDown size={12} className="inline ml-1 rotate-[-90deg]" />
          </button>
        </div>
      )}
    </div>
  );
}
