'use strict';

/**
 * gamificationService.js
 *
 * Core XP, streak and badge logic for Interview Quasar.
 * All functions are pure / side-effect-free except processSession / onJDParsed / onResumeCompare.
 * Errors inside processSession are swallowed — gamification must never block a main response.
 */

const UserStats   = require('../models/UserStats');
const SpeechMetrics = require('../models/SpeechMetrics');
const Session     = require('../models/Session');
const logger      = require('../utils/logger');

// ── Level Thresholds (index = level-1, value = XP required) ──────────────────
const LEVELS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000];
// Level  1: 0   2: 100  3: 250  4: 500  5: 900
// Level  6: 1400 7: 2000 8: 2800 9: 3800 10: 5000+

function computeLevel(xp) {
  let level = 1;
  for (let i = LEVELS.length - 1; i >= 1; i--) {
    if (xp >= LEVELS[i]) { level = i + 1; break; }
  }
  return Math.min(level, LEVELS.length); // cap at 10
}

function xpToNextLevel(xp) {
  const level = computeLevel(xp);
  if (level >= LEVELS.length) return null; // already max level
  return LEVELS[level] - xp; // LEVELS[level] is threshold for (level+1) since array is 0-indexed
}

// ── Streak helpers ────────────────────────────────────────────────────────────
function todayUTCDate() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function yesterdayUTCDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns updated streak fields based on lastPracticeDate.
 * Does NOT mutate anything — returns a plain object.
 */
function computeStreak(stats) {
  const today     = todayUTCDate();
  const yesterday = yesterdayUTCDate();
  const last      = stats.lastPracticeDate;

  let { currentStreak = 0, longestStreak = 0 } = stats;

  if (last === today) {
    // Already counted today — no change
  } else if (last === yesterday) {
    currentStreak += 1;
  } else {
    currentStreak = 1; // first session or missed a day
  }

  longestStreak = Math.max(longestStreak, currentStreak);
  return { currentStreak, longestStreak, lastPracticeDate: today };
}

// ── XP Computation ────────────────────────────────────────────────────────────
/**
 * Pure function: given session data + new streak value, returns XP breakdown.
 * @param {object} session  - { overallScore, durationSeconds, jdSessionId, personaId }
 * @param {number} newStreak - streak value AFTER today's update
 * @returns {{ total: number, breakdown: Array<{event: string, xp: number}> }}
 */
function computeXP(session, newStreak) {
  const breakdown = [];
  const push = (event, xp) => breakdown.push({ event, xp });

  push('Session complete', 20);

  const score = parseFloat(session.overallScore) || 0;
  if (score >= 6.5) push('Pass (≥ 6.5)', 30);
  if (score >= 8.0) push('Excellent (≥ 8.0)', 20);

  const durationMins = Math.floor((session.durationSeconds || 0) / 60);
  const durationBonus = Math.floor(durationMins / 10) * 5;
  if (durationBonus > 0) push(`Duration bonus (${durationMins} min)`, durationBonus);

  if (session.jdSessionId) push('Used JD', 10);
  if (session.personaId)   push('Used Persona', 10);

  if (newStreak >= 7)      push('7-day streak bonus', 30);
  else if (newStreak >= 3) push('3-day streak bonus', 15);

  return { total: breakdown.reduce((s, b) => s + b.xp, 0), breakdown };
}

// ── Badge Catalogue ───────────────────────────────────────────────────────────
const ALL_BADGES = {
  // ── Session milestones
  first_session:     { name: 'First Step',       description: 'Completed your first interview session',             icon: '🎯' },
  ten_sessions:      { name: 'Consistent',        description: 'Completed 10 interview sessions',                   icon: '📈' },
  fifty_sessions:    { name: 'Dedicated',         description: 'Completed 50 interview sessions',                   icon: '💪' },
  century:           { name: 'Centurion',          description: 'Completed 100 interview sessions',                  icon: '🏆' },

  // ── Score-based
  first_pass:        { name: 'Passmark',           description: 'Scored ≥ 6.5 for the first time',                  icon: '✅' },
  high_achiever:     { name: 'High Achiever',      description: 'Scored ≥ 8.0 in a session',                        icon: '⭐' },
  perfect_ten:       { name: 'Perfect Ten',        description: 'Scored ≥ 9.5 in a session',                        icon: '💯' },
  comeback_kid:      { name: 'Comeback Kid',       description: 'Scored ≥ 7.0 right after scoring below 5.0',       icon: '↩️' },

  // ── Streaks
  streak_3:          { name: 'On Fire',            description: 'Maintained a 3-day practice streak',               icon: '🔥' },
  streak_7:          { name: 'Week Warrior',       description: 'Maintained a 7-day practice streak',               icon: '⚡' },
  streak_14:         { name: 'Fortnight',          description: 'Maintained a 14-day practice streak',              icon: '🌟' },
  streak_30:         { name: 'Unstoppable',        description: 'Maintained a 30-day practice streak',              icon: '🚀' },

  // ── Domain variety
  domain_explorer:   { name: 'Domain Explorer',   description: 'Practiced in 3 different domains',                  icon: '🗺️' },
  polymath:          { name: 'Polymath',           description: 'Practiced in 5 different domains',                  icon: '🧠' },

  // ── Persona variety
  persona_collector: { name: 'Face the Panel',    description: 'Completed sessions with all 4 personas',            icon: '🎭' },

  // ── Speech
  no_fillers:        { name: 'Clean Speaker',     description: 'Completed a session with fewer than 3 filler words', icon: '🗣️' },
  speed_demon:       { name: 'Speed Demon',       description: 'Spoke at over 150 words per minute',                icon: '💨' },
  slow_and_steady:   { name: 'Measured',          description: 'Spoke at 120–150 words per minute',                 icon: '⏱️' },

  // ── XP / Level
  level_5:           { name: 'Rising Star',       description: 'Reached Level 5',                                   icon: '🌠' },
  level_10:          { name: 'Interview Master',  description: 'Reached Level 10',                                  icon: '👑' },
  xp_500:            { name: 'XP Farmer',         description: 'Earned 500 total XP',                               icon: '💰' },

  // ── Time-based (UTC hour)
  night_owl:         { name: 'Night Owl',         description: 'Completed a session between 22:00–04:00 UTC',       icon: '🦉' },
  early_bird:        { name: 'Early Bird',        description: 'Completed a session between 05:00–07:00 UTC',       icon: '🐦' },

  // ── Feature
  resume_checker:    { name: 'Resume Analyst',    description: 'Used the Resume vs JD comparison feature',          icon: '📄' },
  jd_parser:         { name: 'JD Whisperer',      description: 'Parsed 3 or more job descriptions',                 icon: '📋' },
};

const ALL_PERSONAS = ['faang_engineer', 'startup_founder', 'hr_manager', 'hostile_panel'];

/**
 * Pure function — returns badge IDs that should be awarded in this session.
 * Receives a composite snapshot of stats (already includes today's increments).
 *
 * @param {object} snap        - merged current stats + today's increments
 * @param {object} session     - session document
 * @param {object|null} speech - SpeechMetrics document or null
 * @param {number} newLevel    - level after XP award
 * @param {number|null} prevScore - overallScore of the previous completed session
 * @returns {Array} badge objects to be pushed
 */
function checkBadges(snap, session, speech, newLevel, prevScore) {
  const already = new Set((snap.badges || []).map(b => b.id));
  const toAward  = [];

  function award(id) {
    if (already.has(id) || toAward.find(b => b.id === id)) return;
    const meta = ALL_BADGES[id];
    if (meta) toAward.push({ id, ...meta, unlockedAt: new Date() });
  }

  const score        = parseFloat(session.overallScore) || 0;
  const totalSessions = snap.totalSessions; // already incremented by caller
  const streak       = snap.currentStreak;
  const hourUTC      = new Date().getUTCHours();

  // Session milestones
  if (totalSessions >= 1)   award('first_session');
  if (totalSessions >= 10)  award('ten_sessions');
  if (totalSessions >= 50)  award('fifty_sessions');
  if (totalSessions >= 100) award('century');

  // Score
  if (score >= 6.5) award('first_pass');
  if (score >= 8.0) award('high_achiever');
  if (score >= 9.5) award('perfect_ten');
  if (score >= 7.0 && prevScore !== null && prevScore < 5.0) award('comeback_kid');

  // Streaks
  if (streak >= 3)  award('streak_3');
  if (streak >= 7)  award('streak_7');
  if (streak >= 14) award('streak_14');
  if (streak >= 30) award('streak_30');

  // Domain variety
  if (snap.domainsPlayed.length >= 3) award('domain_explorer');
  if (snap.domainsPlayed.length >= 5) award('polymath');

  // Persona variety
  if (ALL_PERSONAS.every(p => snap.personasUsed.includes(p))) award('persona_collector');

  // Speech metrics
  const fillers = speech?.totalFillers ?? null;
  const wpm     = speech?.wordsPerMinute ? parseFloat(speech.wordsPerMinute) : null;
  if (fillers !== null && fillers < 3)  award('no_fillers');
  if (wpm !== null && wpm > 150)        award('speed_demon');
  if (wpm !== null && wpm >= 120 && wpm <= 150) award('slow_and_steady');

  // Level / XP
  if (newLevel >= 5)       award('level_5');
  if (newLevel >= 10)      award('level_10');
  if (snap.xp >= 500)      award('xp_500');

  // Time-based
  if (hourUTC >= 22 || hourUTC < 4)      award('night_owl');
  if (hourUTC >= 5  && hourUTC < 7)      award('early_bird');

  // Feature counters
  if ((snap.jdsParsed || 0) >= 3) award('jd_parser');

  return toAward;
}

// ── Main entry ────────────────────────────────────────────────────────────────
/**
 * Called after a session is successfully evaluated.
 * Returns a gamification summary to be appended to the evaluate response.
 * Errors are swallowed so they never block the main response.
 */
async function processSession(userId, sessionData) {
  try {
    if (!userId) return null; // should never happen (requireAuth on evaluate)

    // Get or create stats
    let stats = await UserStats.findOne({ userId });
    if (!stats) stats = await UserStats.create({ userId });

    // Fetch speech metrics for badge checks
    const speechDoc = await SpeechMetrics.findOne({ sessionId: sessionData.sessionId }).lean();

    // Get previous session score for comeback_kid badge
    const prevSession = await Session.findOne({
      userId,
      status: 'completed',
      _id: { $ne: sessionData.sessionId },
    }).sort({ endedAt: -1 }).select('overallScore').lean();
    const prevScore = prevSession ? (parseFloat(prevSession.overallScore) || null) : null;

    // 1. Streak
    const streakResult = computeStreak(stats);

    // 2. XP
    const { total: xpEarned, breakdown: xpBreakdown } = computeXP(sessionData, streakResult.currentStreak);
    const newXp   = (stats.xp || 0) + xpEarned;
    const oldLevel = stats.level || 1;
    const newLevel = computeLevel(newXp);
    const levelUp  = newLevel > oldLevel;

    // 3. Build updated arrays for badge checks
    const domainsPlayed = [...(stats.domainsPlayed || [])];
    if (sessionData.domain && !domainsPlayed.includes(sessionData.domain)) {
      domainsPlayed.push(sessionData.domain);
    }
    const personasUsed = [...(stats.personasUsed || [])];
    if (sessionData.personaId && !personasUsed.includes(sessionData.personaId)) {
      personasUsed.push(sessionData.personaId);
    }

    const totalSessions = (stats.totalSessions || 0) + 1;

    // 4. Badge check with fully-updated snapshot
    const snap = {
      badges:           stats.badges || [],
      xp:               newXp,
      currentStreak:    streakResult.currentStreak,
      domainsPlayed,
      personasUsed,
      jdsParsed:        stats.jdsParsed || 0,
      totalSessions,
    };
    const newBadges = checkBadges(snap, sessionData, speechDoc, newLevel, prevScore);

    // 5. Persist everything
    const updateDoc = {
      xp:               newXp,
      level:            newLevel,
      currentStreak:    streakResult.currentStreak,
      longestStreak:    streakResult.longestStreak,
      lastPracticeDate: streakResult.lastPracticeDate,
      totalSessions,
      domainsPlayed,
      personasUsed,
    };
    if (newBadges.length > 0) {
      updateDoc.$push = { badges: { $each: newBadges } };
    }
    await UserStats.findByIdAndUpdate(stats._id, updateDoc);

    logger.info('Gamification processed', {
      userId: userId.toString(),
      xpEarned,
      newLevel,
      levelUp,
      newBadges: newBadges.map(b => b.id),
    });

    return {
      xpEarned,
      xpBreakdown,
      totalXp:       newXp,
      level:         newLevel,
      levelUp,
      currentStreak: streakResult.currentStreak,
      longestStreak: streakResult.longestStreak,
      newBadges:     newBadges.map(({ id, name, icon }) => ({ id, name, icon })),
    };
  } catch (err) {
    logger.error('Gamification processSession error', { err: err.message, userId });
    return null; // swallow — never block evaluate response
  }
}

/**
 * Called after a JD is successfully parsed.
 * Increments counter and checks jd_parser badge.
 * Returns { newBadge } or null.
 */
async function onJDParsed(userId) {
  try {
    if (!userId) return null;
    const stats = await UserStats.findOneAndUpdate(
      { userId },
      { $inc: { jdsParsed: 1 } },
      { upsert: true, new: true }
    );
    if ((stats.jdsParsed || 0) >= 3) {
      const already = new Set((stats.badges || []).map(b => b.id));
      if (!already.has('jd_parser')) {
        const meta = ALL_BADGES.jd_parser;
        const badge = { id: 'jd_parser', ...meta, unlockedAt: new Date() };
        await UserStats.findByIdAndUpdate(stats._id, { $push: { badges: badge } });
        logger.info('Badge unlocked', { userId: userId.toString(), badge: 'jd_parser' });
        return { newBadge: { id: 'jd_parser', name: meta.name, icon: meta.icon } };
      }
    }
  } catch (err) {
    logger.error('onJDParsed gamification error', { err: err.message });
  }
  return null;
}

/**
 * Called after a resume compare completes.
 * Increments counter; awards resume_checker badge only on the first compare.
 * Returns { newBadge } or null.
 */
async function onResumeCompare(userId) {
  try {
    if (!userId) return null;
    const stats = await UserStats.findOneAndUpdate(
      { userId },
      { $inc: { resumeComparesRun: 1 } },
      { upsert: true, new: true }
    );
    // Badge on first compare only (count is 1 after the $inc on the first call)
    if ((stats.resumeComparesRun || 0) === 1) {
      const already = new Set((stats.badges || []).map(b => b.id));
      if (!already.has('resume_checker')) {
        const meta = ALL_BADGES.resume_checker;
        const badge = { id: 'resume_checker', ...meta, unlockedAt: new Date() };
        await UserStats.findByIdAndUpdate(stats._id, { $push: { badges: badge } });
        logger.info('Badge unlocked', { userId: userId.toString(), badge: 'resume_checker' });
        return { newBadge: { id: 'resume_checker', name: meta.name, icon: meta.icon } };
      }
    }
  } catch (err) {
    logger.error('onResumeCompare gamification error', { err: err.message });
  }
  return null;
}

module.exports = {
  processSession,
  onJDParsed,
  onResumeCompare,
  computeLevel,
  xpToNextLevel,
  ALL_BADGES,
  LEVELS,
};
