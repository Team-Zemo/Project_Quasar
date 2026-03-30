const Session = require('../models/Session');
const SpeechMetrics = require('../models/SpeechMetrics');
const logger = require('../utils/logger');

/**
 * GET /api/users/:userId/progress
 * Aggregate progress across all completed sessions
 */
async function getProgress(req, res) {
  try {
    const { userId } = req.params;

    // Get all completed sessions
    const sessionsRaw = await Session.find({ userId, status: 'completed' })
      .sort({ startedAt: 1 })
      .lean();

    // Get speech metrics for all sessions
    const sessionIds = sessionsRaw.map(s => s._id);
    const speechDocs = sessionIds.length > 0
      ? await SpeechMetrics.find({ sessionId: { $in: sessionIds } }).lean()
      : [];
    const speechMap = {};
    speechDocs.forEach(sm => { speechMap[sm.sessionId.toString()] = sm; });

    const sessions = sessionsRaw.map(row => {
      const starScores = row.starScores || {};
      const emotionMetrics = row.emotionMetrics || [];
      const sm = speechMap[row._id.toString()] || {};

      // Calculate confidence average from emotion metrics
      let confidenceAvg = 0;
      if (emotionMetrics.length > 0) {
        const sum = emotionMetrics.reduce((acc, m) => acc + (m.confidence || 0), 0);
        confidenceAvg = Math.round(sum / emotionMetrics.length);
      }

      // Calculate filler rate (per minute)
      const durationMinutes = (row.durationSeconds || 0) / 60;
      const fillerRate = durationMinutes > 0 ? parseFloat(((sm.totalFillers || 0) / durationMinutes).toFixed(1)) : 0;

      return {
        sessionId: row._id,
        date: row.startedAt,
        overallScore: parseFloat(row.overallScore) || 0,
        starScores: {
          situation: starScores.situation || 0,
          task: starScores.task || 0,
          action: starScores.action || 0,
          result: starScores.result || 0
        },
        clarityScore: parseFloat(row.clarityScore) || 0,
        fillerRate,
        confidenceAvg,
        domain: row.domain,
        personaId: row.personaId
      };
    });

    // Calculate improvement metrics
    let improvement = {
      clarityDelta: 'No data yet',
      strongestDimension: 'N/A',
      weakestDimension: 'N/A'
    };

    if (sessions.length >= 1) {
      // Find strongest and weakest STAR dimensions (works from 1 session)
      const dimensionTotals = { situation: 0, task: 0, action: 0, result: 0 };
      sessions.forEach(s => {
        dimensionTotals.situation += s.starScores.situation;
        dimensionTotals.task += s.starScores.task;
        dimensionTotals.action += s.starScores.action;
        dimensionTotals.result += s.starScores.result;
      });

      const dimensions = Object.entries(dimensionTotals).map(([key, total]) => ({
        key,
        avg: total / sessions.length
      }));

      dimensions.sort((a, b) => b.avg - a.avg);
      improvement.strongestDimension = dimensions[0].key;
      improvement.weakestDimension = dimensions[dimensions.length - 1].key;

      // Calculate clarity delta
      if (sessions.length === 1) {
        const score = sessions[0].clarityScore;
        improvement.clarityDelta = `${score.toFixed(1)}/10 (first session)`;
      } else {
        const latest = sessions[sessions.length - 1];
        const previous = sessions.slice(0, -1);
        const prevAvgClarity = previous.reduce((a, s) => a + s.clarityScore, 0) / previous.length;
        const delta = (latest.clarityScore - prevAvgClarity).toFixed(1);
        improvement.clarityDelta = `${delta >= 0 ? '+' : ''}${delta} vs previous ${previous.length} session${previous.length > 1 ? 's' : ''}`;
      }
    }

    return res.json({
      success: true,
      message: 'Progress retrieved',
      data: {
        sessions,
        improvement,
        totalSessions: sessions.length
      }
    });
  } catch (err) {
    logger.error('Get progress error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get progress', data: null });
  }
}

module.exports = { getProgress };
