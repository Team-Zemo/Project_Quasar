import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, FolderGit2 as Github, Code2, Star, GitFork, Globe, ExternalLink,
  Trophy, Target, Zap, BarChart3, BookOpen, Loader2, RefreshCw,
  AlertCircle, CheckCircle2, Clock, Layers, TrendingUp, Hash,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────

interface Project {
  name: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  topics: string[];
  languages: Record<string, number>;
  isForked: boolean;
}

interface LeetcodeStats {
  totalSolved: number | null;
  easySolved: number | null;
  mediumSolved: number | null;
  hardSolved: number | null;
  ranking: number | null;
  contestRating: number | null;
  contestRanking: number | null;
  contestAttended: number | null;
  topLanguages: string[];
  advancedSkills: string[];
  intermediateSkills: string[];
  fundamentalSkills: string[];
}

interface PlatformData {
  githubUrl: string | null;
  githubUsername: string | null;
  leetcodeUrl: string | null;
  leetcodeUsername: string | null;
  platformSyncStatus: 'pending' | 'syncing' | 'completed' | 'failed_fetching' | null;
  platformContext: string | null;
  leetcodeStats: LeetcodeStats | null;
  projects: Project[];
}

// ── Helpers ──────────────────────────────────────────────────────────

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

// Top-N languages from a bytes map
function topLangs(langs: Record<string, number>, n = 4): Array<{ lang: string; bytes: number; pct: number }> {
  const total = Object.values(langs).reduce((a, b) => a + b, 0);
  return Object.entries(langs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([lang, bytes]) => ({ lang, bytes, pct: Math.round((bytes / total) * 100) }));
}

// ── Sub-components ────────────────────────────────────────────────────

function SyncStatusBadge({ status }: { status: PlatformData['platformSyncStatus'] }) {
  const map = {
    completed: { label: 'Synced', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', Icon: CheckCircle2 },
    syncing:   { label: 'Syncing…', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', Icon: Loader2 },
    failed_fetching: { label: 'Failed', cls: 'bg-red-500/10 text-red-400 border-red-500/20', Icon: AlertCircle },
    pending:   { label: 'Pending', cls: 'bg-[var(--c-surface-3)] text-[var(--c-text-mute)] border-[var(--c-border)]', Icon: Clock },
  };
  const cfg = map[status ?? 'pending'] ?? map['pending'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${cfg.cls}`}>
      <cfg.Icon size={12} className={status === 'syncing' ? 'animate-spin' : ''} />
      {cfg.label}
    </span>
  );
}

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number | null; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-4 flex flex-col gap-2">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center`} style={{ background: `${color}18` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <p className="text-[13px] text-[var(--c-text-mute)] font-medium">{label}</p>
      <p className="text-[22px] font-black text-[var(--c-text)] leading-none">
        {value != null ? value.toLocaleString() : '—'}
      </p>
      {sub && <p className="text-[11px] text-[var(--c-text-mute)]">{sub}</p>}
    </div>
  );
}

function SkillPill({ label, tier }: { label: string; tier: 'advanced' | 'intermediate' | 'fundamental' }) {
  const cls = {
    advanced: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    intermediate: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    fundamental: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  }[tier];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const langs = topLangs(project.languages ?? {}, 4);
  const totalBytes = Object.values(project.languages ?? {}).reduce((a, b) => a + b, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5 flex flex-col gap-3 hover:border-[var(--c-accent)]/40 transition-colors group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--c-accent-dim)] flex items-center justify-center flex-shrink-0">
            <Github size={16} className="text-[var(--c-accent)]" />
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-[var(--c-text)] truncate">{project.name}</p>
            {project.language && (
              <p className="text-[11px] font-semibold" style={{ color: langColor(project.language) }}>
                {project.language}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {project.stars > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-[var(--c-text-mute)] font-semibold">
              <Star size={11} className="text-yellow-400" />
              {project.stars}
            </span>
          )}
          <a
            href={project.url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-accent)] hover:bg-[var(--c-accent-dim)] transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-[12px] text-[var(--c-text-dim)] leading-relaxed line-clamp-2">
          {project.description}
        </p>
      )}

      {/* Topics */}
      {project.topics?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.topics.slice(0, 6).map(t => (
            <span key={t} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--c-accent-dim)] text-[var(--c-accent)] border border-[var(--c-accent)]/20">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Language breakdown bar */}
      {langs.length > 0 && (
        <div>
          <div className="flex rounded-full overflow-hidden h-1.5 mb-2">
            {langs.map(({ lang, pct }) => (
              <div key={lang} style={{ width: `${pct}%`, background: langColor(lang) }} title={`${lang}: ${pct}%`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {langs.map(({ lang, bytes }) => (
              <span key={lang} className="flex items-center gap-1 text-[10px] text-[var(--c-text-mute)]">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: langColor(lang) }} />
                {lang}
                <span className="text-[var(--c-border-2)]">·</span>
                {formatBytes(bytes)}
              </span>
            ))}
            {totalBytes > 0 && (
              <span className="text-[10px] text-[var(--c-text-mute)] ml-auto">
                {formatBytes(totalBytes)} total
              </span>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

export function PlatformContextPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'github' | 'leetcode'>('github');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/profile', { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setData({
          githubUrl: json.data.githubUrl ?? null,
          githubUsername: json.data.githubUsername ?? null,
          leetcodeUrl: json.data.leetcodeUrl ?? null,
          leetcodeUsername: json.data.leetcodeUsername ?? null,
          platformSyncStatus: json.data.platformSyncStatus ?? null,
          platformContext: json.data.platformContext ?? null,
          leetcodeStats: json.data.leetcodeStats ?? null,
          projects: json.data.projects ?? [],
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to load platform data' });
    } finally {
      setLoading(false);
    }
  }

  async function handleResync() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/sync-platforms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: data?.githubUrl, leetcodeUrl: data?.leetcodeUrl }),
      });
      const json = await res.json();
      if (json.success) {
        setData(prev => prev ? { ...prev, platformSyncStatus: 'syncing' } : prev);
        setMessage({ type: 'success', text: 'Sync started in the background — refresh in a moment' });
      } else {
        setMessage({ type: 'error', text: json.message || 'Sync failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSyncing(false);
    }
  }

  const lc = data?.leetcodeStats;
  const hasGithub = !!data?.githubUsername && data.projects.length > 0;
  const hasLeetcode = !!data?.leetcodeUsername && !!lc;

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={28} className="animate-spin text-[var(--c-accent)]" />
      </div>
    );
  }

  // ── No platforms linked ──
  if (!data?.githubUrl && !data?.leetcodeUrl) {
    return (
      <div className="max-w-2xl mx-auto w-full">
        <button onClick={() => navigate('/profile')} className="flex items-center gap-2 text-[13px] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors mb-6">
          <ArrowLeft size={16} /> Back to Profile
        </button>
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-10 text-center">
          <Globe size={40} className="text-[var(--c-accent)] mx-auto mb-4" />
          <h2 className="text-[18px] font-bold text-[var(--c-text)] mb-2">No platforms linked yet</h2>
          <p className="text-[13px] text-[var(--c-text-dim)] mb-5">Go to your profile and add your GitHub and LeetCode URLs, then sync.</p>
          <button onClick={() => navigate('/profile')} className="btn-primary">Go to Profile</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6">

      {/* ── Back + Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-1.5 text-[12px] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors mb-3"
          >
            <ArrowLeft size={14} /> Back to Profile
          </button>
          <h1 className="text-[24px] font-black text-[var(--c-text)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--c-accent-dim)] flex items-center justify-center">
              <Layers size={20} className="text-[var(--c-accent)]" />
            </div>
            External Platforms
          </h1>
          <p className="text-[13px] text-[var(--c-text-mute)] mt-1">
            Context automatically pulled into all your interviews and Coach sessions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {data.platformSyncStatus && <SyncStatusBadge status={data.platformSyncStatus} />}
          <button
            onClick={handleResync}
            disabled={syncing || data.platformSyncStatus === 'syncing'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            Resync
          </button>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:bg-[var(--c-surface-2)] transition-all">
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Status message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold border ${
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Platform links ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.githubUrl && (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#ffffff10] flex items-center justify-center flex-shrink-0">
              <Github size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)]">GitHub</p>
              <p className="text-[14px] font-bold text-[var(--c-text)] truncate">@{data.githubUsername}</p>
            </div>
            <a href={data.githubUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-[var(--c-text-mute)] hover:text-[var(--c-accent)] transition-colors">
              <ExternalLink size={15} />
            </a>
          </div>
        )}
        {data.leetcodeUrl && (
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#FFA11620] flex items-center justify-center flex-shrink-0">
              <Code2 size={20} className="text-[#FFA116]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)]">LeetCode</p>
              <p className="text-[14px] font-bold text-[var(--c-text)] truncate">@{data.leetcodeUsername}</p>
            </div>
            <a href={data.leetcodeUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-[var(--c-text-mute)] hover:text-[#FFA116] transition-colors">
              <ExternalLink size={15} />
            </a>
          </div>
        )}
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-1 w-fit">
        {hasGithub && (
          <button
            onClick={() => setActiveTab('github')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
              activeTab === 'github'
                ? 'bg-[var(--c-accent)] text-white shadow-sm'
                : 'text-[var(--c-text-mute)] hover:text-[var(--c-text)]'
            }`}
          >
            <Github size={15} /> GitHub ({data.projects.length} repos)
          </button>
        )}
        {hasLeetcode && (
          <button
            onClick={() => setActiveTab('leetcode')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
              activeTab === 'leetcode'
                ? 'bg-[#FFA116] text-white shadow-sm'
                : 'text-[var(--c-text-mute)] hover:text-[var(--c-text)]'
            }`}
          >
            <Code2 size={15} /> LeetCode
          </button>
        )}
      </div>

      {/* ── GitHub Tab ── */}
      <AnimatePresence mode="wait">
        {activeTab === 'github' && hasGithub && (
          <motion.div key="github" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

            {/* Language summary */}
            {(() => {
              const globalBytes: Record<string, number> = {};
              data.projects.forEach(p => {
                Object.entries(p.languages ?? {}).forEach(([lang, bytes]) => {
                  globalBytes[lang] = (globalBytes[lang] || 0) + bytes;
                });
              });
              const top = topLangs(globalBytes, 8);
              if (top.length === 0) return null;
              return (
                <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5">
                  <h2 className="text-[14px] font-bold text-[var(--c-text)] mb-4 flex items-center gap-2">
                    <TrendingUp size={16} className="text-[var(--c-accent)]" /> Language Distribution (all repos)
                  </h2>
                  <div className="flex rounded-full overflow-hidden h-3 mb-4">
                    {top.map(({ lang, pct }) => (
                      <div key={lang} style={{ width: `${pct}%`, background: langColor(lang) }} title={`${lang}: ${pct}%`} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {top.map(({ lang, pct }) => (
                      <span key={lang} className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--c-text-dim)]">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: langColor(lang) }} />
                        {lang} <span className="text-[var(--c-text-mute)]">{pct}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Projects grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.projects.map((project) => (
                <ProjectCard key={project.name} project={project} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ── LeetCode Tab ── */}
        {activeTab === 'leetcode' && hasLeetcode && lc && (
          <motion.div key="leetcode" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Total Solved" value={lc.totalSolved} icon={Target} color="#FFA116" />
              <StatCard label="Global Rank" value={lc.ranking ? `#${lc.ranking.toLocaleString()}` : null} icon={Trophy} color="#ec4899" />
              <StatCard label="Contest Rating" value={lc.contestRating} icon={TrendingUp} color="#8b5cf6" />
              <StatCard label="Contests Attended" value={lc.contestAttended} icon={Hash} color="#06b6d4" />
            </div>

            {/* Easy / Medium / Hard breakdown */}
            {(lc.easySolved != null || lc.mediumSolved != null || lc.hardSolved != null) && (
              <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5">
                <h2 className="text-[14px] font-bold text-[var(--c-text)] mb-4 flex items-center gap-2">
                  <BarChart3 size={16} className="text-[#FFA116]" /> Solved by Difficulty
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Easy', value: lc.easySolved, color: '#22c55e' },
                    { label: 'Medium', value: lc.mediumSolved, color: '#FFA116' },
                    { label: 'Hard', value: lc.hardSolved, color: '#ef4444' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center p-4 rounded-xl" style={{ background: `${color}10`, border: `1px solid ${color}25` }}>
                      <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color }}>{label}</p>
                      <p className="text-[28px] font-black" style={{ color }}>{value ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Languages used */}
            {lc.topLanguages.length > 0 && (
              <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5">
                <h2 className="text-[14px] font-bold text-[var(--c-text)] mb-3 flex items-center gap-2">
                  <Code2 size={16} className="text-[#FFA116]" /> Languages Used (by problems solved)
                </h2>
                <div className="flex flex-wrap gap-2">
                  {lc.topLanguages.map(lang => (
                    <span key={lang} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[var(--c-surface-2)] text-[var(--c-text)] border border-[var(--c-border)]">
                      <span className="w-2 h-2 rounded-full" style={{ background: langColor(lang) }} />
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* DSA skill tags by tier */}
            {(lc.advancedSkills.length > 0 || lc.intermediateSkills.length > 0 || lc.fundamentalSkills.length > 0) && (
              <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5 space-y-4">
                <h2 className="text-[14px] font-bold text-[var(--c-text)] flex items-center gap-2">
                  <Zap size={16} className="text-[#FFA116]" /> DSA Skill Tags
                </h2>

                {lc.advancedSkills.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-400 mb-2">Advanced</p>
                    <div className="flex flex-wrap gap-2">
                      {lc.advancedSkills.map(s => <SkillPill key={s} label={s} tier="advanced" />)}
                    </div>
                  </div>
                )}

                {lc.intermediateSkills.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-violet-400 mb-2">Intermediate</p>
                    <div className="flex flex-wrap gap-2">
                      {lc.intermediateSkills.map(s => <SkillPill key={s} label={s} tier="intermediate" />)}
                    </div>
                  </div>
                )}

                {lc.fundamentalSkills.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-sky-400 mb-2">Fundamental</p>
                    <div className="flex flex-wrap gap-2">
                      {lc.fundamentalSkills.map(s => <SkillPill key={s} label={s} tier="fundamental" />)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Contest info */}
            {lc.contestRating != null && (
              <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-5">
                <h2 className="text-[14px] font-bold text-[var(--c-text)] mb-3 flex items-center gap-2">
                  <Trophy size={16} className="text-violet-400" /> Contest Summary
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Rating', value: lc.contestRating, color: '#8b5cf6' },
                    { label: 'Global Rank', value: lc.contestRanking ? `#${lc.contestRanking.toLocaleString()}` : null, color: '#ec4899' },
                    { label: 'Attended', value: lc.contestAttended, color: '#06b6d4' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center p-4 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border)]">
                      <p className="text-[11px] font-bold uppercase tracking-wider mb-1 text-[var(--c-text-mute)]">{label}</p>
                      <p className="text-[20px] font-black" style={{ color }}>{value ?? '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pending / failed state ── */}
      {data.platformSyncStatus === 'pending' && !data.platformContext && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-8 text-center">
          <Clock size={32} className="text-[var(--c-text-mute)] mx-auto mb-3" />
          <p className="text-[14px] font-bold text-[var(--c-text)] mb-1">Sync not yet run</p>
          <p className="text-[12px] text-[var(--c-text-mute)] mb-4">Click "Resync" to fetch your GitHub projects and LeetCode stats.</p>
          <button onClick={handleResync} disabled={syncing} className="btn-primary flex items-center gap-2 mx-auto">
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Start Sync
          </button>
        </div>
      )}

      {data.platformSyncStatus === 'failed_fetching' && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-bold text-red-400">Last sync failed</p>
            <p className="text-[12px] text-[var(--c-text-mute)] mt-1">Check that your profile URLs are correct and try resyncing. GitHub requires a valid public username, LeetCode requires a public profile.</p>
          </div>
        </div>
      )}
    </div>
  );
}
