import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Send, CheckCircle, XCircle, Clock,
  MapPin, Briefcase, Users, AlertCircle,
} from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import type { JobPosting, Application } from '../../types/recruitment';

interface Props {
  jobId: string;
  onBack: () => void;
  onStartMcq?: (appId: string) => void;
  onStartTech?: (appId: string, round: number) => void;
  onStartHr?: (appId: string) => void;
}

export function JobDetail({ jobId, onBack, onStartMcq, onStartTech, onStartHr }: Props) {
  const [job, setJob] = useState<(JobPosting & { hasApplied?: boolean; application?: Application | null }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<JobPosting & { hasApplied: boolean; application: Application | null }>(`/api/candidate/jobs/${jobId}`)
      .then(res => { if (res.success) setJob(res.data); })
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleApply = async () => {
    setApplying(true);
    setError('');
    try {
      const res = await apiPost<{ applicationId: string; status: string; screeningResult: unknown }>(`/api/candidate/jobs/${jobId}/apply`, {});
      if (res.success) {
        setJob(prev => prev ? { ...prev, hasApplied: true, application: { status: res.data.status } as Application } : prev);
      } else {
        setError(res.message || 'Failed to apply');
      }
    } catch { setError('Network error'); }
    finally { setApplying(false); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="spinner !w-8 !h-8 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" /></div>;
  }

  if (!job) {
    return <div className="text-center py-20 text-[var(--c-text-dim)]">Job not found</div>;
  }

  const pipelineStages: { label: string; color: string }[] = [
    { label: 'AI Screening', color: 'var(--c-accent)' },
  ];
  if (job.pipeline?.mcqRound?.enabled) pipelineStages.push({ label: 'MCQ Round', color: 'var(--c-purple)' });
  if (job.pipeline?.techInterviewRounds) {
    job.pipeline.techInterviewRounds.forEach(r => pipelineStages.push({ label: r.title, color: 'var(--c-user)' }));
  }
  if (job.pipeline?.hrRound?.enabled) pipelineStages.push({ label: 'HR Round', color: 'var(--c-success)' });

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <button onClick={onBack} className="flex items-center gap-2 text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors mb-6 text-[13px]">
        <ArrowLeft size={16} /> Back to Jobs
      </button>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-8 shadow-[var(--shadow-glass)]">
        <h1 className="text-2xl font-black text-[var(--c-text)] mb-2">{job.title}</h1>
        <p className="text-[14px] text-[var(--c-text-dim)] mb-4">{job.company}</p>

        <div className="flex flex-wrap gap-4 text-[12px] text-[var(--c-text-mute)] mb-6">
          {job.location && <span className="flex items-center gap-1"><MapPin size={12} />{job.location}</span>}
          <span className="flex items-center gap-1"><Briefcase size={12} />{job.employmentType}</span>
          <span className="flex items-center gap-1"><Users size={12} />{job.applicantCount} applicants</span>
        </div>

        {/* Pipeline Preview */}
        <div className="mb-6 p-4 bg-[var(--c-surface-2)] rounded-xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-3">Hiring Pipeline</p>
          <div className="flex items-center gap-2 flex-wrap">
            {pipelineStages.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <span className="text-[var(--c-text-mute)]">→</span>}
                <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 15%, transparent)` }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Required Skills */}
        {job.parsedJd?.requiredSkills && job.parsedJd.requiredSkills.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {job.parsedJd.requiredSkills.map((s: string) => (
                <span key={s} className="px-3 py-1 rounded-lg text-[12px] font-semibold bg-[var(--c-accent-dim)] text-[var(--c-accent)]">{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* JD Text */}
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Job Description</p>
          <div className="text-[13px] text-[var(--c-text-dim)] leading-relaxed whitespace-pre-wrap max-h-[400px] overflow-y-auto">
            {job.jobDescription}
          </div>
        </div>

        {/* Application Status or Apply Button */}
        {error && <p className="text-[var(--c-error)] text-[13px] mb-4 flex items-center gap-2"><AlertCircle size={14} />{error}</p>}

        {job.hasApplied && job.application ? (
          <div className="p-4 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl">
            <div className="flex items-center gap-3">
              <CheckCircle size={18} className="text-[var(--c-success)]" />
              <div>
                <p className="text-[14px] font-bold text-[var(--c-text)]">Application Submitted</p>
                <p className="text-[12px] text-[var(--c-text-mute)]">Status: {job.application.status.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={handleApply} disabled={applying} className="btn-primary btn-full flex items-center gap-2 justify-center">
            {applying ? <div className="spinner" /> : <><Send size={16} /> Apply Now</>}
          </button>
        )}
      </div>
    </div>
  );
}
