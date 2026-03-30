const { pool } = require('../config/database');
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
      const existing = await pool.query(
        'SELECT score, attempt_count FROM skill_vectors WHERE user_id = $1 AND skill = $2',
        [userId, skill]
      );

      if (existing.rows.length > 0) {
        const oldScore = parseFloat(existing.rows[0].score);
        const newScore = parseFloat((0.7 * oldScore + 0.3 * score).toFixed(2));
        const newCount = existing.rows[0].attempt_count + 1;

        await pool.query(
          'UPDATE skill_vectors SET score = $1, attempt_count = $2, last_updated = NOW() WHERE user_id = $3 AND skill = $4',
          [newScore, newCount, userId, skill]
        );
      } else {
        await pool.query(
          'INSERT INTO skill_vectors (user_id, skill, score, attempt_count) VALUES ($1, $2, $3, 1)',
          [userId, skill, score]
        );
      }
    }

    // Return updated skill vector
    const result = await pool.query(
      'SELECT skill, score, attempt_count, last_updated FROM skill_vectors WHERE user_id = $1 ORDER BY skill',
      [userId]
    );

    return res.json({
      success: true,
      message: 'Skill vector updated',
      data: result.rows
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

    const result = await pool.query(
      'SELECT skill, score, attempt_count, last_updated FROM skill_vectors WHERE user_id = $1 ORDER BY skill',
      [userId]
    );

    return res.json({
      success: true,
      message: 'Skill vector retrieved',
      data: result.rows
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
    const sessionResult = await pool.query(
      'SELECT user_id, jd_session_id FROM sessions WHERE id = $1',
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    const { user_id: userId, jd_session_id: jdSessionId } = sessionResult.rows[0];

    if (!userId) {
      return res.status(400).json({ success: false, message: 'Session has no user', data: null });
    }

    // Get user's skill vector
    const skillResult = await pool.query(
      'SELECT skill, score FROM skill_vectors WHERE user_id = $1 ORDER BY score ASC',
      [userId]
    );

    const skills = skillResult.rows;

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
      const qResult = await pool.query(
        'SELECT * FROM jd_questions WHERE jd_session_id = $1 ORDER BY weight DESC',
        [jdSessionId]
      );
      questions = qResult.rows;
    } else {
      // Default: generic questions from any JD for this user
      const qResult = await pool.query(
        `SELECT q.* FROM jd_questions q
         JOIN jd_sessions jd ON q.jd_session_id = jd.id
         WHERE jd.user_id = $1
         ORDER BY q.weight DESC
         LIMIT 50`,
        [userId]
      );
      questions = qResult.rows;
    }

    if (questions.length === 0) {
      return res.json({
        success: true,
        message: 'No questions available',
        data: null
      });
    }

    // Count completed sessions for spaced repetition
    const sessionCountResult = await pool.query(
      "SELECT COUNT(*) as cnt FROM sessions WHERE user_id = $1 AND status = 'completed'",
      [userId]
    );
    const totalSessions = parseInt(sessionCountResult.rows[0].cnt);

    // Score each question
    const scored = questions.map(q => {
      let priority = q.weight || 0.5;

      // Boost if targeting weak skill
      const targetLower = (q.target_skill || '').toLowerCase();
      if (targetSkillTerms.has(targetLower)) {
        priority += 0.3;
      }

      // Spaced repetition boost: not attempted recently + low score
      if (!q.last_attempted_session) {
        priority += 0.2; // Never attempted
      } else if (q.last_score !== null && parseFloat(q.last_score) < 6) {
        priority += 0.15;
      }

      return { ...q, priority };
    });

    // Sort by priority desc, pick top
    scored.sort((a, b) => b.priority - a.priority);
    const selected = scored[0];

    // Determine reason
    let reason = 'Highest priority question';
    const targetLower = (selected.target_skill || '').toLowerCase();
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
        targetSkill: selected.target_skill,
        category: selected.category,
        reason,
        questionId: selected.id
      }
    });
  } catch (err) {
    logger.error('Get next question error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get next question', data: null });
  }
}

module.exports = { updateSkillVector, getSkillVector, getNextQuestion };
