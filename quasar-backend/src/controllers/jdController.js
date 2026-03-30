const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config/env');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

/**
 * POST /api/jd/parse
 * Parse a job description and generate custom question bank
 */
async function parseJD(req, res) {
  try {
    const { jobDescription } = req.body;
    const userId = req.user?.id;

    if (!jobDescription || jobDescription.trim().length < 50) {
      return res.status(400).json({ success: false, message: 'Job description must be at least 50 characters', data: null });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `You are an expert technical recruiter. Analyse this job description and return ONLY valid JSON (no markdown, no code fences) in this exact schema:
{
  "role": string,
  "seniority": "junior" | "mid" | "senior" | "staff" | "principal",
  "domain": string,
  "requiredSkills": string[],
  "niceToHaveSkills": string[],
  "culturalSignals": string[],
  "generatedQuestions": [
    {
      "question": string,
      "category": "behavioural" | "technical" | "system-design" | "culture-fit",
      "difficulty": 1 | 2 | 3,
      "targetSkill": string,
      "weight": number
    }
  ]
}
Generate exactly 20 questions, weighted by importance to the role. Weight values should be between 0.0 and 1.0, higher = more important.
Job Description: ${jobDescription}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON from response — strip markdown fences if present
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(cleanJson);
    } catch (parseErr) {
      logger.error('Failed to parse Gemini JD response as JSON', { responseText, err: parseErr.message });
      return res.status(502).json({ success: false, message: 'AI returned invalid JSON. Please try again.', data: null });
    }

    // Store JD session
    const jdResult = await pool.query(
      'INSERT INTO jd_sessions (user_id, job_description, parsed_data) VALUES ($1, $2, $3) RETURNING id',
      [userId, jobDescription, JSON.stringify(parsedData)]
    );

    const jdSessionId = jdResult.rows[0].id;

    // Store individual questions
    if (parsedData.generatedQuestions && Array.isArray(parsedData.generatedQuestions)) {
      for (const q of parsedData.generatedQuestions) {
        await pool.query(
          `INSERT INTO jd_questions (jd_session_id, question, category, difficulty, target_skill, weight)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [jdSessionId, q.question, q.category, q.difficulty, q.targetSkill, q.weight]
        );
      }
    }

    return res.json({
      success: true,
      message: 'Job description parsed successfully',
      data: {
        jdSessionId,
        role: parsedData.role,
        seniority: parsedData.seniority,
        domain: parsedData.domain,
        requiredSkills: parsedData.requiredSkills,
        niceToHaveSkills: parsedData.niceToHaveSkills,
        culturalSignals: parsedData.culturalSignals,
        questions: parsedData.generatedQuestions
      }
    });
  } catch (err) {
    logger.error('Parse JD error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to parse job description', data: null });
  }
}

/**
 * GET /api/jd/:jdSessionId/questions
 * Returns question list ordered by weight desc
 */
async function getJDQuestions(req, res) {
  try {
    const { jdSessionId } = req.params;

    const result = await pool.query(
      'SELECT * FROM jd_questions WHERE jd_session_id = $1 ORDER BY weight DESC',
      [jdSessionId]
    );

    return res.json({
      success: true,
      message: 'Questions retrieved',
      data: result.rows
    });
  } catch (err) {
    logger.error('Get JD questions error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get questions', data: null });
  }
}

module.exports = { parseJD, getJDQuestions };
