import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Briefcase, Users, Eye } from 'lucide-react';
import { apiGet } from '../../lib/api';
import type { JobPosting } from '../../types/recruitment';

interface Props {
  onViewJob: (id: string) => void;
  onCreateJob: () => void;
  /** When provided (during tour), uses this data instead of API */
  dummyJobs?: JobPosting[];
}

const statusBadge: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: 'var(--c-text-mute)', bg: 'var(--c-surface-3)' },
  published: { label: 'Published', color: 'var(--c-success)',   bg: 'var(--c-success-dim)' },
  closed:    { label: 'Closed',    color: 'var(--c-error)',     bg: 'var(--c-error-dim)' },
  archived:  { label: 'Archived',  color: 'var(--c-text-mute)', bg: 'var(--c-surface-3)' },
};

export function JobPostingList({ onViewJob, onCreateJob, dummyJobs }: Props) {
  const [apiPostings, setApiPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(!dummyJobs);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    // Skip API fetch when tour is showing dummy data
    if (dummyJobs) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const url = filter === 'all' ? '/api/recruiter/jobs' : `/api/recruiter/jobs?status=${filter}`;
    apiGet<JobPosting[]>(url)
      .then(res => { if (res.success) setApiPostings(res.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter, dummyJobs]);

  // Apply filter to dummy jobs client-side
  const postings = dummyJobs
    ? (filter === 'all' ? dummyJobs : dummyJobs.filter(j => j.status === filter))
    : apiPostings;

  const filters = ['all', 'published', 'draft', 'closed'];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--c-text)] tracking-tight">Job Postings</h1>
          <p className="text-[var(--c-text-dim)] text-[14px] mt-1">{postings.length} total postings</p>
        </div>
        {/* ── Create button — tour target ───────────────────────────── */}
        <button id="tour-create-job-btn" onClick={onCreateJob} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> New Posting
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); if (!dummyJobs) setLoading(true); }}
            className={`px-4 py-2 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all ${
              filter === f
                ? 'bg-[var(--c-accent-dim)] text-[var(--c-accent)] border border-[var(--c-accent)]/30'
                : 'bg-[var(--c-surface-2)] text-[var(--c-text-mute)] border border-transparent hover:text-[var(--c-text-dim)]'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Job list — tour target ────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner !w-8 !h-8 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" />
        </div>
      ) : postings.length === 0 ? (
        <div className="text-center py-20">
          <Briefcase size={48} className="mx-auto text-[var(--c-text-mute)] mb-4" />
          <p className="text-[var(--c-text-dim)] text-[15px] font-semibold mb-2">No job postings yet</p>
          <p className="text-[var(--c-text-mute)] text-[13px] mb-6">
            Create your first job posting to start receiving applications.
          </p>
          <button onClick={onCreateJob} className="btn-primary">Create Job Posting</button>
        </div>
      ) : (
        <div id="tour-job-list" className="space-y-3">
          {postings.map((posting, i) => {
            const badge = statusBadge[posting.status] || statusBadge.draft;
            return (
              <motion.div
                key={posting._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onViewJob(posting._id)}
                className="flex items-center gap-3 sm:gap-5 p-3 sm:p-5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl sm:rounded-2xl hover:border-[var(--c-border-2)] hover:bg-[var(--c-surface-2)] transition-all cursor-pointer group"
              >
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[var(--c-accent-dim)] flex items-center justify-center flex-shrink-0">
                  <Briefcase size={18} className="text-[var(--c-accent)] sm:hidden" />
                  <Briefcase size={20} className="text-[var(--c-accent)] hidden sm:block" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                    <h3 className="text-[13px] sm:text-[15px] font-bold text-[var(--c-text)] truncate max-w-[180px] sm:max-w-none">{posting.title}</h3>
                    <span
                      className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex-shrink-0"
                      style={{ color: badge.color, background: badge.bg }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-[12px] text-[var(--c-text-mute)] flex-wrap">
                    <span className="truncate max-w-[100px] sm:max-w-none">{posting.company}</span>
                    {posting.location && <span className="hidden sm:inline">• {posting.location}</span>}
                    <span className="hidden sm:inline">• {posting.employmentType}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-6 flex-shrink-0">
                  <div className="flex items-center gap-1 sm:gap-1.5 text-[var(--c-text-dim)]">
                    <Users size={13} />
                    <span className="text-[12px] sm:text-[13px] font-semibold">{posting.applicantCount || 0}</span>
                  </div>
                  <Eye size={14} className="text-[var(--c-text-mute)] group-hover:text-[var(--c-accent)] transition-colors hidden sm:block" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
