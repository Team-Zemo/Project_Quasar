/**
 * Pipeline Controller
 * Manages tech interview and HR round lifecycle within the hiring pipeline.
 * Handles round start (time window validation), result recording, and auto-advancement.
 */
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const Session = require('../models/Session');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * POST /api/applications/:appId/tech/:round/start
 * Start a specific tech interview round.
 * Creates a Session record and returns config for the frontend to connect via WebSocket.
 */
async function startTechRound(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId, round } = req.params;
    const roundNumber = parseInt(round);

    if (isNaN(roundNumber) || roundNumber < 1) {
      return res.status(400).json({ success: false, message: 'Invalid round number', data: null });
    }

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'tech_pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot start tech round. Current status: ${application.status}`,
        data: null,
      });
    }

    if (application.currentTechRoundNumber !== roundNumber) {
      return res.status(400).json({
        success: false,
        message: `Expected round ${application.currentTechRoundNumber}, but got ${roundNumber}`,
        data: null,
      });
    }

    // Fetch job posting configuration
    const posting = await JobPosting.findById(application.jobPostingId).lean();
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const techRounds = posting.pipeline?.techInterviewRounds || [];
    const roundConfig = techRounds.find(r => r.roundNumber === roundNumber);

    if (!roundConfig) {
      return res.status(400).json({
        success: false,
        message: `Tech round ${roundNumber} is not configured`,
        data: null,
      });
    }

    // Validate time window
    const now = new Date();
    if (now < new Date(roundConfig.window.start)) {
      return res.status(400).json({
        success: false,
        message: `Tech round ${roundNumber} window has not opened yet`,
        data: { opensAt: roundConfig.window.start },
      });
    }
    if (now > new Date(roundConfig.window.end)) {
      return res.status(400).json({
        success: false,
        message: `Tech round ${roundNumber} window has expired`,
        data: { expiredAt: roundConfig.window.end },
      });
    }

    // Check if this round already has a session (prevent re-attempts)
    const existingResult = application.techResults.find(r => r.roundNumber === roundNumber);
    if (existingResult?.sessionId) {
      return res.status(409).json({
        success: false,
        message: `Tech round ${roundNumber} has already been attempted`,
        data: null,
      });
    }

    // Create a Session record for this interview
    const session = await Session.create({
      userId: candidateId,
      domain: roundConfig.domain || posting.parsedJd?.domain || 'General',
      personaId: roundConfig.personaId || 'faang_engineer',
      status: 'active',
      startedAt: now,
    });

    // Update application status
    application.status = 'tech_in_progress';
    application.lastActivityAt = now;

    // Add/update tech result entry
    const techResultIndex = application.techResults.findIndex(r => r.roundNumber === roundNumber);
    const techResult = {
      roundNumber,
      sessionId: session._id,
      score: null,
      passed: null,
      transcript: '',
      evaluation: null,
      completedAt: null,
    };

    if (techResultIndex >= 0) {
      application.techResults[techResultIndex] = techResult;
    } else {
      application.techResults.push(techResult);
    }

    await application.save();

    logger.info('Tech interview round started', {
      appId,
      candidateId,
      roundNumber,
      sessionId: session._id,
    });

    // Build the system prompt for the AI interviewer based on JD + candidate context
    const jdContext = posting.jobDescription
      ? `\n\nJob Context:\nTitle: ${posting.title}\nCompany: ${posting.company}\nKey Skills: ${(posting.parsedJd?.requiredSkills || []).join(', ')}\n\nFull JD:\n${posting.jobDescription.substring(0, 2000)}`
      : '';

    // Append candidate platform context if available
    let candidateContext = '';
    try {
      const candidate = await User.findById(candidateId)
        .select('platformContext')
        .lean();
      if (candidate?.platformContext) {
        candidateContext =
          '\n\n## Candidate Background (from verified external platforms)\n' +
          'Use this to tailor questions to their actual experience and projects.\n' +
          candidate.platformContext;
      }
    } catch (ctxErr) {
      logger.warn('Failed to load candidate platform context for tech round', { err: ctxErr.message });
    }

    return res.json({
      success: true,
      message: `Tech round ${roundNumber} started`,
      data: {
        sessionId: session._id,
        domain: roundConfig.domain || posting.parsedJd?.domain || 'General',
        personaId: roundConfig.personaId || 'faang_engineer',
        title: roundConfig.title,
        durationMinutes: roundConfig.durationMinutes,
        jdContext: jdContext + candidateContext,
      },
    });
  } catch (err) {
    logger.error('Start tech round error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to start tech round', data: null });
  }
}

/**
 * POST /api/applications/:appId/tech/:round/complete
 * Record the result of a completed tech interview round.
 * Called after the interview session is evaluated via the existing evaluation flow.
 * Body: { sessionId, score, evaluation }
 */
async function completeTechRound(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId, round } = req.params;
    const roundNumber = parseInt(round);

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    // Fetch session and its evaluation
    const techResult = application.techResults.find(r => r.roundNumber === roundNumber);
    if (!techResult) {
      return res.status(400).json({
        success: false,
        message: `No active session found for tech round ${roundNumber}`,
        data: null,
      });
    }

    // Try the stored session first, then fall back to the one provided in the request body
    const storedSessionId = techResult.sessionId;
    const bodySessionId = req.body.sessionId;
    let session = null;

    if (storedSessionId) {
      session = await Session.findById(storedSessionId).lean();
    }

    // If the stored session isn't completed but the caller provided a different session
    // that IS completed (e.g. because the frontend created a new session for a resumed round),
    // use that one and update the tech result to reference it.
    if ((!session || session.status !== 'completed') && bodySessionId && bodySessionId !== String(storedSessionId)) {
      const altSession = await Session.findById(bodySessionId).lean();
      if (altSession && altSession.status === 'completed') {
        logger.info('Using alternate session from request body for tech round completion', {
          storedSessionId: String(storedSessionId),
          bodySessionId,
          roundNumber,
        });
        session = altSession;
        // Update the tech result to point to the correct session
        const resultIndex = application.techResults.findIndex(r => r.roundNumber === roundNumber);
        if (resultIndex >= 0) {
          application.techResults[resultIndex].sessionId = bodySessionId;
        }
      }
    }

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found', data: null });
    }

    if (session.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Interview session has not been evaluated yet. Complete evaluation first.',
        data: null,
      });
    }

    // Get posting config for passing score
    const posting = await JobPosting.findById(application.jobPostingId).lean();
    const techRounds = posting?.pipeline?.techInterviewRounds || [];
    const roundConfig = techRounds.find(r => r.roundNumber === roundNumber);
    const passingScore = roundConfig?.passingScore || 6.0;

    const score = session.overallScore || 0;
    const passed = score >= passingScore;

    // Update tech result
    const resultIndex = application.techResults.findIndex(r => r.roundNumber === roundNumber);
    if (resultIndex >= 0) {
      application.techResults[resultIndex].score = score;
      application.techResults[resultIndex].passed = passed;
      application.techResults[resultIndex].transcript = session.transcript || '';
      application.techResults[resultIndex].evaluation = session.starScores || null;
      application.techResults[resultIndex].completedAt = new Date();
    }

    // Eliminator logic
    if (!passed) {
      application.status = 'tech_failed';
      application.currentRound = 'tech';
    } else {
      // Check if there are more tech rounds
      const nextRoundNumber = roundNumber + 1;
      const nextRound = techRounds.find(r => r.roundNumber === nextRoundNumber);

      if (nextRound) {
        application.status = 'tech_pending';
        application.currentTechRoundNumber = nextRoundNumber;
      } else {
        // All tech rounds passed
        if (posting?.pipeline?.hrRound?.enabled) {
          application.status = 'hr_pending';
          application.currentRound = 'hr';
        } else {
          application.status = 'selected';
          application.currentRound = 'completed';
          application.totalScore = calculateTotalScore(application, posting);
        }
      }
    }

    application.lastActivityAt = new Date();
    await application.save();

    logger.info('Tech round completed', {
      appId,
      roundNumber,
      score,
      passed,
      newStatus: application.status,
    });

    return res.json({
      success: true,
      message: passed
        ? `Tech round ${roundNumber} passed!`
        : `Tech round ${roundNumber} score (${score}) below passing threshold (${passingScore})`,
      data: {
        score,
        passingScore,
        passed,
        status: application.status,
        currentRound: application.currentRound,
      },
    });
  } catch (err) {
    logger.error('Complete tech round error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to complete tech round', data: null });
  }
}

/**
 * POST /api/applications/:appId/hr/start
 * Start the HR interview round.
 */
async function startHrRound(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'hr_pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot start HR round. Current status: ${application.status}`,
        data: null,
      });
    }

    const posting = await JobPosting.findById(application.jobPostingId).lean();
    if (!posting?.pipeline?.hrRound?.enabled) {
      return res.status(400).json({
        success: false,
        message: 'HR round is not configured for this job',
        data: null,
      });
    }

    const hrConfig = posting.pipeline.hrRound;

    // Validate time window
    const now = new Date();
    if (now < new Date(hrConfig.window.start)) {
      return res.status(400).json({
        success: false,
        message: 'HR round window has not opened yet',
        data: { opensAt: hrConfig.window.start },
      });
    }
    if (now > new Date(hrConfig.window.end)) {
      return res.status(400).json({
        success: false,
        message: 'HR round window has expired',
        data: { expiredAt: hrConfig.window.end },
      });
    }

    // Prevent re-attempts
    if (application.hrResult?.sessionId) {
      return res.status(409).json({
        success: false,
        message: 'HR round has already been attempted',
        data: null,
      });
    }

    // Create session with HR persona
    const session = await Session.create({
      userId: candidateId,
      domain: 'HR / Culture Fit',
      personaId: 'hr_manager',
      status: 'active',
      startedAt: now,
    });

    application.status = 'hr_in_progress';
    application.hrResult = {
      sessionId: session._id,
      score: null,
      passed: null,
      transcript: '',
      evaluation: null,
      completedAt: null,
    };
    application.lastActivityAt = now;
    await application.save();

    logger.info('HR round started', { appId, candidateId, sessionId: session._id });

    // Append candidate platform context if available
    let candidateContext = '';
    try {
      const candidate = await User.findById(candidateId)
        .select('platformContext')
        .lean();
      if (candidate?.platformContext) {
        candidateContext =
          '\n\n## Candidate Background (from verified external platforms)\n' +
          'Use this to tailor behavioral and culture-fit questions to their actual background.\n' +
          candidate.platformContext;
      }
    } catch (ctxErr) {
      logger.warn('Failed to load candidate platform context for HR round', { err: ctxErr.message });
    }

    return res.json({
      success: true,
      message: 'HR round started',
      data: {
        sessionId: session._id,
        domain: 'HR / Culture Fit',
        personaId: 'hr_manager',
        durationMinutes: hrConfig.durationMinutes,
        jdContext: candidateContext,
      },
    });
  } catch (err) {
    logger.error('Start HR round error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to start HR round', data: null });
  }
}

/**
 * POST /api/applications/:appId/hr/complete
 * Record HR round result after session evaluation.
 */
async function completeHrRound(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    // Try stored session first, then fall back to request body
    const storedSessionId = application.hrResult?.sessionId;
    const bodySessionId = req.body.sessionId;
    let session = null;

    if (storedSessionId) {
      session = await Session.findById(storedSessionId).lean();
    }

    // If stored session isn't completed but caller provided a different completed session
    if ((!session || session.status !== 'completed') && bodySessionId && bodySessionId !== String(storedSessionId)) {
      const altSession = await Session.findById(bodySessionId).lean();
      if (altSession && altSession.status === 'completed') {
        logger.info('Using alternate session from request body for HR round completion', {
          storedSessionId: String(storedSessionId),
          bodySessionId,
        });
        session = altSession;
        application.hrResult.sessionId = bodySessionId;
      }
    }

    if (!session || session.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'HR interview session has not been evaluated yet',
        data: null,
      });
    }

    const posting = await JobPosting.findById(application.jobPostingId).lean();
    const passingScore = posting?.pipeline?.hrRound?.passingScore || 6.0;
    const score = session.overallScore || 0;
    const passed = score >= passingScore;

    application.hrResult.score = score;
    application.hrResult.passed = passed;
    application.hrResult.transcript = session.transcript || '';
    application.hrResult.evaluation = session.starScores || null;
    application.hrResult.completedAt = new Date();

    if (passed) {
      application.status = 'selected';
      application.currentRound = 'completed';
      application.totalScore = calculateTotalScore(application, posting);
    } else {
      application.status = 'hr_failed';
    }

    application.lastActivityAt = new Date();
    await application.save();

    // Recalculate rankings for this job
    await recalculateRankings(application.jobPostingId);

    logger.info('HR round completed', { appId, score, passed, newStatus: application.status });

    return res.json({
      success: true,
      message: passed
        ? 'Congratulations! You have passed all rounds and have been selected.'
        : `HR round score (${score}) below passing threshold (${passingScore})`,
      data: {
        score,
        passingScore,
        passed,
        status: application.status,
        totalScore: application.totalScore,
      },
    });
  } catch (err) {
    logger.error('Complete HR round error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to complete HR round', data: null });
  }
}

/**
 * Calculate total composite score for ranking.
 * Each round contributes equally for selected candidates.
 */
function calculateTotalScore(application, posting) {
  let total = 0;
  let components = 0;

  // MCQ score (percentage, normalize to 0-10)
  if (application.mcqResult?.percentage != null) {
    total += (application.mcqResult.percentage / 100) * 10;
    components++;
  }

  // Tech round scores (average)
  if (application.techResults?.length > 0) {
    const techScores = application.techResults
      .filter(r => r.score != null)
      .map(r => r.score);
    if (techScores.length > 0) {
      const avgTech = techScores.reduce((a, b) => a + b, 0) / techScores.length;
      total += avgTech;
      components++;
    }
  }

  // HR score
  if (application.hrResult?.score != null) {
    total += application.hrResult.score;
    components++;
  }

  return components > 0 ? parseFloat((total / components).toFixed(2)) : 0;
}

/**
 * Recalculate rankings for all selected candidates of a job posting.
 */
async function recalculateRankings(jobPostingId) {
  try {
    const selectedApps = await Application.find({
      jobPostingId,
      status: 'selected',
    }).sort({ totalScore: -1 });

    for (let i = 0; i < selectedApps.length; i++) {
      selectedApps[i].rank = i + 1;
      await selectedApps[i].save();
    }

    logger.info('Rankings recalculated', { jobPostingId, count: selectedApps.length });
  } catch (err) {
    logger.error('Ranking recalculation failed', { err: err.message });
  }
}

module.exports = {
  startTechRound,
  completeTechRound,
  startHrRound,
  completeHrRound,
  recalculateRankings,
};
