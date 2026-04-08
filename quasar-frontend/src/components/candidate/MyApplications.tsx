import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Clock, CheckCircle, XCircle, ArrowRight, AlertCircle } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { PipelineTracker } from './PipelineTracker';
import type { Application, JobPosting, ApplicationStatus, TechRoundConfig } from '../../types/recruitment';

interface Props {
  onViewApplication?: (appId: string, jobId: string) => void;
  /** Called when the tracker needs to start an MCQ test */
  onStartMcq?: (appId: string) => void;
  /** Called when the tracker needs to start a tech interview. alreadyStarted=true means status is already tech_in_progress */
  onStartTechInterview?: (appId: string, round: number, config: any, jdContext: string, alreadyStarted?: boolean) => void;
  /** Called when the tracker needs to start an HR interview. alreadyStarted=true means status is already hr_in_progress */
  onStartHrInterview?: (appId: string, jdContext: string, alreadyStarted?: boolean) => void;
  /** If set, show a specific application in detail mode */
  activeAppId?: string | null;
  onClearActiveApp?: () => void;
}

const statusConfig: Partial<Record<ApplicationStatus, { icon: typeof CheckCircle; color: string; label: string }>> = {
  applied: { icon: Clock, color: 'var(--c-text-mute)', label: 'Applied' },
  screening: { icon: Clock, color: 'var(--c-purple)', label: 'Screening' },
  screening_passed: { icon: CheckCircle, color: 'var(--c-success)', label: 'Screening Passed' },
  screening_failed: { icon: XCircle, color: 'var(--c-error)', label: 'Screening Failed' },
  mcq_pending: { icon: Clock, color: 'var(--c-purple)', label: 'MCQ Test Pending' },
  mcq_in_progress: { icon: AlertCircle, color: 'var(--c-accent)', label: 'MCQ In Progress' },
  mcq_passed: { icon: CheckCircle, color: 'var(--c-success)', label: 'MCQ Passed' },
  mcq_failed: { icon: XCircle, color: 'var(--c-error)', label: 'MCQ Failed' },
  tech_pending: { icon: Clock, color: 'var(--c-user)', label: 'Tech Interview Pending' },
  tech_in_progress: { icon: AlertCircle, color: 'var(--c-accent)', label: 'Tech Interview' },
  tech_passed: { icon: CheckCircle, color: 'var(--c-success)', label: 'Tech Passed' },
  tech_failed: { icon: XCircle, color: 'var(--c-error)', label: 'Tech Failed' },
  hr_pending: { icon: Clock, color: 'var(--c-success)', label: 'HR Round Pending' },
  hr_in_progress: { icon: AlertCircle, color: 'var(--c-accent)', label: 'HR Round' },
  hr_passed: { icon: CheckCircle, color: 'var(--c-success)', label: 'HR Passed' },
  hr_failed: { icon: XCircle, color: 'var(--c-error)', label: 'HR Failed' },
  selected: { icon: CheckCircle, color: 'var(--c-success)', label: '🎉 Selected' },
  rejected: { icon: XCircle, color: 'var(--c-error)', label: 'Rejected' },
};

export function MyApplications({ onViewApplication, onStartMcq, onStartTechInterview, onStartHrInterview, activeAppId, onClearActiveApp }: Props) {
  const [applications, setApplications] = useState<(Application & { jobPostingId: JobPosting })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(activeAppId || null);

  useEffect(() => {
    apiGet<Application[]>('/api/candidate/applications')
      .then(res => { if (res.success) setApplications(res.data as (Application & { jobPostingId: JobPosting })[]); })
      .finally(() => setLoading(false));
  }, []);

  // Sync external activeAppId
  useEffect(() => {
    if (activeAppId !== undefined) setSelectedAppId(activeAppId);
  }, [activeAppId]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="spinner !w-8 !h-8 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" /></div>;
  }

  // If an app is selected, show the PipelineTracker
  if (selectedAppId) {
    return (
      <PipelineTracker
        appId={selectedAppId}
        onBack={() => {
          setSelectedAppId(null);
          onClearActiveApp?.();
        }}
        onStartMcq={onStartMcq || (() => {})}
        onStartTechInterview={onStartTechInterview || (() => {})}
        onStartHrInterview={onStartHrInterview || (() => {})}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-black text-[var(--c-text)] tracking-tight mb-2">My Applications</h1>
      <p className="text-[var(--c-text-dim)] text-[14px] mb-6">{applications.length} applications</p>

      {applications.length === 0 ? (
        <div className="text-center py-20">
          <Briefcase size={48} className="mx-auto text-[var(--c-text-mute)] mb-4" />
          <p className="text-[var(--c-text-dim)] text-[15px] font-semibold">No applications yet</p>
          <p className="text-[var(--c-text-mute)] text-[13px] mt-1">Browse jobs and apply to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app, i) => {
            const job = typeof app.jobPostingId === 'object' ? app.jobPostingId : null;
            const conf = statusConfig[app.status] || { icon: Clock, color: 'var(--c-text-mute)', label: app.status };
            const Icon = conf.icon;
            const isActionable = ['mcq_pending', 'tech_pending', 'hr_pending', 'mcq_in_progress', 'tech_in_progress', 'hr_in_progress'].includes(app.status);

            return (
              <motion.div
                key={app._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedAppId(app._id)}
                className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5 hover:border-[var(--c-border-2)] transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-[15px] font-bold text-[var(--c-text)] group-hover:text-[var(--c-accent)] transition-colors">{job?.title || 'Job'}</h3>
                    <p className="text-[12px] text-[var(--c-text-mute)] mt-0.5">
                      {job?.company} {job?.location ? `• ${job.location}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold" style={{ color: conf.color, background: `color-mix(in srgb, ${conf.color} 12%, transparent)` }}>
                      <Icon size={13} />
                      {conf.label}
                    </div>
                    {isActionable && (
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--c-accent)] text-white animate-pulse">
                        <ArrowRight size={14} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Score summary */}
                <div className="flex items-center gap-5 mt-4 text-[12px]">
                  {app.screeningResult && (
                    <div>
                      <span className="text-[var(--c-text-mute)]">Screening: </span>
                      <span className="font-semibold" style={{ color: app.screeningResult.passed ? 'var(--c-success)' : 'var(--c-error)' }}>
                        {app.screeningResult.matchScore}%
                      </span>
                    </div>
                  )}
                  {app.mcqResult?.completedAt && (
                    <div>
                      <span className="text-[var(--c-text-mute)]">MCQ: </span>
                      <span className="font-semibold" style={{ color: app.mcqResult.passed ? 'var(--c-success)' : 'var(--c-error)' }}>
                        {app.mcqResult.percentage}%
                      </span>
                    </div>
                  )}
                  {app.techResults?.filter(r => r.score != null).map(r => (
                    <div key={r.roundNumber}>
                      <span className="text-[var(--c-text-mute)]">Tech {r.roundNumber}: </span>
                      <span className="font-semibold" style={{ color: r.passed ? 'var(--c-success)' : 'var(--c-error)' }}>
                        {r.score?.toFixed(1)}/10
                      </span>
                    </div>
                  ))}
                  {app.hrResult?.score != null && (
                    <div>
                      <span className="text-[var(--c-text-mute)]">HR: </span>
                      <span className="font-semibold" style={{ color: app.hrResult.passed ? 'var(--c-success)' : 'var(--c-error)' }}>
                        {app.hrResult.score.toFixed(1)}/10
                      </span>
                    </div>
                  )}
                  <span className="text-[var(--c-text-mute)] ml-auto">Applied {new Date(app.appliedAt).toLocaleDateString()}</span>
                </div>

                {/* Actionable hint */}
                {isActionable && (
                  <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-[var(--c-accent)]">
                    <AlertCircle size={13} />
                    Action required — click to continue
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
