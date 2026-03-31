import { useEffect, useState } from 'react';
import type { GamificationResult } from '../hooks/useGamificationStats';

interface GamificationToastProps {
  gamification: GamificationResult;
  onClose:      () => void;
}

export function GamificationToast({ gamification, onClose }: GamificationToastProps) {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 400); // wait for fade-out
    }, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`gtoast ${visible ? 'gtoast--in' : 'gtoast--out'} ${gamification.levelUp ? 'gtoast--levelup' : ''}`}>
      <button className="gtoast__close" onClick={() => { setVisible(false); setTimeout(onClose, 400); }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      {/* XP header */}
      <div className="gtoast__xp-row">
        <span className="gtoast__xp-icon">⚡</span>
        <span className="gtoast__xp-amount">+{gamification.xpEarned} XP</span>
        <span className="gtoast__level-pill">Lvl {gamification.level}</span>
      </div>

      {/* XP breakdown (collapsible) */}
      {gamification.xpBreakdown.length > 0 && (
        <div className="gtoast__breakdown-wrap">
          <button className="gtoast__expand-btn" onClick={() => setExpanded(e => !e)}>
            {expanded ? '▾ Hide details' : '▸ Show details'}
          </button>
          {expanded && (
            <ul className="gtoast__breakdown">
              {gamification.xpBreakdown.map((b, i) => (
                <li key={i} className="gtoast__breakdown-item">
                  <span>{b.event}</span>
                  <span className="gtoast__breakdown-xp">+{b.xp}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Level up indicator */}
      {gamification.levelUp && (
        <div className="gtoast__levelup-banner">
          ⭐ Level Up! You reached <strong>Level {gamification.level}</strong>
        </div>
      )}

      {/* Streak */}
      {gamification.currentStreak >= 2 && (
        <div className="gtoast__streak">
          🔥 {gamification.currentStreak}-day streak
        </div>
      )}

      {/* New badges */}
      {gamification.newBadges.length > 0 && (
        <div className="gtoast__badges">
          {gamification.newBadges.map((b, i) => (
            <div key={b.id} className="gtoast__badge" style={{ animationDelay: `${i * 200}ms` }}>
              <span className="gtoast__badge-icon">{b.icon}</span>
              <span className="gtoast__badge-text">
                <strong>{b.name}</strong> unlocked
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
