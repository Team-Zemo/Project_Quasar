import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Play, Pause, Square, Target, Calendar,
  Shield, Scale, AlertTriangle, Mail, ChevronDown,
  Save, CheckCircle, X, Settings2, Zap,
} from 'lucide-react';
import { apiGet, apiPut, apiPost } from '../../lib/api';

interface AgentConfig {
  _id?: string;
  jobPostingId: string;
  enabled: boolean;
  status: 'idle' | 'running' | 'paused' | 'completed';
  targetFinalists: number;
  deadline: string | null;
  screeningThreshold: number | null;
  mcqThreshold: number | null;
  techThreshold: number | null;
  hrThreshold: number | null;
  escalation: {
    thresholdMarginPercent: number;
    onProctoringFlag: boolean;
    onLowAiConfidence: boolean;
    onTargetReached: boolean;
  };
  autoAdvanceScreening: boolean;
  autoAdvanceMcq: boolean;
  autoAdvanceTech: boolean;
  autoAdvanceHr: boolean;
  sendCandidateEmails: boolean;
  stats: {
    totalProcessed: number;
    totalAdvanced: number;
    totalRejected: number;
    totalEscalated: number;
    currentFinalists: number;
  };
}

interface Props {
  jobId: string;
  onStatusChange?: () => void;
}

const statusInfo: Record<string, { label: string; color: string; bg: string; icon: typeof Play }> = {
  idle: { label: 'Idle', color: 'var(--c-text-mute)', bg: 'var(--c-surface-3)', icon: Settings2 },
  running: { label: 'Running', color: 'var(--c-success)', bg: 'var(--c-success-dim)', icon: Play },
  paused: { label: 'Paused', color: 'var(--c-accent)', bg: 'var(--c-accent-dim)', icon: Pause },
  completed: { label: 'Completed', color: 'var(--c-purple)', bg: 'var(--c-purple-dim)', icon: Square },
};

const defaultConfig: Omit<AgentConfig, '_id' | 'jobPostingId'> = {
  enabled: false,
  status: 'idle',
  targetFinalists: 5,
  deadline: null,
  screeningThreshold: 70,
  mcqThreshold: 60,
  techThreshold: 6,
  hrThreshold: 6,
  escalation: {
    thresholdMarginPercent: 5,
    onProctoringFlag: true,
    onLowAiConfidence: true,
    onTargetReached: true,
  },
  autoAdvanceScreening: true,
  autoAdvanceMcq: true,
  autoAdvanceTech: true,
  autoAdvanceHr: true,
  sendCandidateEmails: true,
  stats: {
    totalProcessed: 0,
    totalAdvanced: 0,
    totalRejected: 0,
    totalEscalated: 0,
    currentFinalists: 0,
  },
};

export function AgentConfigPanel({ jobId, onStatusChange }: Props) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [draft, setDraft] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await apiGet<AgentConfig>(`/api/recruiter/agent/${jobId}/config`);
      if (res.success && res.data) {
        setConfig(res.data);
        setDraft({
          enabled: res.data.enabled,
          status: res.data.status,
          targetFinalists: res.data.targetFinalists ?? 5,
          deadline: res.data.deadline,
          screeningThreshold: res.data.screeningThreshold ?? 70,
          mcqThreshold: res.data.mcqThreshold ?? 60,
          techThreshold: res.data.techThreshold ?? 6,
          hrThreshold: res.data.hrThreshold ?? 6,
          escalation: res.data.escalation || defaultConfig.escalation,
          autoAdvanceScreening: res.data.autoAdvanceScreening ?? true,
          autoAdvanceMcq: res.data.autoAdvanceMcq ?? true,
          autoAdvanceTech: res.data.autoAdvanceTech ?? true,
          autoAdvanceHr: res.data.autoAdvanceHr ?? true,
          sendCandidateEmails: res.data.sendCandidateEmails ?? true,
          stats: res.data.stats || defaultConfig.stats,
        });
      }
    } catch { /* empty */ }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiPut<AgentConfig>(`/api/recruiter/agent/${jobId}/config`, {
        targetFinalists: draft.targetFinalists,
        deadline: draft.deadline,
        screeningThreshold: draft.screeningThreshold,
        mcqThreshold: draft.mcqThreshold,
        techThreshold: draft.techThreshold,
        hrThreshold: draft.hrThreshold,
        escalation: draft.escalation,
        autoAdvanceScreening: draft.autoAdvanceScreening,
        autoAdvanceMcq: draft.autoAdvanceMcq,
        autoAdvanceTech: draft.autoAdvanceTech,
        autoAdvanceHr: draft.autoAdvanceHr,
        sendCandidateEmails: draft.sendCandidateEmails,
      });
      if (res.success) {
        setConfig(res.data);
      }
    } catch { /* empty */ }
    setSaving(false);
  };

  const handleAction = async (action: 'start' | 'pause' | 'stop') => {
    setActionLoading(true);
    try {
      // Save config first, then execute action
      await handleSave();
      const res = await apiPost<AgentConfig>(`/api/recruiter/agent/${jobId}/${action}`, {});
      if (res.success) {
        setConfig(res.data);
        setDraft(prev => ({ ...prev, enabled: res.data.enabled, status: res.data.status }));
        onStatusChange?.();
      }
    } catch { /* empty */ }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 flex items-center justify-center">
        <div className="spinner !w-6 !h-6 !border-[var(--c-accent)] !border-t-transparent" />
      </div>
    );
  }

  const st = statusInfo[config?.status || 'idle'];
  const StatusIcon = st.icon;
  const isRunning = config?.status === 'running';
  const isPaused = config?.status === 'paused';

  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--c-surface-2)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--c-accent-dim), var(--c-purple-dim))' }}>
            <Bot size={20} className="text-[var(--c-accent)]" />
          </div>
          <div className="text-left">
            <h3 className="text-[14px] font-bold text-[var(--c-text)] flex items-center gap-2">
              Hiring Agent
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                style={{ color: st.color, background: st.bg }}>
                <StatusIcon size={10} className="inline mr-1" />
                {st.label}
              </span>
            </h3>
            <p className="text-[11px] text-[var(--c-text-mute)]">
              {isRunning ? 'Autonomously processing candidates' : isPaused ? 'Paused — click to resume' : config?._id ? 'Configure and activate' : 'Set up your AI hiring agent'}
            </p>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={`text-[var(--c-text-mute)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-5 space-y-5 border-t border-[var(--c-border)]">
              {/* Agent Stats (when running) */}
              {config?.stats && (isRunning || isPaused) && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-4">
                  {[
                    { label: 'Processed', value: config.stats.totalProcessed, color: 'var(--c-text-dim)' },
                    { label: 'Advanced', value: config.stats.totalAdvanced, color: 'var(--c-success)' },
                    { label: 'Rejected', value: config.stats.totalRejected, color: 'var(--c-error)' },
                    { label: 'Escalated', value: config.stats.totalEscalated, color: 'var(--c-accent)' },
                    { label: 'Finalists', value: `${config.stats.currentFinalists}/${draft.targetFinalists}`, color: 'var(--c-purple)' },
                  ].map(item => (
                    <div key={item.label} className="bg-[var(--c-surface-2)] rounded-xl p-3 text-center">
                      <p className="text-lg font-black" style={{ color: item.color }}>{item.value}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--c-text-mute)]">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Goal Section */}
              <div className="pt-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-3 flex items-center gap-2">
                  <Target size={12} /> Goal
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--c-text-mute)] mb-1.5">Target Finalists</label>
                    <input
                      type="number" min={1} max={100}
                      value={draft.targetFinalists}
                      onChange={e => setDraft(prev => ({ ...prev, targetFinalists: parseInt(e.target.value) || 5 }))}
                      className="w-full bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[13px] text-[var(--c-text)] px-3 py-2.5 focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--c-text-mute)] mb-1.5 flex items-center gap-1">
                      <Calendar size={10} /> Deadline
                    </label>
                    <input
                      type="date"
                      value={draft.deadline ? new Date(draft.deadline).toISOString().split('T')[0] : ''}
                      onChange={e => setDraft(prev => ({ ...prev, deadline: e.target.value || null }))}
                      className="w-full bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[13px] text-[var(--c-text)] px-3 py-2.5 focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Thresholds */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-3 flex items-center gap-2">
                  <Scale size={12} /> Auto-Advance Thresholds
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Screening', key: 'screeningThreshold' as const, suffix: '%', max: 100 },
                    { label: 'MCQ', key: 'mcqThreshold' as const, suffix: '%', max: 100 },
                    { label: 'Tech', key: 'techThreshold' as const, suffix: '/10', max: 10 },
                    { label: 'HR', key: 'hrThreshold' as const, suffix: '/10', max: 10 },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-[11px] text-[var(--c-text-mute)] mb-1.5">{field.label}</label>
                      <div className="relative">
                        <input
                          type="number" min={0} max={field.max} step={field.max === 10 ? 0.5 : 1}
                          value={draft[field.key] ?? ''}
                          onChange={e => setDraft(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))}
                          className="w-full bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[13px] text-[var(--c-text)] px-3 py-2.5 pr-10 focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--c-text-mute)]">{field.suffix}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escalation Rules */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-3 flex items-center gap-2">
                  <AlertTriangle size={12} /> Escalation Rules
                </h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between bg-[var(--c-surface-2)] rounded-xl px-4 py-3">
                    <div>
                      <p className="text-[12px] font-semibold text-[var(--c-text)]">Borderline scores</p>
                      <p className="text-[10px] text-[var(--c-text-mute)]">
                        Escalate when score is within {draft.escalation.thresholdMarginPercent}% of threshold
                      </p>
                    </div>
                    <input
                      type="number" min={0} max={25}
                      value={draft.escalation.thresholdMarginPercent}
                      onChange={e => setDraft(prev => ({ ...prev, escalation: { ...prev.escalation, thresholdMarginPercent: parseInt(e.target.value) || 5 } }))}
                      className="w-14 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-lg text-[12px] text-[var(--c-text)] px-2 py-1.5 text-center focus:outline-none focus:border-[var(--c-accent)]"
                    />
                  </div>
                  {[
                    { key: 'onProctoringFlag' as const, label: 'Proctoring violations', desc: 'Flag candidates with suspicious activity' },
                    { key: 'onLowAiConfidence' as const, label: 'Low AI confidence', desc: 'Flag when interview evaluation has high variance' },
                    { key: 'onTargetReached' as const, label: 'Target reached alert', desc: 'Notify when finalist target is met' },
                  ].map(rule => (
                    <label key={rule.key} className="flex items-center justify-between bg-[var(--c-surface-2)] rounded-xl px-4 py-3 cursor-pointer hover:bg-[var(--c-surface-3)] transition-colors">
                      <div>
                        <p className="text-[12px] font-semibold text-[var(--c-text)]">{rule.label}</p>
                        <p className="text-[10px] text-[var(--c-text-mute)]">{rule.desc}</p>
                      </div>
                      <div className={`relative w-9 h-5 rounded-full transition-colors ${draft.escalation[rule.key] ? 'bg-[var(--c-accent)]' : 'bg-[var(--c-surface-3)]'}`}
                        onClick={() => setDraft(prev => ({ ...prev, escalation: { ...prev.escalation, [rule.key]: !prev.escalation[rule.key] } }))}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${draft.escalation[rule.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-3 flex items-center gap-2">
                  <Zap size={12} /> Capabilities
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { key: 'autoAdvanceScreening' as const, label: 'Auto-advance screening' },
                    { key: 'autoAdvanceMcq' as const, label: 'Auto-advance MCQ' },
                    { key: 'autoAdvanceTech' as const, label: 'Auto-advance tech' },
                    { key: 'autoAdvanceHr' as const, label: 'Auto-advance HR' },
                    { key: 'sendCandidateEmails' as const, label: 'Send candidate emails' },
                  ].map(cap => (
                    <label key={cap.key} className="flex items-center gap-3 bg-[var(--c-surface-2)] rounded-xl px-4 py-3 cursor-pointer hover:bg-[var(--c-surface-3)] transition-colors">
                      <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${draft[cap.key] ? 'bg-[var(--c-accent)]' : 'bg-[var(--c-surface-3)]'}`}
                        onClick={() => setDraft(prev => ({ ...prev, [cap.key]: !prev[cap.key] }))}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${draft[cap.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-[12px] font-semibold text-[var(--c-text)]">{cap.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-4 border-t border-[var(--c-border)]">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-[var(--c-surface-2)] text-[var(--c-text)] hover:bg-[var(--c-surface-3)] transition-all"
                >
                  {saving ? <div className="spinner !w-4 !h-4 !border-[var(--c-text-mute)] !border-t-transparent" /> : <Save size={14} />}
                  Save Config
                </button>

                <div className="flex-1" />

                {(!config || config.status === 'idle' || config.status === 'completed') && (
                  <button
                    onClick={() => handleAction('start')}
                    disabled={actionLoading}
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold bg-gradient-to-r from-[var(--c-success)] to-[#22c55e] text-white hover:brightness-110 shadow-md transition-all active:scale-95"
                  >
                    {actionLoading ? <div className="spinner !w-4 !h-4 !border-white !border-t-transparent" /> : <Play size={14} />}
                    Activate Agent
                  </button>
                )}

                {isRunning && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('pause')}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-[var(--c-accent-dim)] text-[var(--c-accent)] hover:brightness-110 transition-all"
                    >
                      <Pause size={14} /> Pause
                    </button>
                    <button
                      onClick={() => handleAction('stop')}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-[var(--c-error-dim)] text-[var(--c-error)] hover:brightness-110 transition-all"
                    >
                      <Square size={14} /> Stop
                    </button>
                  </div>
                )}

                {isPaused && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction('start')}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold bg-gradient-to-r from-[var(--c-success)] to-[#22c55e] text-white hover:brightness-110 shadow-md transition-all"
                    >
                      <Play size={14} /> Resume
                    </button>
                    <button
                      onClick={() => handleAction('stop')}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-[var(--c-error-dim)] text-[var(--c-error)] hover:brightness-110 transition-all"
                    >
                      <Square size={14} /> Stop
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
