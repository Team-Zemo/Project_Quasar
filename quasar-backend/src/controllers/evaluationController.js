const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * POST /api/sessions/:sessionId/evaluate
 * Calls Gemini to score the interview transcript, saves scores, updates skill vectors
 */
async function evaluateSession(req, res) {
  try {
    const { sessionId } = req.params;

    // Fetch session + speech transcript
    const sessionResult = await pool.query(
      `SELECT s.*, p.name as persona_name, sm.transcript as speech_transcript
       FROM sessions s
       LEFT JOIN personas p ON s.persona_id = p.id
       LEFT JOIN speech_metrics sm ON sm.session_id = s.id
       WHERE s.id = $1`,
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    const session = sessionResult.rows[0];
    const transcript = session.speech_transcript || session.transcript || '';

    if (!transcript || transcript.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient transcript for evaluation',
        data: null
      });
    }

    // Call Gemini for evaluation
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are an expert interview evaluator. Analyse this interview transcript and return ONLY valid JSON (no markdown, no code fences) in this exact schema:
{
  "overallScore": number (0-10, one decimal),
  "starScores": {
    "situation": number (0-10),
    "task": number (0-10),
    "action": number (0-10),
    "result": number (0-10),
    "conciseness": number (0-10),
    "domain_knowledge": number (0-10)
  },
  "clarityScore": number (0-10),
  "categoryScores": {
    "communication": number (0-10),
    "technical_depth": number (0-10),
    "leadership": number (0-10),
    "problem_structuring": number (0-10),
    "result_orientation": number (0-10),
    "culture_fit": number (0-10)
  },
  "strengths": [string, string, string],
  "improvements": [string, string, string],
  "summary": string (2-3 sentence assessment)
}

Domain: ${session.domain || 'General'}
Persona: ${session.persona_name || 'Default Interviewer'}

Transcript:
${transcript.substring(0, 8000)}`;

    const result = await model.generateContent(prompt);
    let responseText = result.response.text().trim();

    // Strip markdown fences if present
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    let scores;
    try {
      scores = JSON.parse(responseText);
    } catch (parseErr) {
      logger.error('Failed to parse Gemini evaluation response', { responseText, err: parseErr.message });
      return res.status(502).json({ success: false, message: 'AI returned invalid evaluation. Try again.', data: null });
    }

    // Calculate duration if not already set
    let durationSeconds = session.duration_seconds || 0;
    if (!durationSeconds && session.started_at) {
      durationSeconds = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000);
    }

    // Save scores to session
    await pool.query(
      `UPDATE sessions SET
        status = 'completed',
        overall_score = $1,
        star_scores = $2,
        clarity_score = $3,
        transcript = $4,
        duration_seconds = $5,
        ended_at = COALESCE(ended_at, NOW())
       WHERE id = $6`,
      [
        scores.overallScore || 0,
        JSON.stringify(scores.starScores || {}),
        scores.clarityScore || 0,
        transcript,
        durationSeconds,
        sessionId
      ]
    );

    // Update skill vectors if user is authenticated
    const userId = session.user_id;
    if (userId && scores.categoryScores) {
      for (const [skill, score] of Object.entries(scores.categoryScores)) {
        if (typeof score !== 'number') continue;

        const clampedScore = Math.max(0, Math.min(10, score));

        const existing = await pool.query(
          'SELECT score, attempt_count FROM skill_vectors WHERE user_id = $1 AND skill = $2',
          [userId, skill]
        );

        if (existing.rows.length > 0) {
          const oldScore = parseFloat(existing.rows[0].score);
          const newScore = parseFloat((0.7 * oldScore + 0.3 * clampedScore).toFixed(2));
          const newCount = existing.rows[0].attempt_count + 1;

          await pool.query(
            'UPDATE skill_vectors SET score = $1, attempt_count = $2, last_updated = NOW() WHERE user_id = $3 AND skill = $4',
            [newScore, newCount, userId, skill]
          );
        } else {
          await pool.query(
            'INSERT INTO skill_vectors (user_id, skill, score, attempt_count) VALUES ($1, $2, $3, 1)',
            [userId, skill, clampedScore]
          );
        }
      }
    }

    return res.json({
      success: true,
      message: 'Session evaluated',
      data: {
        overallScore: scores.overallScore,
        starScores: scores.starScores,
        clarityScore: scores.clarityScore,
        categoryScores: scores.categoryScores,
        strengths: scores.strengths,
        improvements: scores.improvements,
        summary: scores.summary,
        passed: (scores.overallScore || 0) >= 6.5
      }
    });
  } catch (err) {
    logger.error('Evaluate session error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to evaluate session', data: null });
  }
}

module.exports = { evaluateSession };
