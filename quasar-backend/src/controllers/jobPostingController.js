/**
 * Job Posting Controller
 * CRUD operations for recruiter job postings, MCQ management, and AI MCQ generation.
 */
const JobPosting = require('../models/JobPosting');
const McqQuestion = require('../models/McqQuestion');
const { chatCompletion } = require('../services/groqService');
const { generateMcqsFromJd } = require('../services/mcqGeneratorService');
const logger = require('../utils/logger');

// ── JD Parsing (reuse existing Groq-based approach) ───────────────────

async function parseJobDescription(jobDescription) {
  const systemPrompt = `You are an expert technical recruiter. Analyse the provided job description and return ONLY valid JSON (no markdown, no code fences) matching this exact schema:
{
  "role": string,
  "seniority": "junior" | "mid" | "senior" | "staff" | "principal",
  "domain": string,
  "requiredSkills": string[],
  "niceToHaveSkills": string[],
  "culturalSignals": string[]
}`;

  const responseText = await chatCompletion(systemPrompt, `Job Description:\n${jobDescription}`, {
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    maxTokens: 2048,
  });

  let cleanJson = responseText.trim();
  if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }

  return JSON.parse(cleanJson);
}

// ── CRUD Operations ───────────────────────────────────────────────────

/**
 * POST /api/recruiter/jobs
 * Create a new job posting (draft).
 */
async function createJobPosting(req, res) {
  try {
    const recruiterId = req.user?.id;
    const {
      title, company, location, employmentType, salaryRange,
      jobDescription, pipeline, autoScreeningEnabled, screeningThreshold,
    } = req.body;

    if (!title || !jobDescription) {
      return res.status(400).json({
        success: false,
        message: 'Title and job description are required',
        data: null,
      });
    }

    if (!company) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required',
        data: null,
      });
    }

    // AI-parse the JD
    let parsedJd = null;
    let parseWarning = null;
    try {
      parsedJd = await parseJobDescription(jobDescription);
    } catch (parseErr) {
      logger.warn('JD parsing failed, proceeding without parsed data', { err: parseErr.message });
      parseWarning = 'AI could not parse the job description. MCQ generation and screening will use the raw text instead.';
    }

    const jobPosting = await JobPosting.create({
      recruiterId,
      title: title.trim(),
      company: company.trim(),
      location: location?.trim() || null,
      employmentType: employmentType || 'full-time',
      salaryRange: salaryRange || null,
      jobDescription,
      parsedJd,
      pipeline: pipeline || {},
      autoScreeningEnabled: autoScreeningEnabled !== false,
      screeningThreshold: screeningThreshold || 50,
    });

    logger.info('Job posting created', { jobId: jobPosting._id, recruiterId });

    return res.status(201).json({
      success: true,
      message: parseWarning
        ? `Job posting created as draft. Warning: ${parseWarning}`
        : 'Job posting created as draft',
      data: jobPosting,
    });
  } catch (err) {
    logger.error('Create job posting error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to create job posting', data: null });
  }
}

/**
 * GET /api/recruiter/jobs
 * List all job postings for the authenticated recruiter.
 */
async function listJobPostings(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { status } = req.query;

    const filter = { recruiterId };
    if (status && ['draft', 'published', 'closed', 'archived'].includes(status)) {
      filter.status = status;
    }

    const postings = await JobPosting.find(filter)
      .sort({ createdAt: -1 })
      .select('-jobDescription') // Omit full JD from list view for performance
      .lean();

    return res.json({
      success: true,
      message: 'Job postings retrieved',
      data: postings,
    });
  } catch (err) {
    logger.error('List job postings error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to list job postings', data: null });
  }
}

/**
 * GET /api/recruiter/jobs/:id
 * Get detailed job posting.
 */
async function getJobPosting(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;

    const posting = await JobPosting.findOne({ _id: id, recruiterId }).lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    // Fetch MCQ count
    const mcqCount = await McqQuestion.countDocuments({ jobPostingId: id });

    return res.json({
      success: true,
      message: 'Job posting retrieved',
      data: { ...posting, mcqCount },
    });
  } catch (err) {
    logger.error('Get job posting error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get job posting', data: null });
  }
}

/**
 * PUT /api/recruiter/jobs/:id
 * Update job posting (only if draft or published).
 */
async function updateJobPosting(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;
    const updates = req.body;

    const posting = await JobPosting.findOne({ _id: id, recruiterId });
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    if (posting.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update archived job posting',
        data: null,
      });
    }

    // Whitelist updatable fields
    const allowedFields = [
      'title', 'company', 'location', 'employmentType', 'salaryRange',
      'jobDescription', 'pipeline', 'autoScreeningEnabled', 'screeningThreshold',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        posting[field] = updates[field];
      }
    }

    // Re-parse JD if it was updated
    if (updates.jobDescription) {
      try {
        posting.parsedJd = await parseJobDescription(updates.jobDescription);
      } catch (parseErr) {
        logger.warn('JD re-parsing failed on update', { err: parseErr.message });
      }
    }

    await posting.save();

    logger.info('Job posting updated', { jobId: id });

    return res.json({
      success: true,
      message: 'Job posting updated',
      data: posting,
    });
  } catch (err) {
    logger.error('Update job posting error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to update job posting', data: null });
  }
}

/**
 * POST /api/recruiter/jobs/:id/publish
 * Publish job posting (opens for applications).
 */
async function publishJobPosting(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;

    const posting = await JobPosting.findOne({ _id: id, recruiterId });
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    if (posting.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot publish a posting with status "${posting.status}". Only drafts can be published.`,
        data: null,
      });
    }

    // Validate pipeline configuration
    const pipeline = posting.pipeline;
    if (pipeline.mcqRound?.enabled) {
      const mcqCount = await McqQuestion.countDocuments({ jobPostingId: id });
      if (mcqCount === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish: MCQ round is enabled but no questions have been added',
          data: null,
        });
      }
      if (!pipeline.mcqRound.window?.start || !pipeline.mcqRound.window?.end) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish: MCQ round requires a time window',
          data: null,
        });
      }
    }

    if (pipeline.techInterviewRounds?.length > 0) {
      for (const round of pipeline.techInterviewRounds) {
        if (!round.window?.start || !round.window?.end) {
          return res.status(400).json({
            success: false,
            message: `Cannot publish: Tech round ${round.roundNumber} requires a time window`,
            data: null,
          });
        }
      }
    }

    if (pipeline.hrRound?.enabled) {
      if (!pipeline.hrRound.window?.start || !pipeline.hrRound.window?.end) {
        return res.status(400).json({
          success: false,
          message: 'Cannot publish: HR round requires a time window',
          data: null,
        });
      }
    }

    posting.status = 'published';
    await posting.save();

    logger.info('Job posting published', { jobId: id });

    return res.json({
      success: true,
      message: 'Job posting published successfully',
      data: posting,
    });
  } catch (err) {
    logger.error('Publish job posting error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to publish job posting', data: null });
  }
}

/**
 * POST /api/recruiter/jobs/:id/close
 * Close job posting (no more applications).
 */
async function closeJobPosting(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;

    const posting = await JobPosting.findOne({ _id: id, recruiterId });
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    if (posting.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Only published postings can be closed',
        data: null,
      });
    }

    posting.status = 'closed';
    await posting.save();

    logger.info('Job posting closed', { jobId: id });

    return res.json({
      success: true,
      message: 'Job posting closed',
      data: posting,
    });
  } catch (err) {
    logger.error('Close job posting error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to close job posting', data: null });
  }
}

// ── MCQ Management ────────────────────────────────────────────────────

/**
 * POST /api/recruiter/jobs/:id/mcqs
 * Add a single MCQ manually.
 */
async function addMcq(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;
    const { question, options, explanation, difficulty, topic } = req.body;

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('_id').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Question text and at least 2 options are required',
        data: null,
      });
    }

    const correctCount = options.filter(o => o.isCorrect).length;
    if (correctCount !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Exactly one option must be marked as correct',
        data: null,
      });
    }

    const mcq = await McqQuestion.create({
      jobPostingId: id,
      question: question.trim(),
      options,
      explanation: explanation?.trim() || null,
      difficulty: difficulty || 2,
      topic: topic?.trim() || null,
      source: 'recruiter',
    });

    return res.status(201).json({
      success: true,
      message: 'MCQ added',
      data: mcq,
    });
  } catch (err) {
    logger.error('Add MCQ error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to add MCQ', data: null });
  }
}

/**
 * GET /api/recruiter/jobs/:id/mcqs
 * List all MCQs for a job posting.
 */
async function listMcqs(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('_id').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const mcqs = await McqQuestion.find({ jobPostingId: id }).sort({ createdAt: 1 }).lean();

    return res.json({
      success: true,
      message: 'MCQs retrieved',
      data: mcqs,
    });
  } catch (err) {
    logger.error('List MCQs error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to list MCQs', data: null });
  }
}

/**
 * PUT /api/recruiter/jobs/:id/mcqs/:mcqId
 * Edit a single MCQ.
 */
async function updateMcq(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id, mcqId } = req.params;
    const updates = req.body;

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('_id').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const mcq = await McqQuestion.findOne({ _id: mcqId, jobPostingId: id });
    if (!mcq) {
      return res.status(404).json({ success: false, message: 'MCQ not found', data: null });
    }

    if (updates.options) {
      const correctCount = updates.options.filter(o => o.isCorrect).length;
      if (correctCount !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Exactly one option must be marked as correct',
          data: null,
        });
      }
    }

    const allowedFields = ['question', 'options', 'explanation', 'difficulty', 'topic'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        mcq[field] = updates[field];
      }
    }

    await mcq.save();

    return res.json({
      success: true,
      message: 'MCQ updated',
      data: mcq,
    });
  } catch (err) {
    logger.error('Update MCQ error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to update MCQ', data: null });
  }
}

/**
 * DELETE /api/recruiter/jobs/:id/mcqs/:mcqId
 * Delete a single MCQ.
 */
async function deleteMcq(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id, mcqId } = req.params;

    // Verify ownership
    const posting = await JobPosting.findOne({ _id: id, recruiterId }).select('_id').lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const result = await McqQuestion.deleteOne({ _id: mcqId, jobPostingId: id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'MCQ not found', data: null });
    }

    return res.json({
      success: true,
      message: 'MCQ deleted',
      data: null,
    });
  } catch (err) {
    logger.error('Delete MCQ error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to delete MCQ', data: null });
  }
}

/**
 * POST /api/recruiter/jobs/:id/mcqs/generate
 * AI-generate MCQs from the job description.
 */
async function generateMcqs(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { id } = req.params;
    const { count } = req.body;

    const posting = await JobPosting.findOne({ _id: id, recruiterId }).lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const numQuestions = Math.min(Math.max(count || 20, 5), 50);

    // Lazy-parse JD if it wasn't parsed during creation
    let parsedJd = posting.parsedJd;
    if (!parsedJd) {
      try {
        parsedJd = await parseJobDescription(posting.jobDescription);
        // Persist it so we don't re-parse every time
        await JobPosting.updateOne({ _id: id }, { $set: { parsedJd } });
        logger.info('Lazy-parsed JD for MCQ generation', { jobId: id });
      } catch (parseErr) {
        logger.warn('Lazy JD parsing failed, generating MCQs from raw text', { err: parseErr.message });
        parsedJd = {};
      }
    }

    const questions = await generateMcqsFromJd(
      posting.jobDescription,
      parsedJd,
      numQuestions
    );

    // Bulk insert generated questions
    const mcqDocs = questions.map(q => ({
      jobPostingId: id,
      question: q.question,
      options: q.options,
      explanation: q.explanation || null,
      difficulty: q.difficulty || 2,
      topic: q.topic || null,
      source: 'ai_generated',
    }));

    const inserted = await McqQuestion.insertMany(mcqDocs);

    logger.info('AI MCQs generated', { jobId: id, count: inserted.length });

    return res.json({
      success: true,
      message: `${inserted.length} MCQs generated successfully`,
      data: inserted,
    });
  } catch (err) {
    logger.error('Generate MCQs error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to generate MCQs', data: null });
  }
}

module.exports = {
  createJobPosting,
  listJobPostings,
  getJobPosting,
  updateJobPosting,
  publishJobPosting,
  closeJobPosting,
  addMcq,
  listMcqs,
  updateMcq,
  deleteMcq,
  generateMcqs,
};
