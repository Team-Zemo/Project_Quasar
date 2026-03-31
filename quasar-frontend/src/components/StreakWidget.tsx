interface StreakWidgetProps {
  currentStreak:    number;
  longestStreak:    number;
  lastPracticeDate: string | null;
}

export function StreakWidget({ currentStreak, longestStreak, lastPracticeDate }: StreakWidgetProps) {
  const todayUTC = new Date().toISOString().slice(0, 10);
  const practicedToday = lastPracticeDate === todayUTC;
  const isHot = currentStreak >= 3;

  return (
    <div className={`streak-widget ${isHot ? 'streak-widget--hot' : ''}`}>
      <div className="streak-widget__top">
        <span className={`streak-widget__fire ${isHot ? 'streak-widget__fire--pulse' : ''}`}>
          🔥
        </span>
        <span className="streak-widget__count">{currentStreak}</span>
      </div>
      <span className="streak-widget__label">day streak</span>
      <div className="streak-widget__meta">
        <span className="streak-widget__best">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
          Best: {longestStreak}
        </span>
      </div>
      {!practicedToday && currentStreak > 0 && (
        <div className="streak-widget__warning">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Practice today!
        </div>
      )}
    </div>
  );
}
