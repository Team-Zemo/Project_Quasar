import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, CheckCircle, XCircle, ArrowUpCircle,
  ArrowDownCircle, Shield, Clock, Target, Scale,
  ChevronDown, AlertOctagon, UserCheck,
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';

interface EscalationEvent {
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
  onResolved?: () => void;
}

const reasonIcons: Record<string, typeof AlertTriangle> = {
  escalation_threshold: Scale,
  escalation_proctor: Shield,
  escalation_confidence: AlertTriangle,
  escalation_target_reached: Target,
  escalation_deadline: Clock,
};

const reasonLabels: Record<string, string> = {
  escalation_threshold: 'Borderline Score',
  escalation_proctor: 'Proctoring Violation',
  escalation_confidence: 'Low AI Confidence',
  escalation_target_reached: 'Finalist Target Reached',
  escalation_deadline: 'Deadline Approaching',
};

export function EscalationPanel({ jobId, refreshTrigger, onResolved }: Props) {
  const [escalations, setEscalations] = useState<EscalationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEscalations = useCallback(async () => {
    try {
      const res = await apiGet<{ escalations: EscalationEvent[]; total: number }>(
        `/api/recruiter/agent/${jobId}/events/escalations`
      );
      if (res.success) {
        setEscalations(res.data.escalations);
      }
    } catch { /* empty */ }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchEscalations(); }, [fetchEscalations, refreshTrigger]);

  const handleResolve = async (eventId: string, action: 'advance' | 'reject') => {
    setActioning(eventId);
    try {
      const res = await apiPost(
        `/api/recruiter/agent/${jobId}/events/${eventId}/resolve`,
        { action }
      );
      if (res.success) {
        setEscalations(prev => prev.filter(e => e._id !== eventId));
        onResolved?.();
      }
    } catch { /* empty */ }
    setActioning(null);
  };

  if (loading) {
    return (
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 flex justify-center">
        <div className="spinner !w-6 !h-6 !border-[var(--c-accent)] !border-t-transparent" />
      </div>
    );
  }

  if (escalations.length === 0) {
    return (
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-8 text-center">
        <CheckCircle size={40} className="mx-auto text-[var(--c-success)] mb-3 opacity-50" />
        <p className="text-[13px] font-semibold text-[var(--c-text)]">No pending escalations</p>
        <p className="text-[11px] text-[var(--c-text-mute)] mt-1">All items have been reviewed</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--c-border)]">
        <h3 className="text-[14px] font-bold text-[var(--c-text)] flex items-center gap-2">
          <AlertOctagon size={16} className="text-[var(--c-error)]" />
          Pending Escalations
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--c-error-dim)] text-[var(--c-error)]">
            {escalations.length}
          </span>
        </h3>
      </div>

      <div className="divide-y divide-[var(--c-border)]">
        {escalations.map((esc, i) => {
          const Icon = reasonIcons[esc.eventType] || AlertTriangle;
          const label = reasonLabels[esc.eventType] || esc.eventType;
          const isExpanded = expandedId === esc._id;
          const isActioning = actioning === esc._id;
          const details = esc.details as {
            score?: number;
            threshold?: number;
            message?: string;
            margin?: number | string;
            currentFinalists?: number;
            targetFinalists?: number;
          };

          return (
            <motion.div
              key={esc._id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`${esc.severity === 'critical' ? 'bg-[var(--c-error-dim)]/20' : ''}`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: esc.severity === 'critical' ? 'var(--c-error-dim)' : 'var(--c-accent-dim)',
                    }}
                  >
                    <Icon
                      size={18}
                      style={{ color: esc.severity === 'critical' ? 'var(--c-error)' : 'var(--c-accent)' }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-bold text-[var(--c-text)]">{label}</p>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        esc.severity === 'critical'
                          ? 'bg-[var(--c-error-dim)] text-[var(--c-error)]'
                          : 'bg-[var(--c-accent-dim)] text-[var(--c-accent)]'
                      }`}>
                        {esc.severity}
                      </span>
                    </div>

                    {esc.candidateName && (
                      <p className="text-[12px] text-[var(--c-text-dim)] mt-0.5 flex items-center gap-1">
                        <UserCheck size={11} />
                        {esc.candidateName}
                        {esc.candidateEmail && (
                          <span className="text-[var(--c-text-mute)]">• {esc.candidateEmail}</span>
                        )}
                      </p>
                    )}

                    {details.message && (
                      <p className="text-[11px] text-[var(--c-text-mute)] mt-1">{details.message}</p>
                    )}

                    {/* Score display */}
                    {details.score != null && (
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[var(--c-text-mute)]">Score:</span>
                          <span className="text-[14px] font-black text-[var(--c-accent)]">
                            {details.score}{(details.threshold ?? 0) <= 10 ? '/10' : '%'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[var(--c-text-mute)]">Threshold:</span>
                          <span className="text-[14px] font-black text-[var(--c-text-dim)]">
                            {details.threshold}{(details.threshold ?? 0) <= 10 ? '/10' : '%'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Expandable details */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : esc._id)}
                      className="text-[10px] text-[var(--c-text-mute)] hover:text-[var(--c-accent)] mt-2 flex items-center gap-1 transition-colors"
                    >
                      <ChevronDown size={10} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      {isExpanded ? 'Hide' : 'Show'} details
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="bg-[var(--c-surface-2)] rounded-lg p-3 mt-2">
                            <pre className="whitespace-pre-wrap break-words font-mono text-[10px] text-[var(--c-text-dim)]">
                              {JSON.stringify(esc.details, null, 2)}
                            </pre>
                            <p className="text-[9px] text-[var(--c-text-mute)] mt-2">
                              Event: {esc._id} • {new Date(esc.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Action buttons */}
                  {esc.applicationId && (
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleResolve(esc._id, 'advance')}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold bg-[var(--c-success-dim)] text-[var(--c-success)] hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
                        title="Advance candidate"
                      >
                        {isActioning ? (
                          <div className="spinner !w-3 !h-3 !border-[var(--c-success)] !border-t-transparent" />
                        ) : (
                          <ArrowUpCircle size={12} />
                        )}
                        Advance
                      </button>
                      <button
                        onClick={() => handleResolve(esc._id, 'reject')}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold bg-[var(--c-error-dim)] text-[var(--c-error)] hover:brightness-110 transition-all active:scale-95 disabled:opacity-50"
                        title="Reject candidate"
                      >
                        {isActioning ? (
                          <div className="spinner !w-3 !h-3 !border-[var(--c-error)] !border-t-transparent" />
                        ) : (
                          <ArrowDownCircle size={12} />
                        )}
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-[var(--c-text-mute)] mt-2 ml-[52px]">
                  {new Date(esc.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Kolkata',
                  })}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
