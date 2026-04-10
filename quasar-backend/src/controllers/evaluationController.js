const { chatCompletion } = require('../services/groqService');
const config = require('../config/env');
const Session = require('../models/Session');
const SpeechMetrics = require('../models/SpeechMetrics');
const Persona = require('../models/Persona');
const SkillVector = require('../models/SkillVector');
const { processSession } = require('../services/gamificationService');
const logger = require('../utils/logger');

/**
 * POST /api/sessions/:sessionId/evaluate
 * Calls Groq to score the interview transcript, saves scores, updates skill vectors
 */
async function evaluateSession(req, res) {
  try {
    const { sessionId } = req.params;

    // Fetch session
    const session = await Session.findById(sessionId).lean();

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    // Fetch persona name
    let personaName = 'Default Interviewer';
    if (session.personaId) {
      const persona = await Persona.findById(session.personaId).lean();
      if (persona) personaName = persona.name;
    }

    // Fetch speech transcript
    const speechDoc = await SpeechMetrics.findOne({ sessionId }).lean();
    const transcript = speechDoc?.transcript || session.transcript || '';

    if (!transcript || transcript.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient transcript for evaluation',
        data: null
      });
    }

    // Call Groq for evaluation
    const systemPrompt = `You are an expert interview evaluator. Analyse the provided interview transcript and return ONLY valid JSON (no markdown, no code fences) matching this exact schema:
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
}`;

    const userPrompt = `Domain: ${session.domain || 'General'}
Persona: ${personaName}

Transcript:
${transcript.substring(0, 8000)}`;

    const responseText = await chatCompletion(systemPrompt, userPrompt, {
      model: 'gpt-oss-120b',
      temperature: 0.3,
      maxTokens: 4096,
    });

    // Strip markdown fences if present
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    let scores;
    try {
      scores = JSON.parse(cleanJson);
    } catch (parseErr) {
      logger.error('Failed to parse Groq evaluation response', { responseText: cleanJson, err: parseErr.message });
      return res.status(502).json({ success: false, message: 'AI returned invalid evaluation. Try again.', data: null });
    }

    // Calculate duration if not already set
    let durationSeconds = session.durationSeconds || 0;
    if (!durationSeconds && session.startedAt) {
      durationSeconds = Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    }

    // Save scores to session
    await Session.findByIdAndUpdate(sessionId, {
      status: 'completed',
      overallScore: scores.overallScore || 0,
      starScores: scores.starScores || {},
      clarityScore: scores.clarityScore || 0,
      transcript,
      durationSeconds,
      endedAt: session.endedAt || new Date(),
    });

    // Update skill vectors if user is authenticated
    const userId = session.userId;
    if (userId && scores.categoryScores) {
      for (const [skill, score] of Object.entries(scores.categoryScores)) {
        if (typeof score !== 'number') continue;

        const clampedScore = Math.max(0, Math.min(10, score));

        const existing = await SkillVector.findOne({ userId, skill });

        if (existing) {
          const oldScore = parseFloat(existing.score);
          const newScore = parseFloat((0.7 * oldScore + 0.3 * clampedScore).toFixed(2));
          const newCount = existing.attemptCount + 1;

          await SkillVector.findOneAndUpdate(
            { userId, skill },
            { score: newScore, attemptCount: newCount, lastUpdated: new Date() }
          );
        } else {
          await SkillVector.create({
            userId,
            skill,
            score: clampedScore,
            attemptCount: 1,
          });
        }
      }
    }

    // ── Gamification ─────────────────────────────────────────
    const gamification = await processSession(userId, {
      sessionId:       sessionId,
      overallScore:    scores.overallScore,
      durationSeconds: durationSeconds,
      domain:          session.domain,
      personaId:       session.personaId,
      jdSessionId:     session.jdSessionId,
    });

    return res.json({
      success: true,
      message: 'Session evaluated',
      data: {
        overallScore:   scores.overallScore,
        starScores:     scores.starScores,
        clarityScore:   scores.clarityScore,
        categoryScores: scores.categoryScores,
        strengths:      scores.strengths,
        improvements:   scores.improvements,
        summary:        scores.summary,
        passed:         (scores.overallScore || 0) >= 6.5,
        gamification:   gamification || null,
      }
    });
  } catch (err) {
    logger.error('Evaluate session error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to evaluate session', data: null });
  }
}

module.exports = { evaluateSession };
