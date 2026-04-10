const { extractTextFromPDF } = require('../utils/pdfExtract');
const { chatCompletion } = require('../services/groqService');
const { onResumeCompare } = require('../services/gamificationService');
const logger = require('../utils/logger');

/**
 * POST /api/resume/compare
 * Compare a Resume PDF against a Job Description (PDF or plain text)
 * and return a structured match analysis powered by Groq.
 *
 * multipart/form-data fields:
 *   - resume: PDF file (required)
 *   - jd: PDF file (optional — one of jd or jdText must be present)
 *   - jdText: plain-text string (optional)
 */
async function compareResumeToJD(req, res) {
  try {
    const resumeFile = req.files?.resume?.[0];
    const jdFile = req.files?.jd?.[0];
    const jdText = req.body?.jdText?.trim();

    // ── Validate inputs ──────────────────────────────────────
    if (!resumeFile) {
      return res.status(400).json({ success: false, message: 'Resume PDF is required', data: null });
    }
    if (!jdFile && (!jdText || jdText.length < 50)) {
      return res.status(400).json({ success: false, message: 'Job description (PDF or at least 50 chars of text) is required', data: null });
    }

    // ── Extract text from PDFs ───────────────────────────────
    let resumeText = '';
    try {
      resumeText = await extractTextFromPDF(resumeFile.buffer);
    } catch (e) {
      logger.error('PDF extraction failed on resume', { err: e.message, filename: resumeFile.originalname });
      return res.status(422).json({ success: false, message: `Could not extract text from resume PDF: ${e.message}`, data: null });
    }

    if (!resumeText || resumeText.length < 30) {
      return res.status(422).json({ success: false, message: 'Resume PDF appears to be empty or image-only (no extractable text)', data: null });
    }

    let jdContent = jdText || '';
    if (jdFile) {
      try {
        jdContent = await extractTextFromPDF(jdFile.buffer);
      } catch (e) {
        logger.error('PDF extraction failed on JD', { err: e.message, filename: jdFile.originalname });
        return res.status(422).json({ success: false, message: `Could not extract text from JD PDF: ${e.message}`, data: null });
      }
      if (!jdContent || jdContent.length < 30) {
        return res.status(422).json({ success: false, message: 'JD PDF appears to be empty or image-only', data: null });
      }
    }

    // ── Build Groq prompt ────────────────────────────────────
    const systemPrompt = `You are an expert ATS (Applicant Tracking System) and career coach. 
Analyse the provided RESUME against the JOB DESCRIPTION and return ONLY valid JSON (no markdown, no code fences) matching EXACTLY this schema:
{
  "overallMatch": number,          // 0-100 percentage match score
  "verdict": "Strong Match" | "Good Match" | "Partial Match" | "Weak Match",
  "summary": string,               // 2-3 sentence executive summary
  "matchedSkills": [               // skills that appear in both resume and JD
    { "skill": string, "proficiency": "expert" | "intermediate" | "beginner", "context": string }
  ],
  "missingSkills": [               // required JD skills not found in resume
    { "skill": string, "importance": "critical" | "important" | "nice-to-have", "suggestion": string }
  ],
  "bonusSkills": [                 // resume skills not in JD but potentially valuable
    { "skill": string, "relevance": string }
  ],
  "experienceAnalysis": {
    "requiredYears": string,       // from JD, e.g. "3-5 years"
    "candidateYears": string,      // estimated from resume
    "verdict": string
  },
  "educationAnalysis": {
    "required": string,
    "candidate": string,
    "verdict": string
  },
  "keyStrengths": string[],        // 3-5 strong selling points of the candidate for this role
  "improvementAreas": string[],    // 3-5 actionable improvement or gap areas
  "tailoringTips": string[]        // 3 specific tips to tailor the resume for this JD
}`;

    const userPrompt = `--- RESUME ---\n${resumeText.slice(0, 6000)}\n\n--- JOB DESCRIPTION ---\n${jdContent.slice(0, 4000)}`;

    const responseText = await chatCompletion(systemPrompt, userPrompt, {
      model: 'gpt-oss-120b',
      temperature: 0.3,
      maxTokens: 4096,
    });

    // ── Parse Groq response ──────────────────────────────────
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    let analysis;
    try {
      analysis = JSON.parse(cleanJson);
    } catch (parseErr) {
      logger.error('Failed to parse Groq resume compare response', { err: parseErr.message, responseText });
      return res.status(502).json({ success: false, message: 'AI returned invalid JSON. Please try again.', data: null });
    }

    // Fire-and-forget gamification
    const gamification = await onResumeCompare(req.user?.id);

    return res.json({
      success: true,
      message: 'Resume vs JD comparison complete',
      data: {
        ...analysis,
        resumeFileName: resumeFile.originalname,
        jdFileName:     jdFile?.originalname || 'Plain text input',
        newBadge:       gamification?.newBadge || null,
      },
    });
  } catch (err) {
    logger.error('Resume compare error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to compare resume and JD', data: null });
  }
}

module.exports = { compareResumeToJD };
