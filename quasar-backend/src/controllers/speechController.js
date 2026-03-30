const { pool } = require('../config/database');
const logger = require('../utils/logger');

/**
 * POST /api/sessions/:sessionId/speech-metrics
 * Save speech analysis data for a session
 */
async function saveSpeechMetrics(req, res) {
  try {
    const { sessionId } = req.params;
    const { transcript, fillerBuckets, totalFillers, wordsPerMinute } = req.body;

    if (!transcript && !fillerBuckets) {
      return res.status(400).json({ success: false, message: 'transcript or fillerBuckets required', data: null });
    }

    // Check session exists
    const sessionCheck = await pool.query('SELECT id FROM sessions WHERE id = $1', [sessionId]);
    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    // Upsert speech metrics
    const existing = await pool.query('SELECT id FROM speech_metrics WHERE session_id = $1', [sessionId]);

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE speech_metrics SET
          transcript = $1,
          filler_buckets = $2,
          total_fillers = $3,
          words_per_minute = $4
         WHERE session_id = $5
         RETURNING *`,
        [transcript || '', JSON.stringify(fillerBuckets || []), totalFillers || 0, wordsPerMinute || 0, sessionId]
      );
    } else {
      result = await pool.query(
        `INSERT INTO speech_metrics (session_id, transcript, filler_buckets, total_fillers, words_per_minute)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [sessionId, transcript || '', JSON.stringify(fillerBuckets || []), totalFillers || 0, wordsPerMinute || 0]
      );
    }

    return res.json({
      success: true,
      message: 'Speech metrics saved',
      data: result.rows[0]
    });
  } catch (err) {
    logger.error('Save speech metrics error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to save speech metrics', data: null });
  }
}

/**
 * GET /api/sessions/:sessionId/speech-metrics
 * Retrieve speech metrics for heatmap rendering
 */
async function getSpeechMetrics(req, res) {
  try {
    const { sessionId } = req.params;

    const result = await pool.query(
      'SELECT * FROM speech_metrics WHERE session_id = $1',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Speech metrics not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Speech metrics retrieved',
      data: result.rows[0]
    });
  } catch (err) {
    logger.error('Get speech metrics error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get speech metrics', data: null });
  }
}

module.exports = { saveSpeechMetrics, getSpeechMetrics };
