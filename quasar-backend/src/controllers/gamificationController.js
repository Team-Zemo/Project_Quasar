const UserStats = require('../models/UserStats');
const { LEVELS, ALL_BADGES } = require('../services/gamificationService');
const logger = require('../utils/logger');

/**
 * GET /api/users/:userId/stats
 * Full XP / level / streak / badge profile for a user.
 * Requester must be the owner of the stats.
 */
async function getUserStats(req, res) {
  try {
    const { userId } = req.params;

    if (req.user.id !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden', data: null });
    }

    let stats = await UserStats.findOne({ userId }).lean();

    // Return sensible defaults if no stats doc has been created yet
    if (!stats) {
      stats = {
        xp: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        lastPracticeDate: null,
        totalSessions: 0,
        badges: [],
        domainsPlayed: [],
        personasUsed: [],
        jdsParsed: 0,
        resumeComparesRun: 0,
      };
    }

    const xp    = stats.xp    || 0;
    const level = stats.level || 1;
    // LEVELS is 0-indexed; LEVELS[level] is the XP threshold for (level + 1)
    const nextThreshold = level < LEVELS.length ? LEVELS[level] : null;
    const xpToNextLevel = nextThreshold !== null ? nextThreshold - xp : null;

    return res.json({
      success: true,
      message: 'Stats retrieved',
      data: {
        xp,
        level,
        xpToNextLevel,
        currentStreak:    stats.currentStreak    || 0,
        longestStreak:    stats.longestStreak    || 0,
        lastPracticeDate: stats.lastPracticeDate || null,
        totalSessions:    stats.totalSessions    || 0,
        badges:           stats.badges           || [],
        domainsPlayed:    stats.domainsPlayed    || [],
        personasUsed:     stats.personasUsed     || [],
        jdsParsed:        stats.jdsParsed        || 0,
        resumeComparesRun: stats.resumeComparesRun || 0,
      },
    });
  } catch (err) {
    logger.error('Get user stats error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get stats', data: null });
  }
}

/**
 * GET /api/users/:userId/badges
 * Returns all 25 badges with unlocked/locked status.
 */
async function getUserBadges(req, res) {
  try {
    const { userId } = req.params;

    if (req.user.id !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden', data: null });
    }

    const stats = await UserStats.findOne({ userId }).select('badges').lean();
    const earned = stats?.badges || [];

    // Build full catalogue with unlock status
    const catalogue = Object.entries(ALL_BADGES).map(([id, meta]) => {
      const match = earned.find(b => b.id === id);
      return {
        id,
        ...meta,
        unlocked:   !!match,
        unlockedAt: match?.unlockedAt || null,
      };
    });

    return res.json({
      success: true,
      message: 'Badges retrieved',
      data: {
        earned: earned.length,
        total:  catalogue.length,
        badges: catalogue,
      },
    });
  } catch (err) {
    logger.error('Get user badges error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get badges', data: null });
  }
}

module.exports = { getUserStats, getUserBadges };
