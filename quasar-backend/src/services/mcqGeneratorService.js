/**
 * MCQ Generator Service
 * Uses Groq API (llama-3.3-70b-versatile) to generate multiple-choice questions
 * based on a job description. Batches requests to avoid timeout issues.
 */
const { chatCompletion } = require('./groqService');
const logger = require('../utils/logger');

const MCQ_BATCH_SIZE = 5; // Generate 5 MCQs per request to stay under Cloudflare's 100s timeout

/**
 * Build the system prompt for MCQ generation.
 */
function buildSystemPrompt(count, domain, seniority, skills) {
  return `You are an expert technical assessment designer. Generate exactly ${count} multiple-choice questions (MCQs) for a hiring assessment based on the provided job description.

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
}

/**
 * Parse AI response text into validated MCQ objects.
 */
function parseAndValidate(responseText) {
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
  return parsed.questions.filter(q => {
    if (!q.question || !Array.isArray(q.options) || q.options.length < 2) {
      return false;
    }
    const correctCount = q.options.filter(o => o.isCorrect).length;
    return correctCount === 1;
  });
}

/**
 * Generate a single batch of MCQs.
 */
async function generateBatch(jobDescription, domain, seniority, skills, batchSize, batchIndex) {
  const systemPrompt = buildSystemPrompt(batchSize, domain, seniority, skills);
  const userPrompt = `Job Description:\n${jobDescription}${
    batchIndex > 0 ? `\n\n(This is batch ${batchIndex + 1} — generate DIFFERENT questions from previous batches. Focus on different topics/skills.)` : ''
  }`;

  const responseText = await chatCompletion(systemPrompt, userPrompt, {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.4 + (batchIndex * 0.05), // Slight temp variation for diversity
    maxTokens: 4096,
  });

  return parseAndValidate(responseText);
}

/**
 * Generate MCQ questions from a job description.
 * Splits into batches of MCQ_BATCH_SIZE to avoid Cloudflare 524 timeouts.
 * @param {string} jobDescription — full JD text
 * @param {object} parsedJd — AI-parsed JD data (skills, domain, seniority)
 * @param {number} count — number of questions to generate (default 20)
 * @returns {Promise<Array>} — array of MCQ question objects
 */
async function generateMcqsFromJd(jobDescription, parsedJd = {}, count = 20) {
  const domain = parsedJd.domain || 'General';
  const seniority = parsedJd.seniority || 'mid';
  const skills = parsedJd.requiredSkills || [];

  const totalBatches = Math.ceil(count / MCQ_BATCH_SIZE);
  const allQuestions = [];

  logger.info(`MCQ generation: ${count} questions in ${totalBatches} batches of ≤${MCQ_BATCH_SIZE}`);

  for (let i = 0; i < totalBatches; i++) {
    const batchSize = Math.min(MCQ_BATCH_SIZE, count - allQuestions.length);
    if (batchSize <= 0) break;

    try {
      logger.info(`MCQ batch ${i + 1}/${totalBatches}: generating ${batchSize} questions...`);
      const batchQuestions = await generateBatch(jobDescription, domain, seniority, skills, batchSize, i);
      allQuestions.push(...batchQuestions);
      logger.info(`MCQ batch ${i + 1}/${totalBatches}: got ${batchQuestions.length} valid questions`);
    } catch (err) {
      logger.error(`MCQ batch ${i + 1}/${totalBatches} failed`, { err: err.message });
      // Continue with remaining batches instead of failing entirely
      if (allQuestions.length === 0 && i === totalBatches - 1) {
        throw new Error(`MCQ generation failed: ${err.message}`);
      }
    }
  }

  logger.info(`MCQ generation complete: ${allQuestions.length}/${count} valid MCQs for domain: ${domain}`);
  return allQuestions;
}

module.exports = { generateMcqsFromJd };
