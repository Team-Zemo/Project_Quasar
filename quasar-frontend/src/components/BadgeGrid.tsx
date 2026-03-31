import type { BadgeEntry } from '../hooks/useGamificationStats';

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

export function BadgeGrid({ badges }: BadgeGridProps) {
  return (
    <div className="badge-grid">
      {badges.map((badge) => {
        const color = getCategoryColor(badge.id);
        return (
          <div
            key={badge.id}
            className={`badge-card ${badge.unlocked ? 'badge-card--unlocked' : 'badge-card--locked'}`}
            style={badge.unlocked ? { '--badge-color': color } as React.CSSProperties : undefined}
          >
            <span className="badge-card__icon">{badge.icon}</span>
            <span className="badge-card__name">{badge.name}</span>
            <span className="badge-card__desc">{badge.description}</span>
            {badge.unlocked && badge.unlockedAt ? (
              <span className="badge-card__date">
                {new Date(badge.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            ) : (
              <span className="badge-card__locked">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Locked
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
