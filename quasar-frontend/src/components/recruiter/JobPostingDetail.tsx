import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Sparkles, Plus, Trash2, Edit3,
  CheckCircle, XCircle, Clock, Play, Square,
  Trophy, ChevronDown, ChevronUp, FileText,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../../lib/api';
import type { JobPosting, McqQuestion, ApplicantSummary, ApplicationStatus } from '../../types/recruitment';

interface Props {
  jobId: string;
  onBack: () => void;
}

type Tab = 'overview' | 'applicants' | 'mcqs' | 'pipeline';

const statusColors: Partial<Record<ApplicationStatus, { color: string; bg: string; label: string }>> = {
  applied: { color: 'var(--c-text-mute)', bg: 'var(--c-surface-3)', label: 'Applied' },
  screening: { color: 'var(--c-purple)', bg: 'var(--c-purple-dim)', label: 'Screening' },
  screening_passed: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'Screen Passed' },
  screening_failed: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'Screen Failed' },
  mcq_pending: { color: 'var(--c-purple)', bg: 'var(--c-purple-dim)', label: 'MCQ Pending' },
  mcq_in_progress: { color: 'var(--c-accent)', bg: 'var(--c-accent-dim)', label: 'MCQ In Progress' },
  mcq_passed: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'MCQ Passed' },
  mcq_failed: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'MCQ Failed' },
  tech_pending: { color: 'var(--c-user)', bg: 'var(--c-user-dim)', label: 'Tech Pending' },
  tech_in_progress: { color: 'var(--c-accent)', bg: 'var(--c-accent-dim)', label: 'Tech In Progress' },
  tech_passed: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'Tech Passed' },
  tech_failed: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'Tech Failed' },
  hr_pending: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'HR Pending' },
  hr_in_progress: { color: 'var(--c-accent)', bg: 'var(--c-accent-dim)', label: 'HR In Progress' },
  hr_passed: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'HR Passed' },
  hr_failed: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'HR Failed' },
  selected: { color: 'var(--c-success)', bg: 'var(--c-success-dim)', label: 'Selected' },
  rejected: { color: 'var(--c-error)', bg: 'var(--c-error-dim)', label: 'Rejected' },
};

export function JobPostingDetail({ jobId, onBack }: Props) {
  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [applicants, setApplicants] = useState<ApplicantSummary[]>([]);
  const [mcqs, setMcqs] = useState<McqQuestion[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<JobPosting>(`/api/recruiter/jobs/${jobId}`),
      apiGet<{ applicants: ApplicantSummary[] }>(`/api/recruiter/jobs/${jobId}/applicants`),
      apiGet<McqQuestion[]>(`/api/recruiter/jobs/${jobId}/mcqs`),
    ]).then(([postRes, appRes, mcqRes]) => {
      if (postRes.success) setPosting(postRes.data);
      if (appRes.success) setApplicants(appRes.data.applicants || []);
      if (mcqRes.success) setMcqs(mcqRes.data);
    }).finally(() => setLoading(false));
  }, [jobId]);

  const handleGenerateMcqs = async () => {
    setGenerating(true);
    try {
      const res = await apiPost<McqQuestion[]>(`/api/recruiter/jobs/${jobId}/mcqs/generate`, { count: 20 });
      if (res.success) {
        setMcqs(prev => [...prev, ...res.data]);
      }
    } catch {} finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await apiPost<JobPosting>(`/api/recruiter/jobs/${jobId}/publish`, {});
      if (res.success) setPosting(res.data);
      else alert(res.message);
    } catch {} finally {
      setPublishing(false);
    }
  };

  const handleClose = async () => {
    try {
      const res = await apiPost<JobPosting>(`/api/recruiter/jobs/${jobId}/close`, {});
      if (res.success) setPosting(res.data);
    } catch {}
  };

  const handleDeleteMcq = async (mcqId: string) => {
    try {
      const res = await apiGet(`/api/recruiter/jobs/${jobId}/mcqs/${mcqId}`); // We'll use fetch DELETE
      await fetch(`/api/recruiter/jobs/${jobId}/mcqs/${mcqId}`, { method: 'DELETE', credentials: 'include' });
      setMcqs(prev => prev.filter(m => m._id !== mcqId));
    } catch {}
  };

  const handleShortlist = async (appId: string, action: 'shortlist' | 'reject') => {
    try {
      await apiPost(`/api/recruiter/jobs/${jobId}/applicants/${appId}/shortlist`, { action });
      setApplicants(prev => prev.map(a => a._id === appId ? { ...a, status: action === 'shortlist' ? 'selected' : 'rejected' } : a));
    } catch {}
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">
      <div className="spinner !w-8 !h-8 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" />
    </div>;
  }

  if (!posting) {
    return <div className="p-8 text-center text-[var(--c-text-dim)]">Job posting not found</div>;
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'applicants', label: 'Applicants', count: applicants.length },
    { id: 'mcqs', label: 'MCQ Questions', count: mcqs.length },
    { id: 'pipeline', label: 'Pipeline Config' },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors mt-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-black text-[var(--c-text)] tracking-tight">{posting.title}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{
                color: posting.status === 'published' ? 'var(--c-success)' : 'var(--c-text-mute)',
                background: posting.status === 'published' ? 'var(--c-success-dim)' : 'var(--c-surface-3)',
              }}>
              {posting.status}
            </span>
          </div>
          <p className="text-[var(--c-text-dim)] text-[13px]">{posting.company} {posting.location && `• ${posting.location}`} • {posting.employmentType}</p>
        </div>
        <div className="flex gap-2">
          {posting.status === 'draft' && (
            <button onClick={handlePublish} disabled={publishing} className="btn-primary flex items-center gap-2">
              {publishing ? <div className="spinner" /> : <><Play size={14} /> Publish</>}
            </button>
          )}
          {posting.status === 'published' && (
            <button onClick={handleClose} className="btn-danger flex items-center gap-2">
              <Square size={14} /> Close
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--c-border)] pb-px">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-[13px] font-semibold transition-all border-b-2 ${
              tab === t.id
                ? 'text-[var(--c-accent)] border-[var(--c-accent)]'
                : 'text-[var(--c-text-mute)] border-transparent hover:text-[var(--c-text-dim)]'
            }`}
          >
            {t.label} {t.count !== undefined && <span className="ml-1.5 px-1.5 py-0.5 rounded-md text-[10px] bg-[var(--c-surface-3)]">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'overview' && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6">
          <h3 className="text-[14px] font-bold text-[var(--c-text)] mb-3">Job Description</h3>
          <div className="text-[13px] text-[var(--c-text-dim)] leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
            {posting.jobDescription}
          </div>
          {posting.parsedJd && (
            <div className="mt-6 pt-5 border-t border-[var(--c-border)]">
              <h3 className="text-[14px] font-bold text-[var(--c-text)] mb-3">AI Analysis</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {posting.parsedJd.requiredSkills?.map((s: string) => (
                  <span key={s} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--c-accent-dim)] text-[var(--c-accent)]">{s}</span>
                ))}
              </div>
              <div className="flex gap-4 text-[12px] text-[var(--c-text-mute)]">
                <span>Domain: {posting.parsedJd.domain}</span>
                <span>Seniority: {posting.parsedJd.seniority}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'applicants' && (
        <div>
          {applicants.length === 0 ? (
            <div className="text-center py-16">
              <Users size={48} className="mx-auto text-[var(--c-text-mute)] mb-4" />
              <p className="text-[var(--c-text-dim)]">No applicants yet</p>
            </div>
          ) : (
            <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-3 bg-[var(--c-surface-2)] text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)]">
                <span>#</span><span>Candidate</span><span>Screening</span><span>MCQ</span><span>Tech</span><span>Status</span><span>Actions</span>
              </div>
              {applicants.map((app, i) => {
                const st = statusColors[app.status] || { color: 'var(--c-text-mute)', bg: 'var(--c-surface-3)', label: app.status };
                return (
                  <div key={app._id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-5 py-4 border-t border-[var(--c-border)] items-center hover:bg-[var(--c-surface-2)] transition-colors">
                    <span className="text-[12px] font-bold text-[var(--c-text-mute)] w-5">{app.rank || i + 1}</span>
                    <div>
                      <p className="text-[13px] font-semibold text-[var(--c-text)]">{app.candidate?.name || 'Unknown'}</p>
                      <p className="text-[11px] text-[var(--c-text-mute)]">{app.candidate?.headline || app.candidate?.email}</p>
                    </div>
                    <span className="text-[13px] font-semibold text-[var(--c-text-dim)]">{app.screeningScore != null ? `${app.screeningScore}%` : '—'}</span>
                    <span className="text-[13px] font-semibold text-[var(--c-text-dim)]">{app.mcqPercentage != null ? `${app.mcqPercentage}%` : '—'}</span>
                    <span className="text-[13px] font-semibold text-[var(--c-text-dim)]">
                      {app.techScores?.length > 0 ? app.techScores.map(t => t.score != null ? t.score.toFixed(1) : '—').join('/') : '—'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                    <div className="flex gap-1">
                      {!['selected', 'rejected'].includes(app.status) && (
                        <>
                          <button onClick={() => handleShortlist(app._id, 'shortlist')} className="p-1.5 rounded-lg hover:bg-[var(--c-success-dim)] text-[var(--c-text-mute)] hover:text-[var(--c-success)]" title="Shortlist">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => handleShortlist(app._id, 'reject')} className="p-1.5 rounded-lg hover:bg-[var(--c-error-dim)] text-[var(--c-text-mute)] hover:text-[var(--c-error)]" title="Reject">
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'mcqs' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] text-[var(--c-text-dim)]">{mcqs.length} questions</p>
            <div className="flex gap-2">
              <button onClick={handleGenerateMcqs} disabled={generating} className="btn-secondary flex items-center gap-2">
                {generating ? <div className="spinner !w-4 !h-4 !border-[var(--c-accent)] !border-t-transparent" /> : <Sparkles size={14} />}
                {generating ? 'Generating...' : 'AI Generate (20)'}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {mcqs.map((mcq, i) => (
              <motion.div
                key={mcq._id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-[var(--c-text-mute)]">Q{i + 1}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      mcq.difficulty === 1 ? 'bg-[var(--c-success-dim)] text-[var(--c-success)]' :
                      mcq.difficulty === 3 ? 'bg-[var(--c-error-dim)] text-[var(--c-error)]' :
                      'bg-[var(--c-accent-dim)] text-[var(--c-accent)]'
                    }`}>
                      {mcq.difficulty === 1 ? 'Easy' : mcq.difficulty === 3 ? 'Hard' : 'Medium'}
                    </span>
                    {mcq.topic && <span className="text-[10px] text-[var(--c-text-mute)]">{mcq.topic}</span>}
                    <span className="text-[10px] text-[var(--c-text-mute)]">({mcq.source === 'ai_generated' ? 'AI' : 'Manual'})</span>
                  </div>
                  <button onClick={() => handleDeleteMcq(mcq._id)} className="p-1.5 rounded-lg hover:bg-[var(--c-error-dim)] text-[var(--c-text-mute)] hover:text-[var(--c-error)]">
                    <Trash2 size={13} />
                  </button>
                </div>
                <p className="text-[13px] font-medium text-[var(--c-text)] mb-3">{mcq.question}</p>
                <div className="grid grid-cols-2 gap-2">
                  {mcq.options.map((opt, oi) => (
                    <div
                      key={oi}
                      className={`px-3 py-2 rounded-lg text-[12px] ${
                        opt.isCorrect
                          ? 'bg-[var(--c-success-dim)] text-[var(--c-success)] border border-[var(--c-success)]/20'
                          : 'bg-[var(--c-surface-2)] text-[var(--c-text-dim)]'
                      }`}
                    >
                      <span className="font-bold mr-2">{String.fromCharCode(65 + oi)}.</span>
                      {opt.text}
                      {opt.isCorrect && <CheckCircle size={12} className="inline ml-2" />}
                    </div>
                  ))}
                </div>
                {mcq.explanation && (
                  <p className="mt-3 text-[11px] text-[var(--c-text-mute)] italic">💡 {mcq.explanation}</p>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tab === 'pipeline' && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6">
          <h3 className="text-[14px] font-bold text-[var(--c-text)] mb-4">Pipeline Configuration</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 bg-[var(--c-surface-2)] rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-[var(--c-accent-dim)] flex items-center justify-center text-[var(--c-accent)] text-[12px] font-bold">0</div>
              <div>
                <p className="text-[13px] font-semibold text-[var(--c-text)]">AI Resume Screening</p>
                <p className="text-[11px] text-[var(--c-text-mute)]">Threshold: {posting.screeningThreshold}% match • {posting.autoScreeningEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
            {posting.pipeline.mcqRound?.enabled && (
              <div className="flex items-center gap-3 p-4 bg-[var(--c-surface-2)] rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-[var(--c-purple-dim)] flex items-center justify-center text-[var(--c-purple)] text-[12px] font-bold">1</div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-[var(--c-text)]">MCQ Round</p>
                  <p className="text-[11px] text-[var(--c-text-mute)]">Duration: {posting.pipeline.mcqRound.durationMinutes}min • Pass: {posting.pipeline.mcqRound.passingScore}% • {mcqs.length} questions</p>
                </div>
              </div>
            )}
            {posting.pipeline.techInterviewRounds?.map(r => (
              <div key={r.roundNumber} className="flex items-center gap-3 p-4 bg-[var(--c-surface-2)] rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-[var(--c-user-dim)] flex items-center justify-center text-[var(--c-user)] text-[12px] font-bold">{(posting.pipeline.mcqRound?.enabled ? 1 : 0) + r.roundNumber}</div>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--c-text)]">{r.title}</p>
                  <p className="text-[11px] text-[var(--c-text-mute)]">Duration: {r.durationMinutes}min • Pass: {r.passingScore}/10 • Domain: {r.domain}</p>
                </div>
              </div>
            ))}
            {posting.pipeline.hrRound?.enabled && (
              <div className="flex items-center gap-3 p-4 bg-[var(--c-surface-2)] rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-[var(--c-success-dim)] flex items-center justify-center text-[var(--c-success)] text-[12px] font-bold">
                  {(posting.pipeline.mcqRound?.enabled ? 1 : 0) + (posting.pipeline.techInterviewRounds?.length || 0) + 1}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-[var(--c-text)]">HR Round (AI)</p>
                  <p className="text-[11px] text-[var(--c-text-mute)]">Duration: {posting.pipeline.hrRound.durationMinutes}min • Pass: {posting.pipeline.hrRound.passingScore}/10</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
