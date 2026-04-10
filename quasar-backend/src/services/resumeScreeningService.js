/**
 * Resume Screening Service
 * Uses Groq API to evaluate how well a candidate's resume matches a job description.
 * Returns a structured match score with skill gap analysis.
 */
const { chatCompletion } = require('./groqService');
const logger = require('../utils/logger');

/**
 * Screen a resume against a job description using AI.
 * @param {object} params
 * @param {string} params.resumeText — extracted plain text from resume
 * @param {object} params.resumeParsed — AI-parsed resume data (skills, experience)
 * @param {string} params.jobDescription — full JD text
 * @param {object} params.parsedJd — AI-parsed JD data (requiredSkills, domain, seniority)
 * @returns {Promise<object>} — { matchScore, passed, matchedSkills, missingSkills, summary }
 */
async function screenResume({ resumeText, resumeParsed, jobDescription, parsedJd, threshold = 50 }) {
  const candidateSkills = resumeParsed?.skills || [];
  const requiredSkills = parsedJd?.requiredSkills || [];

  const systemPrompt = `You are an expert talent acquisition specialist. Evaluate the candidate's resume against the provided job description and return a structured compatibility assessment.

Score the candidate from 0-100 based on:
- Skill match (40% weight): How many required/preferred skills does the candidate have?
- Experience relevance (30% weight): Is the candidate's experience level and domain relevant?
- Education fit (15% weight): Does the education background align?
- Overall suitability (15% weight): General cultural/role fit signals

Return ONLY valid JSON (no markdown, no code fences) matching this exact schema:
{
  "matchScore": number (0-100),
  "matchedSkills": ["string — skills the candidate has that match the JD"],
  "missingSkills": ["string — required skills the candidate lacks"],
  "experienceMatch": "string — brief assessment of experience relevance",
  "summary": "string — 2-3 sentence assessment of overall fit",
  "recommendation": "shortlist" | "review" | "reject"
}`;

  const userPrompt = `JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText || 'No resume text available'}

CANDIDATE EXTRACTED SKILLS: ${candidateSkills.join(', ') || 'None extracted'}
JOB REQUIRED SKILLS: ${requiredSkills.join(', ') || 'Not specified'}`;

  try {
    const responseText = await chatCompletion(systemPrompt, userPrompt, {
      model: 'gpt-oss-120b',
      temperature: 0.2,
      maxTokens: 2048,
    });

    let cleanJson = responseText.trim();

    // Strip markdown fences if present
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    const result = JSON.parse(cleanJson);

    const matchScore = typeof result.matchScore === 'number'
      ? Math.max(0, Math.min(100, result.matchScore))
      : 0;

    const screeningResult = {
      matchScore,
      passed: matchScore >= threshold,
      matchedSkills: result.matchedSkills || [],
      missingSkills: result.missingSkills || [],
      summary: result.summary || '',
      evaluatedAt: new Date(),
    };

    logger.info('Resume screening completed', {
      matchScore,
      passed: screeningResult.passed,
      threshold,
    });

    return screeningResult;
  } catch (err) {
    logger.error('Resume screening failed', { err: err.message });
    throw new Error(`Resume screening failed: ${err.message}`);
  }
}

/**
 * Parse a resume text into structured data using AI.
 * @param {string} resumeText — plain text extracted from resume PDF
 * @returns {Promise<object>} — parsed resume data
 */
async function parseResume(resumeText) {
  const systemPrompt = `You are an expert resume parser. Extract structured data from the provided resume text.

Return ONLY valid JSON (no markdown, no code fences) matching this exact schema:
{
  "name": "string",
  "email": "string or null",
  "phone": "string or null",
  "headline": "string — professional title/headline",
  "skills": ["string — technical and soft skills"],
  "experience": number (years of experience, estimate from work history),
  "education": [{ "institution": "string", "degree": "string", "year": "string or null" }],
  "workHistory": [{ "company": "string", "title": "string", "duration": "string" }],
  "summary": "string — 1-2 sentence professional summary"
}`;

  try {
    const responseText = await chatCompletion(systemPrompt, resumeText, {
      model: 'gpt-oss-120b',
      temperature: 0.1,
      maxTokens: 4096,
    });

    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(cleanJson);
    logger.info('Resume parsed successfully', { skills: parsed.skills?.length || 0 });
    return parsed;
  } catch (err) {
    logger.error('Resume parsing failed', { err: err.message });
    throw new Error(`Resume parsing failed: ${err.message}`);
  }
}

module.exports = { screenResume, parseResume };
