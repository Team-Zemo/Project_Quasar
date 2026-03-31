import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useGamificationStats } from '../hooks/useGamificationStats';
import { XPBar } from './XPBar';
import { StreakWidget } from './StreakWidget';
import { BadgeGrid } from './BadgeGrid';
import { SessionHistory } from './SessionHistory';

type Tab = 'overview' | 'badges' | 'activity';

export function StatsPage() {
  const { user } = useAuth();
  const { stats, badges, loading } = useGamificationStats(user?.id);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (loading || !stats) {
    return (
      <div className="stats-page">
        <div className="progress-loading">
          <div className="spinner" />
          <p>Loading your stats…</p>
        </div>
      </div>
    );
  }

  const recentBadges = [...(stats.badges || [])]
    .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
    .slice(0, 4);

  const earnedCount = badges.filter(b => b.unlocked).length;

  return (
    <div className="stats-page">
      {/* ── Header cards ── */}
      <div className="stats-header-row">
        <div className="stats-hero-card">
          <XPBar xp={stats.xp} level={stats.level} xpToNext={stats.xpToNextLevel} />
          <div className="stats-hero-meta">
            <div className="stats-hero-stat">
              <span className="stats-hero-stat__value">{stats.totalSessions}</span>
              <span className="stats-hero-stat__label">Sessions</span>
            </div>
            <div className="stats-hero-stat">
              <span className="stats-hero-stat__value">{earnedCount}/{badges.length}</span>
              <span className="stats-hero-stat__label">Badges</span>
            </div>
            <div className="stats-hero-stat">
              <span className="stats-hero-stat__value">{stats.domainsPlayed.length}</span>
              <span className="stats-hero-stat__label">Domains</span>
            </div>
          </div>
        </div>

        <StreakWidget
          currentStreak={stats.currentStreak}
          longestStreak={stats.longestStreak}
          lastPracticeDate={stats.lastPracticeDate}
        />
      </div>

      {/* ── Tabs ── */}
      <div className="stats-tabs">
        {(['overview', 'badges', 'activity'] as Tab[]).map(tab => (
          <button
            key={tab}
            className={`stats-tab ${activeTab === tab ? 'stats-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'overview' && '📊 '}
            {tab === 'badges' && '🏆 '}
            {tab === 'activity' && '📋 '}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="stats-tab-content">
        {activeTab === 'overview' && (
          <>
            {/* Key stat cards */}
            <div className="stats-key-grid">
              <div className="stats-key-card">
                <div className="stats-key-card__icon">⚡</div>
                <div className="stats-key-card__content">
                  <span className="stats-key-card__value">{stats.xp.toLocaleString()}</span>
                  <span className="stats-key-card__label">Total XP</span>
                </div>
              </div>
              <div className="stats-key-card">
                <div className="stats-key-card__icon">📄</div>
                <div className="stats-key-card__content">
                  <span className="stats-key-card__value">{stats.jdsParsed}</span>
                  <span className="stats-key-card__label">JDs Parsed</span>
                </div>
              </div>
              <div className="stats-key-card">
                <div className="stats-key-card__icon">📋</div>
                <div className="stats-key-card__content">
                  <span className="stats-key-card__value">{stats.resumeComparesRun}</span>
                  <span className="stats-key-card__label">Resume Checks</span>
                </div>
              </div>
              <div className="stats-key-card">
                <div className="stats-key-card__icon">🎭</div>
                <div className="stats-key-card__content">
                  <span className="stats-key-card__value">{stats.personasUsed.length}/4</span>
                  <span className="stats-key-card__label">Personas Used</span>
                </div>
              </div>
            </div>

            {/* Recent badges */}
            {recentBadges.length > 0 && (
              <div className="stats-recent-badges">
                <h3 className="stats-section-title">Recently Unlocked</h3>
                <div className="stats-recent-badges-row">
                  {recentBadges.map(b => (
                    <div key={b.id} className="stats-recent-badge">
                      <span className="stats-recent-badge__icon">{b.icon}</span>
                      <div className="stats-recent-badge__info">
                        <strong>{b.name}</strong>
                        <span>{b.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Domains played */}
            {stats.domainsPlayed.length > 0 && (
              <div className="stats-domains">
                <h3 className="stats-section-title">Domains Explored</h3>
                <div className="stats-domain-tags">
                  {stats.domainsPlayed.map(d => (
                    <span key={d} className="stats-domain-tag">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'badges' && (
          <div className="stats-badges-tab">
            <div className="stats-badges-header">
              <h3 className="stats-section-title">Achievement Badges</h3>
              <span className="stats-badges-count">{earnedCount} of {badges.length} unlocked</span>
            </div>
            <BadgeGrid badges={badges} />
          </div>
        )}

        {activeTab === 'activity' && (
          <SessionHistory />
        )}
      </div>
    </div>
  );
}
