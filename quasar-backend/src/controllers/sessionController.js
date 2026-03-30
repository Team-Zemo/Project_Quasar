const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Create a new interview session
 */
async function createSession(req, res) {
  try {
    const { domain, personaId, jdSessionId } = req.body;
    const userId = req.user?.id;

    if (!domain) {
      return res.status(400).json({ success: false, message: 'Domain is required', data: null });
    }

    const result = await pool.query(
      `INSERT INTO sessions (user_id, domain, persona_id, jd_session_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, user_id, domain, persona_id, status, started_at`,
      [userId, domain, personaId || null, jdSessionId || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Session created',
      data: result.rows[0]
    });
  } catch (err) {
    logger.error('Create session error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to create session', data: null });
  }
}

/**
 * End a session — update status, scores, transcript, duration
 */
async function endSession(req, res) {
  try {
    const { sessionId } = req.params;
    const { overallScore, starScores, clarityScore, transcript, durationSeconds } = req.body;

    const result = await pool.query(
      `UPDATE sessions SET
        status = 'completed',
        overall_score = $1,
        star_scores = $2,
        clarity_score = $3,
        transcript = $4,
        duration_seconds = $5,
        ended_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [overallScore || null, JSON.stringify(starScores || {}), clarityScore || null, transcript || '', durationSeconds || 0, sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Session ended',
      data: result.rows[0]
    });
  } catch (err) {
    logger.error('End session error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to end session', data: null });
  }
}

/**
 * Get a session by ID
 */
async function getSession(req, res) {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(
      `SELECT s.*, p.name as persona_name, p.description as persona_description
       FROM sessions s
       LEFT JOIN personas p ON s.persona_id = p.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Session retrieved',
      data: result.rows[0]
    });
  } catch (err) {
    logger.error('Get session error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get session', data: null });
  }
}

/**
 * Get all sessions for a user
 */
async function getUserSessions(req, res) {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT s.*, p.name as persona_name
       FROM sessions s
       LEFT JOIN personas p ON s.persona_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      message: 'Sessions retrieved',
      data: result.rows
    });
  } catch (err) {
    logger.error('Get user sessions error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get sessions', data: null });
  }
}

/**
 * Store emotion metrics for a session (JSONB)
 */
async function saveEmotionMetrics(req, res) {
  try {
    const { sessionId } = req.params;
    const { metrics } = req.body;

    if (!Array.isArray(metrics)) {
      return res.status(400).json({ success: false, message: 'metrics must be an array', data: null });
    }

    const result = await pool.query(
      'UPDATE sessions SET emotion_metrics = $1 WHERE id = $2 RETURNING id',
      [JSON.stringify(metrics), sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Emotion metrics saved',
      data: { sessionId }
    });
  } catch (err) {
    logger.error('Save emotion metrics error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to save emotion metrics', data: null });
  }
}

/**
 * Get emotion metrics for a session
 */
async function getEmotionMetrics(req, res) {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(
      'SELECT emotion_metrics FROM sessions WHERE id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Emotion metrics retrieved',
      data: result.rows[0].emotion_metrics || []
    });
  } catch (err) {
    logger.error('Get emotion metrics error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get emotion metrics', data: null });
  }
}

module.exports = { createSession, endSession, getSession, getUserSessions, saveEmotionMetrics, getEmotionMetrics };
