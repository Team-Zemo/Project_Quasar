/**
 * MCQ Generator Service
 * Uses Groq API to generate multiple-choice questions based on a job description.
 */
const { chatCompletion } = require('./groqService');
const logger = require('../utils/logger');

/**
 * Generate MCQ questions from a job description using Groq.
 * @param {string} jobDescription — full JD text
 * @param {object} parsedJd — AI-parsed JD data (skills, domain, seniority)
 * @param {number} count — number of questions to generate (default 20)
 * @returns {Promise<Array>} — array of MCQ question objects
 */
async function generateMcqsFromJd(jobDescription, parsedJd = {}, count = 20) {
  const domain = parsedJd.domain || 'General';
  const seniority = parsedJd.seniority || 'mid';
  const skills = parsedJd.requiredSkills || [];

  const systemPrompt = `You are an expert technical assessment designer. Generate exactly ${count} multiple-choice questions (MCQs) for a hiring assessment based on the provided job description.

REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D)
- Exactly one option must be correct
- Questions must be relevant to the job role, domain (${domain}), and required skills
- Difficulty distribution: 30% easy (1), 50% medium (2), 20% hard (3)
- Seniority level: ${seniority}
- Cover these skills where applicable: ${skills.join(', ')}
- Include a brief explanation for why the correct answer is right
- Tag each question with its topic

Return ONLY valid JSON (no markdown, no code fences) matching this exact schema:
{
  "questions": [
    {
      "question": "string — the question text",
      "options": [
        { "text": "string — option A text", "isCorrect": false },
        { "text": "string — option B text", "isCorrect": true },
        { "text": "string — option C text", "isCorrect": false },
        { "text": "string — option D text", "isCorrect": false }
      ],
      "explanation": "string — why the correct answer is right",
      "difficulty": 1 | 2 | 3,
      "topic": "string — skill/topic this tests"
    }
  ]
}`;

  const userPrompt = `Job Description:\n${jobDescription}`;

  try {
    const responseText = await chatCompletion(systemPrompt, userPrompt, {
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      maxTokens: 8192,
    });

    let cleanJson = responseText.trim();

    // Strip markdown fences if present
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(cleanJson);

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Response missing "questions" array');
    }

    // Validate each question has exactly one correct answer
    const validatedQuestions = parsed.questions.filter(q => {
      if (!q.question || !Array.isArray(q.options) || q.options.length < 2) {
        return false;
      }
      const correctCount = q.options.filter(o => o.isCorrect).length;
      return correctCount === 1;
    });

    logger.info(`Generated ${validatedQuestions.length}/${count} valid MCQs for domain: ${domain}`);
    return validatedQuestions;
  } catch (err) {
    logger.error('MCQ generation failed', { err: err.message });
    throw new Error(`MCQ generation failed: ${err.message}`);
  }
}

module.exports = { generateMcqsFromJd };
