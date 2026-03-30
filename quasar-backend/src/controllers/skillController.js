const SkillVector = require('../models/SkillVector');
const Session = require('../models/Session');
const JdQuestion = require('../models/JdQuestion');
const JdSession = require('../models/JdSession');
const logger = require('../utils/logger');

// STAR dimension → skill mapping
const STAR_SKILL_MAP = {
  situation: 'communication',
  task: 'problem_structuring',
  action: 'leadership',
  result: 'result_orientation'
};

const CATEGORY_SKILL_MAP = {
  technical: 'technical_depth',
  'system-design': 'technical_depth',
  behavioural: 'communication',
  'culture-fit': 'culture_fit'
};

/**
 * POST /api/users/:userId/skill-vector/update
 * Update skill vector using exponential moving average
 */
async function updateSkillVector(req, res) {
  try {
    const { userId } = req.params;
    const { sessionId, starScores, categoryScores } = req.body;

    if (!starScores && !categoryScores) {
      return res.status(400).json({ success: false, message: 'starScores or categoryScores required', data: null });
    }

    const updates = [];

    // Map STAR scores to skills
    if (starScores) {
      for (const [dimension, score] of Object.entries(starScores)) {
        const skill = STAR_SKILL_MAP[dimension.toLowerCase()];
        if (skill && typeof score === 'number') {
          updates.push({ skill, score: Math.max(0, Math.min(10, score)) });
        }
      }
    }

    // Map category scores to skills
    if (categoryScores) {
      for (const [category, score] of Object.entries(categoryScores)) {
        const skill = CATEGORY_SKILL_MAP[category.toLowerCase()];
        if (skill && typeof score === 'number') {
          updates.push({ skill, score: Math.max(0, Math.min(10, score)) });
        }
      }
    }

    // Apply exponential moving average: newScore = 0.7 * oldScore + 0.3 * latestScore
    for (const { skill, score } of updates) {
      const existing = await SkillVector.findOne({ userId, skill });

      if (existing) {
        const oldScore = parseFloat(existing.score);
        const newScore = parseFloat((0.7 * oldScore + 0.3 * score).toFixed(2));
        const newCount = existing.attemptCount + 1;

        await SkillVector.findOneAndUpdate(
          { userId, skill },
          { score: newScore, attemptCount: newCount, lastUpdated: new Date() }
        );
      } else {
        await SkillVector.create({ userId, skill, score, attemptCount: 1 });
      }
    }

    // Return updated skill vector
    const result = await SkillVector.find({ userId }).sort({ skill: 1 }).lean();

    return res.json({
      success: true,
      message: 'Skill vector updated',
      data: result
    });
  } catch (err) {
    logger.error('Update skill vector error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to update skill vector', data: null });
  }
}

/**
 * GET /api/users/:userId/skill-vector
 * Get the user's current skill vector
 */
async function getSkillVector(req, res) {
  try {
    const { userId } = req.params;

    const result = await SkillVector.find({ userId }).sort({ skill: 1 }).lean();

    return res.json({
      success: true,
      message: 'Skill vector retrieved',
      data: result
    });
  } catch (err) {
    logger.error('Get skill vector error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get skill vector', data: null });
  }
}

/**
 * GET /api/sessions/:sessionId/next-question
 * Adaptive question selection based on skill vector + spaced repetition
 */
async function getNextQuestion(req, res) {
  try {
    const { sessionId } = req.params;

    // Get session to find user and JD
    const session = await Session.findById(sessionId).select('userId jdSessionId').lean();

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    const userId = session.userId;
    const jdSessionId = session.jdSessionId;

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Session has no user', data: null });
    }

    // Get user's skill vector
    const skills = await SkillVector.find({ userId }).sort({ score: 1 }).lean();

    // Find 2 lowest-scoring skills
    const weakestSkills = skills.slice(0, 2).map(s => s.skill);

    // Map skills back to question target_skill values
    const targetSkillTerms = new Set();
    for (const weakSkill of weakestSkills) {
      targetSkillTerms.add(weakSkill);
      // Also add reverse mappings
      for (const [dim, skill] of Object.entries(STAR_SKILL_MAP)) {
        if (skill === weakSkill) targetSkillTerms.add(dim);
      }
      for (const [cat, skill] of Object.entries(CATEGORY_SKILL_MAP)) {
        if (skill === weakSkill) targetSkillTerms.add(cat);
      }
    }

    // Build question query — prioritize from JD questions if available
    let questions;
    if (jdSessionId) {
      questions = await JdQuestion.find({ jdSessionId }).sort({ weight: -1 }).lean();
    } else {
      // Default: generic questions from any JD for this user
      const jdSessions = await JdSession.find({ userId }).select('_id').lean();
      const jdIds = jdSessions.map(j => j._id);
      questions = jdIds.length > 0
        ? await JdQuestion.find({ jdSessionId: { $in: jdIds } }).sort({ weight: -1 }).limit(50).lean()
        : [];
    }

    if (questions.length === 0) {
      return res.json({
        success: true,
        message: 'No questions available',
        data: null
      });
    }

    // Count completed sessions for spaced repetition
    const totalSessions = await Session.countDocuments({ userId, status: 'completed' });

    // Score each question
    const scored = questions.map(q => {
      let priority = q.weight || 0.5;

      // Boost if targeting weak skill
      const targetLower = (q.targetSkill || '').toLowerCase();
      if (targetSkillTerms.has(targetLower)) {
        priority += 0.3;
      }

      // Spaced repetition boost: not attempted recently + low score
      if (!q.lastAttemptedSession) {
        priority += 0.2; // Never attempted
      } else if (q.lastScore !== null && parseFloat(q.lastScore) < 6) {
        priority += 0.15;
      }

      return { ...q, priority };
    });

    // Sort by priority desc, pick top
    scored.sort((a, b) => b.priority - a.priority);
    const selected = scored[0];

    // Determine reason
    let reason = 'Highest priority question';
    const targetLower = (selected.targetSkill || '').toLowerCase();
    if (targetSkillTerms.has(targetLower)) {
      const matchedWeak = weakestSkills.find(ws => {
        if (ws === targetLower) return true;
        for (const [k, v] of Object.entries({ ...STAR_SKILL_MAP, ...CATEGORY_SKILL_MAP })) {
          if (v === ws && k === targetLower) return true;
        }
        return false;
      });
      if (matchedWeak) {
        const weakScore = skills.find(s => s.skill === matchedWeak)?.score || 5;
        reason = `Targets your weakest skill: ${matchedWeak} (score: ${weakScore}/10)`;
      }
    }

    return res.json({
      success: true,
      message: 'Next question selected',
      data: {
        question: selected.question,
        difficulty: selected.difficulty,
        targetSkill: selected.targetSkill,
        category: selected.category,
        reason,
        questionId: selected._id
      }
    });
  } catch (err) {
    logger.error('Get next question error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get next question', data: null });
  }
}

module.exports = { updateSkillVector, getSkillVector, getNextQuestion };
