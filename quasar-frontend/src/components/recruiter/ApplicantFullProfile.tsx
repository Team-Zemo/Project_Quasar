import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, User as UserIcon, Mail, Phone, MapPin, Briefcase, Globe, Loader2,
  FolderGit2 as Github, Code2, ExternalLink, Star, Trophy, Target, BarChart3,
  TrendingUp, Hash, Layers, FileText
} from 'lucide-react';
import { apiGet } from '../../lib/api';

// Types derived from User model
interface ProfileData {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  headline?: string;
  location?: string;
  experience?: number;
  skills?: string[];
  resumeUrl?: string;
  githubUrl?: string;
  githubUsername?: string;
  leetcodeUrl?: string;
  leetcodeUsername?: string;
  platformSyncStatus?: string;
  leetcodeStats?: any;
  projects?: any[];
}

interface Props {
  jobId: string;
  applicationId: string;
  onBack: () => void;
}

function langColor(lang: string | null): string {
  const map: Record<string, string> = {
    TypeScript: '#3178c6', JavaScript: '#f7df1e', Python: '#3572A5',
    Java: '#b07219', 'C++': '#f34b7d', C: '#555555', Go: '#00ADD8',
    Rust: '#dea584', Ruby: '#701516', PHP: '#4F5D95', Swift: '#F05138',
    Kotlin: '#A97BFF', Dart: '#00B4AB', Shell: '#89e051', HTML: '#e34c26',
    CSS: '#563d7c', Vue: '#41b883', Svelte: '#ff3e00',
  };
  return map[lang ?? ''] ?? '#8b8fa8';
}

function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes}B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)}KB`;
  return `${(bytes / 1_000_000).toFixed(1)}MB`;
}

function topLangs(langs: Record<string, number>, n = 4) {
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([lang, bytes]) => ({ lang, bytes, pct: Math.round((bytes / total) * 100) }));
}

export function ApplicantFullProfile({ jobId, applicationId, onBack }: Props) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ data: ProfileData }>(`/api/recruiter/jobs/${jobId}/applicants/${applicationId}/profile`)
      .then(res => {
        if (res.success && res.data) {
          setProfile(res.data as unknown as ProfileData); // The API structure returns data directly
        } else {
            // Because apiGet unwraps "data" normally, let's check
            // if res itself is the data object
            setProfile(res as unknown as ProfileData);
        }
      })
      .finally(() => setLoading(false));
  }, [jobId, applicationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[var(--c-accent)]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8">
        <button onClick={onBack} className="flex items-center gap-2 text-[var(--c-text-dim)] hover:text-[var(--c-text)]">
          <ArrowLeft size={16} /> Back
        </button>
        <p className="text-[var(--c-error)] mt-4">Profile not found</p>
      </div>
    );
  }

  const hasGithub = !!profile.githubUrl && (profile.projects || []).length > 0;
  const hasLeetcode = !!profile.leetcodeUrl && !!profile.leetcodeStats;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-5"
    >
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-black text-[var(--c-text)]">{profile.name}'s Full Profile</h1>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6">
        <h2 className="text-[18px] font-black text-[var(--c-text)] mb-4 flex items-center gap-2">
          <UserIcon size={18} className="text-[var(--c-accent)]" /> Basic Info
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
          {profile.email && <p className="flex items-center gap-2 text-[var(--c-text-dim)]"><Mail size={14} /> {profile.email}</p>}
          {profile.phone && <p className="flex items-center gap-2 text-[var(--c-text-dim)]"><Phone size={14} /> {profile.phone}</p>}
          {profile.location && <p className="flex items-center gap-2 text-[var(--c-text-dim)]"><MapPin size={14} /> {profile.location}</p>}
          {profile.experience != null && <p className="flex items-center gap-2 text-[var(--c-text-dim)]"><Briefcase size={14} /> {profile.experience} years experience</p>}
        </div>
        
        {profile.resumeUrl && (
          <div className="mt-4">
            <a href={profile.resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:bg-[var(--c-surface-2)] transition-all">
              <FileText size={14} /> View Resume PDF
            </a>
          </div>
        )}

        {profile.headline && (
          <p className="mt-4 text-[14px] text-[var(--c-text-dim)] bg-[var(--c-bg)] p-3 rounded-xl border border-[var(--c-border)]">
            {profile.headline}
          </p>
        )}
        {profile.skills && profile.skills.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.skills.map(s => (
                <span key={s} className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--c-surface-3)] text-[var(--c-text-dim)]">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* GitHub Projects */}
      {hasGithub && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6">
          <h2 className="text-[18px] font-black text-[var(--c-text)] mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2"><Github size={18} className="text-[var(--c-accent)]" /> GitHub Projects</span>
            <a href={profile.githubUrl!} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--c-text-mute)] hover:text-[var(--c-accent)] flex items-center gap-1">
              View Profile <ExternalLink size={12} />
            </a>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.projects?.slice(0, 6).map(p => (
              <div key={p.name} className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between">
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-[14px] font-bold text-[var(--c-text)] hover:underline truncate mr-2">
                    {p.name}
                  </a>
                  {p.stars > 0 && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-[var(--c-text-mute)]">
                      <Star size={11} className="text-yellow-400" /> {p.stars}
                    </span>
                  )}
                </div>
                {p.description && <p className="text-[12px] text-[var(--c-text-dim)] line-clamp-2">{p.description}</p>}
                
                {(() => {
                  const langs = topLangs(p.languages || {}, 3);
                  if (langs.length === 0) return null;
                  return (
                    <div className="mt-auto pt-2">
                      <div className="flex flex-wrap gap-2">
                        {langs.map(({ lang, pct }) => (
                          <span key={lang} className="flex items-center gap-1 text-[10px] text-[var(--c-text-mute)]">
                            <span className="w-2 h-2 rounded-full" style={{ background: langColor(lang) }} />
                            {lang} ({pct}%)
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LeetCode Stats */}
      {hasLeetcode && profile.leetcodeStats && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6">
          <h2 className="text-[18px] font-black text-[var(--c-text)] mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2"><Code2 size={18} className="text-[#FFA116]" /> LeetCode Statistics</span>
            <a href={profile.leetcodeUrl!} target="_blank" rel="noreferrer" className="text-[12px] text-[var(--c-text-mute)] hover:text-[#FFA116] flex items-center gap-1">
              View Profile <ExternalLink size={12} />
            </a>
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl p-3 text-center">
              <Target size={16} className="text-[#FFA116] mx-auto mb-1" />
              <p className="text-[18px] font-black text-[var(--c-text)]">{profile.leetcodeStats.totalSolved ?? '—'}</p>
              <p className="text-[10px] uppercase font-bold text-[var(--c-text-mute)]">Total Solved</p>
            </div>
            <div className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl p-3 text-center">
              <Trophy size={16} className="text-pink-500 mx-auto mb-1" />
              <p className="text-[18px] font-black text-[var(--c-text)]">{profile.leetcodeStats.ranking ? `#${profile.leetcodeStats.ranking.toLocaleString()}` : '—'}</p>
              <p className="text-[10px] uppercase font-bold text-[var(--c-text-mute)]">Global Rank</p>
            </div>
            <div className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl p-3 text-center">
              <TrendingUp size={16} className="text-violet-500 mx-auto mb-1" />
              <p className="text-[18px] font-black text-[var(--c-text)]">{profile.leetcodeStats.contestRating ?? '—'}</p>
              <p className="text-[10px] uppercase font-bold text-[var(--c-text-mute)]">Contest Rating</p>
            </div>
            <div className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl p-3 text-center">
              <Hash size={16} className="text-cyan-500 mx-auto mb-1" />
              <p className="text-[18px] font-black text-[var(--c-text)]">{profile.leetcodeStats.contestAttended ?? '—'}</p>
              <p className="text-[10px] uppercase font-bold text-[var(--c-text-mute)]">Contests</p>
            </div>
          </div>

          {(profile.leetcodeStats.easySolved != null) && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-[11px] font-bold text-emerald-500 uppercase">Easy</p>
                <p className="text-[20px] font-black text-emerald-500">{profile.leetcodeStats.easySolved}</p>
              </div>
              <div className="bg-[#FFA11615] border border-[#FFA11630] rounded-xl p-3 text-center">
                <p className="text-[11px] font-bold text-[#FFA116] uppercase">Medium</p>
                <p className="text-[20px] font-black text-[#FFA116]">{profile.leetcodeStats.mediumSolved}</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-[11px] font-bold text-red-500 uppercase">Hard</p>
                <p className="text-[20px] font-black text-red-500">{profile.leetcodeStats.hardSolved}</p>
              </div>
            </div>
          )}

          {profile.leetcodeStats.topLanguages?.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Languages Used</p>
              <div className="flex flex-wrap gap-2">
                {profile.leetcodeStats.topLanguages.map((lang: string) => (
                  <span key={lang} className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-[var(--c-bg)] border border-[var(--c-border)] text-[var(--c-text-dim)] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: langColor(lang) }} /> {lang}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Platform Data */}
      {!hasGithub && !hasLeetcode && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-8 text-center">
          <Globe size={32} className="text-[var(--c-text-mute)] mx-auto mb-3" />
          <p className="text-[14px] font-bold text-[var(--c-text)]">No External Platforms Linked</p>
          <p className="text-[12px] text-[var(--c-text-mute)] mt-1">This candidate has not synced GitHub or LeetCode data.</p>
        </div>
      )}

    </motion.div>
  );
}
