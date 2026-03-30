const Session = require('../models/Session');
const Persona = require('../models/Persona');
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

    const session = await Session.create({
      userId: userId || null,
      domain,
      personaId: personaId || null,
      jdSessionId: jdSessionId || null,
      status: 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'Session created',
      data: {
        id: session._id,
        user_id: session.userId,
        domain: session.domain,
        persona_id: session.personaId,
        status: session.status,
        started_at: session.startedAt,
      }
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

    const session = await Session.findByIdAndUpdate(
      sessionId,
      {
        status: 'completed',
        overallScore: overallScore || null,
        starScores: starScores || {},
        clarityScore: clarityScore || null,
        transcript: transcript || '',
        durationSeconds: durationSeconds || 0,
        endedAt: new Date(),
      },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Session ended',
      data: session
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

    const session = await Session.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    // Fetch persona info if available
    let personaName = null;
    let personaDescription = null;
    if (session.personaId) {
      const persona = await Persona.findById(session.personaId).lean();
      if (persona) {
        personaName = persona.name;
        personaDescription = persona.description;
      }
    }

    return res.json({
      success: true,
      message: 'Session retrieved',
      data: { ...session, persona_name: personaName, persona_description: personaDescription }
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

    const sessions = await Session.find({ userId }).sort({ createdAt: -1 }).lean();

    // Attach persona names
    const personaIds = [...new Set(sessions.map(s => s.personaId).filter(Boolean))];
    const personas = personaIds.length > 0
      ? await Persona.find({ _id: { $in: personaIds } }).lean()
      : [];
    const personaMap = {};
    personas.forEach(p => { personaMap[p._id] = p.name; });

    const result = sessions.map(s => ({
      id: s._id,
      domain: s.domain,
      persona_name: personaMap[s.personaId] || null,
      status: s.status,
      overall_score: s.overallScore,
      star_scores: s.starScores,
      clarity_score: s.clarityScore,
      duration_seconds: s.durationSeconds,
      started_at: s.startedAt,
      ended_at: s.endedAt,
    }));

    return res.json({
      success: true,
      message: 'Sessions retrieved',
      data: result
    });
  } catch (err) {
    logger.error('Get user sessions error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get sessions', data: null });
  }
}

/**
 * Store emotion metrics for a session
 */
async function saveEmotionMetrics(req, res) {
  try {
    const { sessionId } = req.params;
    const { metrics } = req.body;

    if (!Array.isArray(metrics)) {
      return res.status(400).json({ success: false, message: 'metrics must be an array', data: null });
    }

    const session = await Session.findByIdAndUpdate(
      sessionId,
      { emotionMetrics: metrics },
      { new: true }
    );

    if (!session) {
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

    const session = await Session.findById(sessionId).select('emotionMetrics').lean();

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Emotion metrics retrieved',
      data: session.emotionMetrics || []
    });
  } catch (err) {
    logger.error('Get emotion metrics error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get emotion metrics', data: null });
  }
}

module.exports = { createSession, endSession, getSession, getUserSessions, saveEmotionMetrics, getEmotionMetrics };
