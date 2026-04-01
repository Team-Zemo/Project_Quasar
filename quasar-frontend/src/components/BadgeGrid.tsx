import type { BadgeEntry } from '../hooks/useGamificationStats';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Lock } from 'lucide-react';
import { getBadgeLucideIcon } from '../lib/badgeIcons';

const CATEGORY_COLORS: Record<string, string> = {
  milestone: '#3b82f6',
  score:     '#22c55e',
  streak:    '#f97316',
  domain:    '#8b5cf6',
  persona:   '#ec4899',
  speech:    '#14b8a6',
  level:     '#fbbf24',
  special:   '#ec4899',
  feature:   '#ec4899',
};

const BADGE_CATEGORY: Record<string, string> = {
  first_session: 'milestone', ten_sessions: 'milestone',
  fifty_sessions: 'milestone', century: 'milestone',
  first_pass: 'score', high_achiever: 'score',
  perfect_ten: 'score', comeback_kid: 'score',
  streak_3: 'streak', streak_7: 'streak',
  streak_14: 'streak', streak_30: 'streak',
  domain_explorer: 'domain', polymath: 'domain',
  persona_collector: 'persona',
  no_fillers: 'speech', speed_demon: 'speech', slow_and_steady: 'speech',
  level_5: 'level', level_10: 'level', xp_500: 'level',
  night_owl: 'special', early_bird: 'special',
  resume_checker: 'feature', jd_parser: 'feature',
};

function getCategoryColor(badgeId: string): string {
  const cat = BADGE_CATEGORY[badgeId] || 'milestone';
  return CATEGORY_COLORS[cat] || '#6b7280';
}

interface BadgeGridProps {
  badges: BadgeEntry[];
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.95 },
  show: { 
    opacity: 1, y: 0, scale: 1, 
    transition: { type: 'spring', stiffness: 350, damping: 25 } 
  }
};

export function BadgeGrid({ badges }: BadgeGridProps) {
  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3"
    >
      {badges.map((badge) => {
        const color = getCategoryColor(badge.id);
        const isUnlocked = badge.unlocked;

        return (
          <motion.div
            variants={itemVariants}
            key={badge.id}
            className={`flex flex-col items-center gap-1 bg-[var(--c-surface)] border rounded-[16px] text-center transition-all duration-300 ${
              isUnlocked 
                ? 'border-[color-mix(in_srgb,var(--badge-color)_40%,transparent)] shadow-[0_0_12px_color-mix(in_srgb,var(--badge-color)_15%,transparent)] hover:-translate-y-[2px] hover:shadow-[0_4px_20px_color-mix(in_srgb,var(--badge-color)_25%,transparent)]' 
                : 'border-[var(--c-border)] grayscale opacity-[0.45]'
            }`}
            style={{ 
              ...(isUnlocked ? { '--badge-color': color } : {}),
              padding: '16px 12px' 
            } as React.CSSProperties}
          >
            <div className="flex items-center justify-center h-[40px] mb-1">
              {getBadgeLucideIcon(badge.icon, badge.id, 32)}
            </div>
            <span className="text-[13px] font-bold text-[var(--c-text)]">{badge.name}</span>
            <span className="text-[11px] text-[var(--c-text-mute)] leading-snug">{badge.description}</span>
            {isUnlocked && badge.unlockedAt ? (
              <span className="text-[10px] text-[var(--c-text-dim)] mt-1 font-medium">
                {new Date(badge.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-[3px] text-[10px] text-[var(--c-text-mute)] mt-1 font-medium">
                <Lock size={10} />
                Locked
              </span>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

