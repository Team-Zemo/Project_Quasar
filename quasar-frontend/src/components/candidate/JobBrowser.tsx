import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Briefcase, Clock, Users, ChevronRight, CheckCircle2, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import type { JobPosting, Application } from '../../types/recruitment';

interface Props {
  onViewJob: (id: string) => void;
}

export function JobBrowser({ onViewJob }: Props) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
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
      const [jobsRes, appsRes] = await Promise.all([
        apiGet<{ jobs: JobPosting[]; total: number }>(`/api/candidate/jobs?${params.toString()}`),
        apiGet<Application[]>('/api/candidate/applications')
      ]);

      if (jobsRes.success) {
        setJobs(jobsRes.data.jobs);
        setTotal(jobsRes.data.total);
      }
      if (appsRes.success) {
        setApplications(appsRes.data);
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
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6">
      <div className="mb-10 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 text-xs font-bold mb-4">
          <Briefcase size={14} />
          Explore Opportunities
        </div>
        <h1 className="text-[36px] sm:text-[44px] font-black text-white tracking-tight mb-4">Find Your Next Role</h1>
        <p className="text-gray-400 text-[15px] sm:text-[16px] font-medium leading-relaxed max-w-2xl mx-auto">
          Discover {total} open positions across top tech companies. Get brutally honest, structured AI interviews tailored to your exact role.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-0 mb-10 bg-[var(--c-surface)] rounded-[20px] border border-[var(--c-border)] shadow-lg overflow-hidden">
        <div className="flex-1 relative flex items-center">
          <Search size={18} className="absolute left-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by title, company, or skills..."
            className="w-full pl-12 pr-4 py-4 bg-transparent text-white text-[15px] font-medium focus:outline-none placeholder:text-gray-500"
          />
        </div>
        <div className="hidden sm:block w-[1px] bg-[var(--c-border)]"></div>
        <div className="sm:hidden h-[1px] bg-[var(--c-border)] w-full"></div>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-6 py-4 bg-transparent text-white text-[14px] font-bold focus:outline-none appearance-none cursor-pointer hover:bg-white/5 transition-colors sm:min-w-[160px]"
        >
          {types.map(t => <option key={t.value} value={t.value} className="bg-[var(--c-surface-2)] text-white">{t.label}</option>)}
        </select>
      </div>

      {/* Job Cards */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="spinner !w-10 !h-10 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-24 bg-[var(--c-surface)] rounded-3xl border border-[var(--c-border)]">
          <Briefcase size={48} className="mx-auto text-[var(--c-text-mute)] mb-4" />
          <p className="text-gray-300 text-[16px] font-bold">No jobs found matching your criteria</p>
          <p className="text-gray-500 text-[14px] mt-2 font-medium">Try adjusting your search terms or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {jobs.map((job, i) => {
            const app = applications.find(a => {
              const jId = typeof a.jobPostingId === 'object' ? a.jobPostingId._id : a.jobPostingId;
              return jId === job._id;
            });

            return (
              <motion.div
                key={job._id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, ease: 'easeOut' }}
                onClick={() => {
                  if (app) {
                    navigate('/my-applications', { state: { activeAppId: app._id } });
                  } else {
                    onViewJob(job._id);
                  }
                }}
                className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] p-6 sm:p-7 hover:border-[var(--c-accent-glow)] hover:bg-[var(--c-surface-2)] hover:-translate-y-0.5 transition-all cursor-pointer group shadow-sm flex flex-col relative"
              >
                {/* Top Row: Logo & Info */}
                <div className="flex items-start justify-between">
                  <div className="flex gap-5">
                    {/* Company Logo Placeholder */}
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--c-surface-3)] to-[var(--c-border)] border border-[var(--c-border-2)] flex items-center justify-center shrink-0 shadow-inner group-hover:shadow-[0_0_15px_rgba(249,115,22,0.1)] transition-shadow">
                      <Building2 size={24} className="text-gray-400 group-hover:text-[var(--c-accent)] transition-colors" />
                    </div>
                    <div className="pt-0.5">
                      <h3 className="text-[19px] font-extrabold text-white group-hover:text-[var(--c-accent)] transition-colors leading-tight mb-1.5">
                        {job.title}
                      </h3>
                      <p className="text-[14px] text-gray-400 font-medium">
                        {job.company}
                      </p>
                    </div>
                  </div>

                  {/* Right side status / action */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                    {app ? (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[12px] font-bold tracking-wide shadow-sm">
                        <CheckCircle2 size={14} />
                        Applied
                      </div>
                    ) : (
                      <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full bg-white/5 group-hover:bg-[var(--c-accent)] transition-colors duration-300">
                        <ChevronRight size={18} className="text-gray-400 group-hover:text-white transition-colors" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Middle Row: Tags */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-gray-400 mt-5 mb-1 font-medium">
                  {job.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-gray-500" />
                      {job.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 capitalize">
                    <Briefcase size={14} className="text-gray-500" />
                    {job.employmentType.replace('-', ' ')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users size={14} className="text-gray-500" />
                    {job.applicantCount} applicants
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} className="text-gray-500" />
                    {new Date(job.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {job.salaryRange && (job.salaryRange.min || job.salaryRange.max) && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--c-success-dim)] text-green-400 border border-green-500/20 font-bold ml-1">
                      {job.salaryRange.currency} {job.salaryRange.min ? `${job.salaryRange.min/1000}k` : ''} 
                      {job.salaryRange.max ? ` - ${job.salaryRange.max/1000}k` : ''}
                    </span>
                  )}
                </div>

                {/* Bottom Row: Skills */}
                {job.parsedJd?.requiredSkills && job.parsedJd.requiredSkills.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[var(--c-border)] flex flex-wrap gap-2">
                    {job.parsedJd.requiredSkills.slice(0, 6).map((skill: string) => (
                      <span key={skill} className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-[var(--c-surface-3)]/60 text-gray-300 border border-white/5">
                        {skill}
                      </span>
                    ))}
                    {job.parsedJd.requiredSkills.length > 6 && (
                      <span className="px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-transparent border border-dashed border-gray-600">
                        +{job.parsedJd.requiredSkills.length - 6} more
                      </span>
                    )}
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
