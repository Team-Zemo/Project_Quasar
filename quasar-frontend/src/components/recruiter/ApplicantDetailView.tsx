import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User, Mail, Phone, MapPin, Briefcase,
  CheckCircle, XCircle, Award, FileText, MessageSquare,
  Clock, Star, AlertTriangle, ChevronDown, ChevronUp,
  ThumbsUp, ThumbsDown, Shield, Target, Brain,
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import type { ApplicationStatus } from '../../types/recruitment';

interface CandidateInfo {
  _id: string;
  name: string;
  email: string;
  headline?: string;
  skills?: string[];
  experience?: number;
  avatarUrl?: string;
  phone?: string;
  location?: string;
  resumeParsed?: Record<string, unknown>;
}

interface ScreeningResult {
  matchScore: number;
  passed: boolean;
  matchedSkills: string[];
  missingSkills: string[];
  summary: string;
  evaluatedAt: string;
}

interface McqResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  passed: boolean;
  startedAt: string;
  completedAt: string | null;
}

interface TechResult {
  roundNumber: number;
  score: number | null;
  passed: boolean | null;
  transcript: string;
  evaluation: Record<string, unknown> | null;
  completedAt: string | null;
}

interface HrResult {
  score: number | null;
  passed: boolean | null;
  transcript: string;
  evaluation: Record<string, unknown> | null;
  completedAt: string | null;
}

interface ApplicationDetail {
  _id: string;
  candidateId: CandidateInfo;
  status: ApplicationStatus;
  currentRound: string;
  totalScore: number;
  rank: number | null;
  appliedAt: string;
  lastActivityAt: string;
  screeningResult: ScreeningResult | null;
  mcqResult: McqResult | null;
  techResults: TechResult[];
  hrResult: HrResult | null;
}

interface Props {
  jobId: string;
  applicationId: string;
  onBack: () => void;
}

const statusConfig: Partial<Record<ApplicationStatus, { color: string; bg: string; label: string }>> = {
  applied: { color: 'var(--c-text-mute)', bg: 'var(--c-surface-3)', label: 'Applied' },
  screening: { color: 'var(--c-purple)', bg: 'var(--c-purple-dim)', label: 'Screening' },
  screening_passed: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'Screening Passed' },
  screening_failed: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'Screening Failed' },
  mcq_pending: { color: 'var(--c-purple)', bg: 'var(--c-purple-dim)', label: 'MCQ Pending' },
  mcq_in_progress: { color: 'var(--c-accent)', bg: 'var(--c-accent-dim)', label: 'MCQ In Progress' },
  mcq_passed: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'MCQ Passed' },
  mcq_failed: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'MCQ Failed' },
  tech_pending: { color: 'var(--c-user)', bg: 'var(--c-user-dim)', label: 'Tech Pending' },
  tech_in_progress: { color: 'var(--c-accent)', bg: 'var(--c-accent-dim)', label: 'Tech In Progress' },
  tech_passed: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'Tech Passed' },
  tech_failed: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'Tech Failed' },
  hr_pending: { color: 'var(--c-user)', bg: 'var(--c-user-dim)', label: 'HR Pending' },
  hr_in_progress: { color: 'var(--c-accent)', bg: 'var(--c-accent-dim)', label: 'HR In Progress' },
  hr_passed: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'HR Passed' },
  hr_failed: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'HR Failed' },
  selected: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'Selected' },
  rejected: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'Rejected' },
};

function ScoreRing({ score, max = 100, size = 56, label }: { score: number; max?: number; size?: number; label: string }) {
  const pct = Math.min((score / max) * 100, 100);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 70 ? 'var(--c-success)' : pct >= 40 ? 'var(--c-accent)' : 'var(--c-error)';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-surface-3)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-[14px] font-black" style={{ color }}>{Math.round(score)}</span>
      </div>
      <span className="text-[10px] font-semibold text-[var(--c-text-mute)] uppercase tracking-wider">{label}</span>
    </div>
  );
}

function CollapsibleSection({ title, icon: Icon, children, defaultOpen = false, badge }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: { text: string; color: string; bg: string } | null;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[var(--c-surface-2)] transition-colors"
      >
        <Icon size={18} className="text-[var(--c-accent)] flex-shrink-0" />
        <span className="text-[14px] font-bold text-[var(--c-text)] flex-1">{title}</span>
        {badge && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ color: badge.color, background: badge.bg }}>
            {badge.text}
          </span>
        )}
        {open ? <ChevronUp size={16} className="text-[var(--c-text-mute)]" /> : <ChevronDown size={16} className="text-[var(--c-text-mute)]" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-[var(--c-border)]">{children}</div>}
    </div>
  );
}

function TranscriptViewer({ transcript }: { transcript: string }) {
  if (!transcript) return <p className="text-[12px] text-[var(--c-text-mute)] italic pt-3">No transcript available</p>;

  const lines = transcript.split('\n').filter(l => l.trim());
  return (
    <div className="mt-3 max-h-[400px] overflow-y-auto space-y-2 rounded-xl bg-[var(--c-bg)] p-4 border border-[var(--c-border)]">
      {lines.map((line, i) => {
        const isAI = line.toLowerCase().startsWith('ai:') || line.toLowerCase().startsWith('interviewer:');
        const isCandidate = line.toLowerCase().startsWith('candidate:') || line.toLowerCase().startsWith('user:');
        return (
          <div key={i} className={`text-[12px] leading-relaxed rounded-lg px-3 py-2 ${isAI ? 'bg-[var(--c-accent-dim)] text-[var(--c-text)] ml-0 mr-8' :
              isCandidate ? 'bg-[var(--c-surface-2)] text-[var(--c-text)] ml-8 mr-0' :
                'text-[var(--c-text-dim)]'
            }`}>
            {line}
          </div>
        );
      })}
    </div>
  );
}

function EvaluationDisplay({ evaluation }: { evaluation: Record<string, unknown> | null }) {
  if (!evaluation) return <p className="text-[12px] text-[var(--c-text-mute)] italic pt-3">No evaluation available</p>;

  return (
    <div className="mt-3 space-y-2">
      {Object.entries(evaluation).map(([key, value]) => {
        if (key.startsWith('_')) return null;
        const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
        const isScore = typeof value === 'number';
        const isBoolean = typeof value === 'boolean';

        return (
          <div key={key} className="flex items-center justify-between py-1.5 border-b border-[var(--c-border)] last:border-0">
            <span className="text-[12px] font-semibold text-[var(--c-text-dim)] capitalize">{label}</span>
            {isScore ? (
              <span className={`text-[13px] font-bold ${(value as number) >= 7 ? 'text-[var(--c-success)]' : (value as number) >= 4 ? 'text-[var(--c-accent)]' : 'text-[var(--c-error)]'
                }`}>{(value as number).toFixed(1)}/10</span>
            ) : isBoolean ? (
              value ? <CheckCircle size={14} className="text-[var(--c-success)]" /> : <XCircle size={14} className="text-[var(--c-error)]" />
            ) : (
              <span className="text-[12px] text-[var(--c-text-dim)] max-w-[60%] text-right">{String(value)}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ApplicantDetailView({ jobId, applicationId, onBack }: Props) {
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    apiGet<{ application: ApplicationDetail }>(`/api/recruiter/jobs/${jobId}/applicants/${applicationId}`)
      .then(res => {
        if (res.success) setApp(res.data.application);
      })
      .finally(() => setLoading(false));
  }, [jobId, applicationId]);

  const handleShortlist = async (action: 'shortlist' | 'reject') => {
    setActionLoading(true);
    try {
      const res = await apiPost<{ status: string }>(`/api/recruiter/jobs/${jobId}/applicants/${applicationId}/shortlist`, { action });
      if (res.success && app) {
        setApp({ ...app, status: res.data.status as ApplicationStatus });
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="p-8">
        <button onClick={onBack} className="flex items-center gap-2 text-[var(--c-text-dim)] mb-4 hover:text-[var(--c-text)]">
          <ArrowLeft size={16} /> Back
        </button>
        <p className="text-[var(--c-error)]">Application not found</p>
      </div>
    );
  }

  const candidate = app.candidateId;
  const status = statusConfig[app.status];
  const screening = app.screeningResult;
  const mcq = app.mcqResult;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black text-[var(--c-text)]">Candidate Details</h1>
          <p className="text-[12px] text-[var(--c-text-mute)]">Application #{applicationId.slice(-6).toUpperCase()}</p>
        </div>
        {/* Actions */}
        {!['selected', 'rejected'].includes(app.status) && (
          <div className="flex gap-2">
            <button onClick={() => handleShortlist('reject')} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold border border-[var(--c-error)]/30 text-[var(--c-error)] hover:bg-[var(--c-error-dim)] transition-all"
            >
              <ThumbsDown size={14} /> Reject
            </button>
            <button onClick={() => handleShortlist('shortlist')} disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold bg-gradient-to-r from-[var(--c-success)] to-[#34d399] text-white hover:brightness-110 transition-all"
            >
              <ThumbsUp size={14} /> Select
            </button>
          </div>
        )}
      </div>

      {/* Candidate Profile Card */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--c-accent)] to-[#fb923c] flex items-center justify-center text-white text-xl font-black flex-shrink-0">
            {candidate?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-[18px] font-bold text-[var(--c-text)]">{candidate?.name || 'Unknown'}</h2>
              {status && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ color: status.color, background: status.bg }}>
                  {status.label}
                </span>
              )}
              {app.rank && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--c-accent-dim)] text-[var(--c-accent)]">
                  <Award size={10} /> Rank #{app.rank}
                </span>
              )}
            </div>
            {candidate?.headline && <p className="text-[13px] text-[var(--c-text-dim)] mb-2">{candidate.headline}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--c-text-mute)]">
              {candidate?.email && <span className="flex items-center gap-1"><Mail size={12} /> {candidate.email}</span>}
              {candidate?.phone && <span className="flex items-center gap-1"><Phone size={12} /> {candidate.phone}</span>}
              {candidate?.location && <span className="flex items-center gap-1"><MapPin size={12} /> {candidate.location}</span>}
              {candidate?.experience != null && <span className="flex items-center gap-1"><Briefcase size={12} /> {candidate.experience} yrs exp</span>}
            </div>
            {candidate?.skills && candidate.skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {candidate.skills.map(s => (
                  <span key={s} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--c-surface-3)] text-[var(--c-text-dim)]">{s}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Score overview bar */}
        <div className="flex items-center gap-6 mt-5 pt-4 border-t border-[var(--c-border)]">
          <div className="relative">
            <ScoreRing score={app.totalScore} max={10} label="Total" />
          </div>
          {screening && (
            <div className="relative">
              <ScoreRing score={screening.matchScore} label="Screen" />
            </div>
          )}
          {mcq && (
            <div className="relative">
              <ScoreRing score={mcq.percentage} label="MCQ" />
            </div>
          )}
          {app.techResults?.map(tr => tr.score != null && (
            <div key={tr.roundNumber} className="relative">
              <ScoreRing score={tr.score * 10} label={`Tech ${tr.roundNumber}`} />
            </div>
          ))}
          {app.hrResult?.score != null && (
            <div className="relative">
              <ScoreRing score={app.hrResult.score * 10} label="HR" />
            </div>
          )}
          <div className="flex-1" />
          <div className="text-right">
            <p className="text-[10px] text-[var(--c-text-mute)] uppercase font-bold">Applied</p>
            <p className="text-[13px] text-[var(--c-text-dim)]">{new Date(app.appliedAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Screening Review */}
      {screening && (
        <CollapsibleSection
          title="AI Screening Review"
          icon={Shield}
          defaultOpen={true}
          badge={screening.passed
            ? { text: `${screening.matchScore}% Match`, color: 'var(--c-success)', bg: 'var(--c-success-dim)' }
            : { text: 'Failed', color: 'var(--c-error)', bg: 'var(--c-error-dim)' }
          }
        >
          <div className="pt-4 space-y-4">
            {screening.summary && (
              <div className="bg-[var(--c-bg)] rounded-xl p-4 border border-[var(--c-border)]">
                <p className="text-[12px] text-[var(--c-text-dim)] leading-relaxed">{screening.summary}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="text-[11px] font-bold uppercase text-[var(--c-success)] mb-2 flex items-center gap-1"><CheckCircle size={12} /> Matched Skills</h5>
                <div className="flex flex-wrap gap-1.5">
                  {screening.matchedSkills.length > 0 ? screening.matchedSkills.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--c-success-dim)] text-[var(--c-success)]">{s}</span>
                  )) : <span className="text-[11px] text-[var(--c-text-mute)] italic">None</span>}
                </div>
              </div>
              <div>
                <h5 className="text-[11px] font-bold uppercase text-[var(--c-error)] mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Missing Skills</h5>
                <div className="flex flex-wrap gap-1.5">
                  {screening.missingSkills.length > 0 ? screening.missingSkills.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--c-error-dim)] text-[var(--c-error)]">{s}</span>
                  )) : <span className="text-[11px] text-[var(--c-text-mute)] italic">None</span>}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* MCQ Results */}
      {mcq && (
        <CollapsibleSection
          title="MCQ Assessment"
          icon={Target}
          badge={mcq.passed
            ? { text: `${mcq.percentage.toFixed(0)}%`, color: 'var(--c-success)', bg: 'var(--c-success-dim)' }
            : { text: `${mcq.percentage.toFixed(0)}% — Failed`, color: 'var(--c-error)', bg: 'var(--c-error-dim)' }
          }
        >
          <div className="pt-4">
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[
                { label: 'Correct', value: `${mcq.correctAnswers}/${mcq.totalQuestions}`, color: 'var(--c-success)' },
                { label: 'Percentage', value: `${mcq.percentage.toFixed(1)}%`, color: mcq.passed ? 'var(--c-success)' : 'var(--c-error)' },
                { label: 'Started', value: mcq.startedAt ? new Date(mcq.startedAt).toLocaleTimeString() : '—' },
                { label: 'Completed', value: mcq.completedAt ? new Date(mcq.completedAt).toLocaleTimeString() : '—' },
              ].map(item => (
                <div key={item.label} className="bg-[var(--c-bg)] rounded-xl p-3 border border-[var(--c-border)] text-center">
                  <p className="text-[18px] font-black" style={{ color: item.color || 'var(--c-text)' }}>{item.value}</p>
                  <p className="text-[10px] font-bold uppercase text-[var(--c-text-mute)] mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Tech Interviews */}
      {app.techResults?.map(tr => (
        <CollapsibleSection
          key={tr.roundNumber}
          title={`Technical Interview — Round ${tr.roundNumber}`}
          icon={Brain}
          badge={tr.passed != null ? (tr.passed
            ? { text: `${tr.score?.toFixed(1)}/10`, color: 'var(--c-success)', bg: 'var(--c-success-dim)' }
            : { text: `${tr.score?.toFixed(1)}/10 — Failed`, color: 'var(--c-error)', bg: 'var(--c-error-dim)' }
          ) : null}
        >
          <div className="pt-3 space-y-3">
            <div className="flex gap-3">
              {tr.score != null && (
                <div className="bg-[var(--c-bg)] rounded-xl p-3 border border-[var(--c-border)] text-center min-w-[80px]">
                  <p className={`text-[20px] font-black ${tr.score >= 7 ? 'text-[var(--c-success)]' : tr.score >= 4 ? 'text-[var(--c-accent)]' : 'text-[var(--c-error)]'}`}>
                    {tr.score.toFixed(1)}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-[var(--c-text-mute)]">Score /10</p>
                </div>
              )}
              {tr.completedAt && (
                <div className="bg-[var(--c-bg)] rounded-xl p-3 border border-[var(--c-border)] text-center min-w-[80px]">
                  <p className="text-[13px] font-bold text-[var(--c-text)]"><Clock size={14} className="inline mr-1" />{new Date(tr.completedAt).toLocaleDateString()}</p>
                  <p className="text-[10px] font-bold uppercase text-[var(--c-text-mute)]">Completed</p>
                </div>
              )}
            </div>

            {tr.evaluation && (
              <div>
                <h5 className="text-[11px] font-bold uppercase text-[var(--c-text-mute)] mb-1 flex items-center gap-1"><Star size={12} /> AI Evaluation</h5>
                <EvaluationDisplay evaluation={tr.evaluation} />
              </div>
            )}

            <div>
              <h5 className="text-[11px] font-bold uppercase text-[var(--c-text-mute)] flex items-center gap-1"><MessageSquare size={12} /> Interview Transcript</h5>
              <TranscriptViewer transcript={tr.transcript} />
            </div>
          </div>
        </CollapsibleSection>
      ))}

      {/* HR Interview */}
      {app.hrResult && (
        <CollapsibleSection
          title="HR Interview"
          icon={User}
          badge={app.hrResult.passed != null ? (app.hrResult.passed
            ? { text: `${app.hrResult.score?.toFixed(1)}/10`, color: 'var(--c-success)', bg: 'var(--c-success-dim)' }
            : { text: `${app.hrResult.score?.toFixed(1)}/10 — Failed`, color: 'var(--c-error)', bg: 'var(--c-error-dim)' }
          ) : null}
        >
          <div className="pt-3 space-y-3">
            <div className="flex gap-3">
              {app.hrResult.score != null && (
                <div className="bg-[var(--c-bg)] rounded-xl p-3 border border-[var(--c-border)] text-center min-w-[80px]">
                  <p className={`text-[20px] font-black ${app.hrResult.score >= 7 ? 'text-[var(--c-success)]' : app.hrResult.score >= 4 ? 'text-[var(--c-accent)]' : 'text-[var(--c-error)]'}`}>
                    {app.hrResult.score.toFixed(1)}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-[var(--c-text-mute)]">Score /10</p>
                </div>
              )}
            </div>

            {app.hrResult.evaluation && (
              <div>
                <h5 className="text-[11px] font-bold uppercase text-[var(--c-text-mute)] mb-1 flex items-center gap-1"><Star size={12} /> AI Evaluation</h5>
                <EvaluationDisplay evaluation={app.hrResult.evaluation} />
              </div>
            )}

            <div>
              <h5 className="text-[11px] font-bold uppercase text-[var(--c-text-mute)] flex items-center gap-1"><MessageSquare size={12} /> Interview Transcript</h5>
              <TranscriptViewer transcript={app.hrResult.transcript} />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Pipeline Timeline */}
      <CollapsibleSection title="Pipeline Timeline" icon={FileText} defaultOpen={false}>
        <div className="pt-4 space-y-0">
          {[
            { step: 'Applied', date: app.appliedAt, done: true },
            { step: 'Screening', date: screening?.evaluatedAt, done: !!screening, passed: screening?.passed },
            { step: 'MCQ Assessment', date: mcq?.completedAt, done: !!mcq, passed: mcq?.passed },
            ...app.techResults.map(tr => ({
              step: `Tech Round ${tr.roundNumber}`,
              date: tr.completedAt,
              done: tr.score != null,
              passed: tr.passed,
            })),
            ...(app.hrResult ? [{
              step: 'HR Interview',
              date: app.hrResult.completedAt,
              done: app.hrResult.score != null,
              passed: app.hrResult.passed,
            }] : []),
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${!item.done ? 'bg-[var(--c-surface-3)] text-[var(--c-text-mute)]' :
                    item.passed === false ? 'bg-[var(--c-error-dim)] text-[var(--c-error)]' :
                      'bg-[var(--c-success-dim)] text-[var(--c-success)]'
                  }`}>
                  {!item.done ? <Clock size={12} /> : item.passed === false ? <XCircle size={12} /> : <CheckCircle size={12} />}
                </div>
                {i < 3 + app.techResults.length + (app.hrResult ? 1 : 0) - 1 && (
                  <div className="w-0.5 h-6 bg-[var(--c-border)]" />
                )}
              </div>
              <div className="pb-4">
                <p className="text-[13px] font-semibold text-[var(--c-text)]">{item.step}</p>
                <p className="text-[11px] text-[var(--c-text-mute)]">
                  {item.date ? new Date(item.date).toLocaleString() : item.done ? 'Completed' : 'Pending'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </motion.div>
  );
}
