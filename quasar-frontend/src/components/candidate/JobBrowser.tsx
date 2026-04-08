import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Briefcase, Clock, Users, ChevronRight } from 'lucide-react';
import { apiGet } from '../../lib/api';
import type { JobPosting } from '../../types/recruitment';

interface Props {
  onViewJob: (id: string) => void;
}

export function JobBrowser({ onViewJob }: Props) {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchJobs = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (typeFilter) params.set('type', typeFilter);
    params.set('page', String(page));

    try {
      const res = await apiGet<{ jobs: JobPosting[]; total: number }>(`/api/candidate/jobs?${params.toString()}`);
      if (res.success) {
        setJobs(res.data.jobs);
        setTotal(res.data.total);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchJobs(); }, [search, typeFilter, page]);

  const types = [
    { value: '', label: 'All Types' },
    { value: 'full-time', label: 'Full Time' },
    { value: 'part-time', label: 'Part Time' },
    { value: 'contract', label: 'Contract' },
    { value: 'internship', label: 'Internship' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-[var(--c-text)] tracking-tight mb-2">Find Your Next Role</h1>
        <p className="text-[var(--c-text-dim)] text-[14px]">{total} open positions</p>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--c-text-mute)]" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by title, company, or skills..."
            className="w-full pl-10 pr-4 py-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-4 py-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[13px] focus:outline-none focus:border-[var(--c-accent)]"
        >
          {types.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Job Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner !w-8 !h-8 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20">
          <Briefcase size={48} className="mx-auto text-[var(--c-text-mute)] mb-4" />
          <p className="text-[var(--c-text-dim)] text-[15px] font-semibold">No jobs found</p>
          <p className="text-[var(--c-text-mute)] text-[13px] mt-1">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job, i) => (
            <motion.div
              key={job._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onViewJob(job._id)}
              className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 hover:border-[var(--c-border-2)] hover:bg-[var(--c-surface-2)] transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-[16px] font-bold text-[var(--c-text)] group-hover:text-[var(--c-accent)] transition-colors">{job.title}</h3>
                  <p className="text-[13px] text-[var(--c-text-dim)] mt-0.5">{job.company}</p>
                </div>
                <ChevronRight size={18} className="text-[var(--c-text-mute)] group-hover:text-[var(--c-accent)] transition-colors mt-1" />
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[12px] text-[var(--c-text-mute)] mb-3">
                {job.location && (
                  <span className="flex items-center gap-1"><MapPin size={12} />{job.location}</span>
                )}
                <span className="flex items-center gap-1"><Briefcase size={12} />{job.employmentType}</span>
                <span className="flex items-center gap-1"><Users size={12} />{job.applicantCount} applicants</span>
                <span className="flex items-center gap-1"><Clock size={12} />{new Date(job.createdAt).toLocaleDateString()}</span>
              </div>

              {job.parsedJd?.requiredSkills && (
                <div className="flex flex-wrap gap-1.5">
                  {job.parsedJd.requiredSkills.slice(0, 6).map((skill: string) => (
                    <span key={skill} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--c-surface-3)] text-[var(--c-text-mute)]">
                      {skill}
                    </span>
                  ))}
                  {job.parsedJd.requiredSkills.length > 6 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold text-[var(--c-text-mute)]">
                      +{job.parsedJd.requiredSkills.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
