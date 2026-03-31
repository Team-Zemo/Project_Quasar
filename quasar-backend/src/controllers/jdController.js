const { extractTextFromPDF } = require('../utils/pdfExtract');
const { chatCompletion } = require('../services/groqService');
const JdSession = require('../models/JdSession');
const JdQuestion = require('../models/JdQuestion');
const logger = require('../utils/logger');

/**
 * POST /api/jd/parse
 * Parse a job description and generate custom question bank (powered by Groq)
 */
async function parseJD(req, res) {
  try {
    const userId = req.user?.id;

    // Support both PDF upload (multipart) and plain-text body
    let jobDescription = req.body?.jobDescription?.trim() || '';

    if (req.file) {
      try {
        jobDescription = await extractTextFromPDF(req.file.buffer);
      } catch (pdfErr) {
        logger.error('PDF extraction failed on JD upload', { err: pdfErr.message });
        return res.status(422).json({ success: false, message: `Could not extract text from JD PDF: ${pdfErr.message}`, data: null });
      }
    }

    if (!jobDescription || jobDescription.length < 50) {
      return res.status(400).json({ success: false, message: 'Job description must be at least 50 characters', data: null });
    }

    const systemPrompt = `You are an expert technical recruiter. Analyse the provided job description and return ONLY valid JSON (no markdown, no code fences) matching this exact schema:
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
Generate exactly 20 questions, weighted by importance to the role. Weight values should be between 0.0 and 1.0, higher = more important.`;

    const userPrompt = `Job Description:\n${jobDescription}`;

    const responseText = await chatCompletion(systemPrompt, userPrompt, {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      maxTokens: 4096,
    });

    // Parse JSON from response — strip markdown fences if present
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    let parsedData;
    try {
      parsedData = JSON.parse(cleanJson);
    } catch (parseErr) {
      logger.error('Failed to parse Groq JD response as JSON', { responseText, err: parseErr.message });
      return res.status(502).json({ success: false, message: 'AI returned invalid JSON. Please try again.', data: null });
    }

    // Store JD session
    const jdSession = await JdSession.create({
      userId,
      jobDescription,
      parsedData,
    });

    // Store individual questions
    if (parsedData.generatedQuestions && Array.isArray(parsedData.generatedQuestions)) {
      const questions = parsedData.generatedQuestions.map(q => ({
        jdSessionId: jdSession._id,
        question: q.question,
        category: q.category,
        difficulty: q.difficulty,
        targetSkill: q.targetSkill,
        weight: q.weight,
      }));
      await JdQuestion.insertMany(questions);
    }

    return res.json({
      success: true,
      message: 'Job description parsed successfully',
      data: {
        jdSessionId: jdSession._id,
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

    const questions = await JdQuestion.find({ jdSessionId }).sort({ weight: -1 }).lean();

    return res.json({
      success: true,
      message: 'Questions retrieved',
      data: questions
    });
  } catch (err) {
    logger.error('Get JD questions error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get questions', data: null });
  }
}

module.exports = { parseJD, getJDQuestions };
