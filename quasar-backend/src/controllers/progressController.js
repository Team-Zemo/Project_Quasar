const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /api/users/:userId/progress
 * Aggregate progress across all completed sessions
 */
async function getProgress(req, res) {
  try {
    const { userId } = req.params;

    // Get all completed sessions with speech metrics
    const sessionsResult = await pool.query(
      `SELECT s.id as session_id, s.started_at as date, s.overall_score,
              s.star_scores, s.clarity_score, s.emotion_metrics, s.duration_seconds,
              s.persona_id, s.domain,
              sm.total_fillers, sm.words_per_minute
       FROM sessions s
       LEFT JOIN speech_metrics sm ON sm.session_id = s.id
       WHERE s.user_id = $1 AND s.status = 'completed'
       ORDER BY s.started_at ASC`,
      [userId]
    );

    const sessions = sessionsResult.rows.map(row => {
      const starScores = row.star_scores || {};
      const emotionMetrics = row.emotion_metrics || [];

      // Calculate confidence average from emotion metrics
      let confidenceAvg = 0;
      if (emotionMetrics.length > 0) {
        const sum = emotionMetrics.reduce((acc, m) => acc + (m.confidence || 0), 0);
        confidenceAvg = Math.round(sum / emotionMetrics.length);
      }

      // Calculate filler rate (per minute)
      const durationMinutes = (row.duration_seconds || 0) / 60;
      const fillerRate = durationMinutes > 0 ? parseFloat(((row.total_fillers || 0) / durationMinutes).toFixed(1)) : 0;

      return {
        sessionId: row.session_id,
        date: row.date,
        overallScore: parseFloat(row.overall_score) || 0,
        starScores: {
          situation: starScores.situation || 0,
          task: starScores.task || 0,
          action: starScores.action || 0,
          result: starScores.result || 0
        },
        clarityScore: parseFloat(row.clarity_score) || 0,
        fillerRate,
        confidenceAvg,
        domain: row.domain,
        personaId: row.persona_id
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
        // With only 1 session, show the raw clarity score
        const score = sessions[0].clarityScore;
        improvement.clarityDelta = `${score.toFixed(1)}/10 (first session)`;
      } else {
        // Compare most recent session to the average of all previous sessions
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
