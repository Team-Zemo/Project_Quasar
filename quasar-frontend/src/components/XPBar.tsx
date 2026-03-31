const LEVELS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000];

const LEVEL_COLORS: Record<number, string> = {
  1: '#6b7280', 2: '#6b7280', 3: '#6b7280',
  4: '#3b82f6', 5: '#3b82f6', 6: '#3b82f6',
  7: '#f97316', 8: '#f97316', 9: '#f97316',
  10: '#fbbf24',
};

interface XPBarProps {
  xp:       number;
  level:    number;
  xpToNext: number | null;
  compact?: boolean;
}

export function XPBar({ xp, level, xpToNext, compact }: XPBarProps) {
  const color = LEVEL_COLORS[level] || '#6b7280';
  const isMax = xpToNext === null || level >= 10;

  // Calculate progress percentage within current level
  const currentLevelThreshold = LEVELS[level - 1] ?? 0;
  const nextLevelThreshold = LEVELS[level] ?? LEVELS[LEVELS.length - 1];
  const xpInLevel = xp - currentLevelThreshold;
  const xpNeeded = nextLevelThreshold - currentLevelThreshold;
  const pct = isMax ? 100 : Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));

  if (compact) {
    return (
      <div className="xpbar xpbar--compact" title={`Level ${level} · ${xp} XP`}>
        <span className="xpbar__pill" style={{ background: color }}>
          Lvl {level}
        </span>
        <div className="xpbar__track xpbar__track--compact">
          <div
            className="xpbar__fill"
            style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}55` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="xpbar">
      <div className="xpbar__top">
        <span className="xpbar__pill" style={{ background: color }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Level {level}
        </span>
        <span className="xpbar__label">
          {isMax ? (
            <><span className="xpbar__xp-value">{xp.toLocaleString()}</span> XP · <span style={{ color: '#fbbf24' }}>MAX</span></>
          ) : (
            <><span className="xpbar__xp-value">{xp.toLocaleString()}</span> / {nextLevelThreshold.toLocaleString()} XP</>
          )}
        </span>
      </div>
      <div className="xpbar__track">
        <div
          className="xpbar__fill"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, boxShadow: `0 0 12px ${color}44` }}
        />
      </div>
    </div>
  );
}
