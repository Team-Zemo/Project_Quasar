const SpeechMetrics = require('../models/SpeechMetrics');
const Session = require('../models/Session');
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
    const session = await Session.findById(sessionId).select('_id').lean();
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    // Upsert speech metrics
    const result = await SpeechMetrics.findOneAndUpdate(
      { sessionId },
      {
        transcript: transcript || '',
        fillerBuckets: fillerBuckets || [],
        totalFillers: totalFillers || 0,
        wordsPerMinute: wordsPerMinute || 0,
      },
      { upsert: true, new: true }
    );

    return res.json({
      success: true,
      message: 'Speech metrics saved',
      data: result
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

    const doc = await SpeechMetrics.findOne({ sessionId }).lean();

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Speech metrics not found', data: null });
    }

    return res.json({
      success: true,
      message: 'Speech metrics retrieved',
      data: doc
    });
  } catch (err) {
    logger.error('Get speech metrics error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get speech metrics', data: null });
  }
}

module.exports = { saveSpeechMetrics, getSpeechMetrics };
