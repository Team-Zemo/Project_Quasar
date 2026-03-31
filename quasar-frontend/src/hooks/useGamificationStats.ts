import { useState, useEffect, useCallback } from 'react';

export interface UserStats {
  xp:                number;
  level:             number;
  xpToNextLevel:     number | null;
  currentStreak:     number;
  longestStreak:     number;
  lastPracticeDate:  string | null;
  totalSessions:     number;
  badges:            { id: string; name: string; description: string; icon: string; unlockedAt: string }[];
  domainsPlayed:     string[];
  personasUsed:      string[];
  jdsParsed:         number;
  resumeComparesRun: number;
}

export interface BadgeEntry {
  id:          string;
  name:        string;
  description: string;
  icon:        string;
  unlocked:    boolean;
  unlockedAt:  string | null;
}

export interface GamificationResult {
  xpEarned:      number;
  xpBreakdown:   { event: string; xp: number }[];
  totalXp:       number;
  level:         number;
  levelUp:       boolean;
  currentStreak: number;
  longestStreak: number;
  newBadges:     { id: string; name: string; icon: string }[];
}

export function useGamificationStats(userId: string | undefined) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [badges, setBadges] = useState<BadgeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [statsRes, badgesRes] = await Promise.all([
        fetch(`/api/users/${userId}/stats`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/users/${userId}/badges`, { credentials: 'include' }).then(r => r.json()),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (badgesRes.success) setBadges(badgesRes.data.badges);
    } catch {
      // Silently fail — gamification is non-critical
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, badges, loading, refresh };
}
