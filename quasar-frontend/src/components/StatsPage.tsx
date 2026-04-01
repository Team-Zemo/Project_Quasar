import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGamificationStats } from '../hooks/useGamificationStats';
import { XPBar } from './XPBar';
import { StreakWidget } from './StreakWidget';
import { BadgeGrid } from './BadgeGrid';
import { SessionHistory } from './SessionHistory';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { 
  BarChart3, Trophy, Activity, Zap, FileText, FileCheck, Users, Loader2
} from 'lucide-react';
import { getBadgeLucideIcon } from '../lib/badgeIcons';

type Tab = 'overview' | 'badges' | 'activity';

export function StatsPage() {
  const { user } = useAuth();
  const { stats, badges, loading } = useGamificationStats(user?.id);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  if (loading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-[var(--c-text-dim)]">
          <Loader2 className="animate-spin text-[var(--c-accent)]" size={32} />
          <p className="text-[15px] font-medium">Loading your stats…</p>
        </div>
      </div>
    );
  }

  const recentBadges = [...(stats.badges || [])]
    .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
    .slice(0, 4);

  const earnedCount = badges.filter(b => b.unlocked).length;

  return (
    <motion.div 
      variants={containerVariants} initial="hidden" animate="show"
      className="flex flex-col gap-8 w-full max-w-[1200px] mx-auto min-h-full"
      style={{ padding: '32px 24px 64px 24px' }}
    >
      {/* ── Header cards ── */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-stretch w-full">
        <div 
          className="flex flex-col gap-6 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm w-full"
          style={{ padding: '28px' }}
        >
          <XPBar xp={stats.xp} level={stats.level} xpToNext={stats.xpToNextLevel} />
          <div className="flex flex-wrap gap-8 items-center pt-2">
            <div className="flex flex-col gap-1">
              <span className="text-[24px] font-black text-[var(--c-text)] leading-none">{stats.totalSessions}</span>
              <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">Sessions</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[24px] font-black text-[var(--c-text)] leading-none">{earnedCount}<span className="text-[14px] text-[var(--c-text-dim)] font-medium">/{badges.length}</span></span>
              <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">Badges</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[24px] font-black text-[var(--c-text)] leading-none">{stats.domainsPlayed.length}</span>
              <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">Domains</span>
            </div>
          </div>
        </div>

        <StreakWidget
          currentStreak={stats.currentStreak}
          longestStreak={stats.longestStreak}
          lastPracticeDate={stats.lastPracticeDate}
        />
      </motion.div>

      {/* ── Tabs ── */}
      <motion.div 
        variants={itemVariants} 
        className="flex gap-2 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] w-full overflow-x-auto [scrollbar-width:none]"
        style={{ padding: '6px' }}
      >
        {(['overview', 'badges', 'activity'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`flex-1 flex justify-center items-center gap-2 rounded-[12px] text-[14px] font-bold transition-all duration-200 outline-none whitespace-nowrap min-w-[120px] ${
              activeTab === tab 
                ? 'bg-[var(--c-surface-3)] text-[var(--c-text)] shadow-sm' 
                : 'bg-transparent text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)]'
            }`}
            style={{ padding: '10px 20px' }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && <BarChart3 size={18} strokeWidth={2.5} />}
            {tab === 'badges' && <Trophy size={18} strokeWidth={2.5} />}
            {tab === 'activity' && <Activity size={18} strokeWidth={2.5} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </motion.div>

      {/* ── Tab content ── */}
      <div className="flex flex-col gap-8 w-full">
        {activeTab === 'overview' && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-8 w-full">
            {/* Key stat cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
              <div 
                className="flex items-center gap-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] shadow-sm transition-transform hover:-translate-y-1"
                style={{ padding: '20px' }}
              >
                <div className="flex items-center justify-center min-w-[48px] h-[48px] rounded-2xl bg-[var(--c-surface-3)] text-yellow-500">
                  <Zap size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[20px] font-black text-[var(--c-text)] leading-none">{stats.xp.toLocaleString()}</span>
                  <span className="text-[12px] font-semibold text-[var(--c-text-mute)]">Total XP</span>
                </div>
              </div>
              <div 
                className="flex items-center gap-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] shadow-sm transition-transform hover:-translate-y-1"
                style={{ padding: '20px' }}
              >
                <div className="flex items-center justify-center min-w-[48px] h-[48px] rounded-2xl bg-[var(--c-surface-3)] text-blue-400">
                  <FileText size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[20px] font-black text-[var(--c-text)] leading-none">{stats.jdsParsed}</span>
                  <span className="text-[12px] font-semibold text-[var(--c-text-mute)]">JDs Parsed</span>
                </div>
              </div>
              <div 
                className="flex items-center gap-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] shadow-sm transition-transform hover:-translate-y-1"
                style={{ padding: '20px' }}
              >
                <div className="flex items-center justify-center min-w-[48px] h-[48px] rounded-2xl bg-[var(--c-surface-3)] text-green-400">
                  <FileCheck size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[20px] font-black text-[var(--c-text)] leading-none">{stats.resumeComparesRun}</span>
                  <span className="text-[12px] font-semibold text-[var(--c-text-mute)]">Resume Checks</span>
                </div>
              </div>
              <div 
                className="flex items-center gap-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] shadow-sm transition-transform hover:-translate-y-1"
                style={{ padding: '20px' }}
              >
                <div className="flex items-center justify-center min-w-[48px] h-[48px] rounded-2xl bg-[var(--c-surface-3)] text-purple-400">
                  <Users size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[20px] font-black text-[var(--c-text)] leading-none">{stats.personasUsed.length}<span className="text-[14px] text-[var(--c-text-dim)] font-medium">/4</span></span>
                  <span className="text-[12px] font-semibold text-[var(--c-text-mute)]">Personas Used</span>
                </div>
              </div>
            </motion.div>

            {/* Recent badges */}
            {recentBadges.length > 0 && (
              <motion.div variants={itemVariants} className="flex flex-col gap-4 w-full">
                <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0">Recently Unlocked</h3>
                {/* Replaced ugly horizontal scroll with a responsive 2x2 or 4x1 grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                  {recentBadges.map(b => (
                    <div 
                      key={b.id} 
                      className="flex items-center gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] shadow-sm"
                      style={{ padding: '16px' }}
                    >
                      <div className="flex items-center justify-center w-[44px] h-[44px] rounded-[12px] bg-[var(--c-surface-2)] shrink-0 text-[var(--c-accent)]">
                        {getBadgeLucideIcon(b.icon, b.id, 24)}
                      </div>
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        <strong className="text-[14px] font-bold text-[var(--c-text)] truncate">{b.name}</strong>
                        <span className="text-[11px] text-[var(--c-text-dim)] truncate">{b.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Domains played */}
            {stats.domainsPlayed.length > 0 && (
              <motion.div variants={itemVariants} className="flex flex-col gap-4 w-full">
                <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0">Domains Explored</h3>
                <div className="flex flex-wrap gap-2.5 w-full">
                  {stats.domainsPlayed.map(d => (
                    <span 
                      key={d} 
                      className="rounded-full text-[13px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-sm"
                      style={{ padding: '6px 16px' }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {activeTab === 'badges' && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-6 w-full">
            <div className="flex justify-between items-end w-full">
              <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0">Achievement Badges</h3>
              <span 
                className="text-[13px] font-bold text-[var(--c-text-dim)] bg-[var(--c-surface-3)] rounded-full"
                style={{ padding: '4px 12px' }}
              >
                {earnedCount} of {badges.length} unlocked
              </span>
            </div>
            <BadgeGrid badges={badges} />
          </motion.div>
        )}

        {activeTab === 'activity' && (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full">
             <SessionHistory />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
