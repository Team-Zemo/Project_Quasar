/**
 * MCQ Round Controller
 * Handles MCQ test lifecycle: start, submit, and result retrieval.
 * Implements time window validation and eliminator logic.
 */
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const McqQuestion = require('../models/McqQuestion');
const agentService = require('../services/agentService');
const logger = require('../utils/logger');

/**
 * POST /api/applications/:appId/mcq/start
 * Start the MCQ test. Validates time window and current status.
 */
async function startMcqTest(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'mcq_pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot start MCQ test. Current status: ${application.status}`,
        data: null,
      });
    }

    // Fetch job posting for pipeline config
    const posting = await JobPosting.findById(application.jobPostingId).lean();
    if (!posting || !posting.pipeline?.mcqRound?.enabled) {
      return res.status(400).json({
        success: false,
        message: 'MCQ round is not configured for this job',
        data: null,
      });
    }

    const mcqConfig = posting.pipeline.mcqRound;

    // Validate time window
    const now = new Date();
    if (now < new Date(mcqConfig.window.start)) {
      return res.status(400).json({
        success: false,
        message: `MCQ test window has not opened yet. Opens at ${mcqConfig.window.start}`,
        data: { opensAt: mcqConfig.window.start },
      });
    }
    if (now > new Date(mcqConfig.window.end)) {
      return res.status(400).json({
        success: false,
        message: 'MCQ test window has expired',
        data: { expiredAt: mcqConfig.window.end },
      });
    }

    // Fetch questions (shuffle order for each candidate)
    const questions = await McqQuestion.find({ jobPostingId: application.jobPostingId })
      .select('question options.text difficulty topic') // Do NOT send isCorrect to client
      .lean();

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No MCQ questions available for this test',
        data: null,
      });
    }

    // Shuffle questions
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }

    // Update application status
    application.status = 'mcq_in_progress';
    application.mcqResult = {
      totalQuestions: questions.length,
      correctAnswers: 0,
      score: 0,
      percentage: 0,
      passed: false,
      answers: [],
      startedAt: now,
      completedAt: null,
    };
    application.lastActivityAt = now;
    await application.save();

    logger.info('MCQ test started', { appId, candidateId, questionCount: questions.length });

    return res.json({
      success: true,
      message: 'MCQ test started',
      data: {
        questions,
        totalQuestions: questions.length,
        durationMinutes: mcqConfig.durationMinutes,
        startedAt: now,
        deadline: new Date(now.getTime() + mcqConfig.durationMinutes * 60 * 1000),
      },
    });
  } catch (err) {
    logger.error('Start MCQ test error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to start MCQ test', data: null });
  }
}

/**
 * POST /api/applications/:appId/mcq/submit
 * Submit MCQ answers. Calculates score and applies eliminator logic.
 * Body: { answers: [{ questionId, selectedOption }] }
 */
async function submitMcqTest(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;
    const { answers } = req.body;

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Answers array is required',
        data: null,
      });
    }

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'mcq_in_progress') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit MCQ. Current status: ${application.status}`,
        data: null,
      });
    }

    // Check if duration exceeded
    const posting = await JobPosting.findById(application.jobPostingId).lean();
    const mcqConfig = posting?.pipeline?.mcqRound;
    const startedAt = application.mcqResult?.startedAt;

    if (startedAt && mcqConfig?.durationMinutes) {
      const deadline = new Date(new Date(startedAt).getTime() + mcqConfig.durationMinutes * 60 * 1000);
      const now = new Date();
      // Allow 30 second grace period for network latency
      if (now > new Date(deadline.getTime() + 30000)) {
        application.status = 'mcq_failed';
        application.mcqResult.passed = false;
        application.mcqResult.completedAt = now;
        application.lastActivityAt = now;
        await application.save();

        return res.status(400).json({
          success: false,
          message: 'MCQ test time limit exceeded',
          data: null,
        });
      }
    }

    // Fetch actual questions with correct answers for grading
    const questionIds = answers.map(a => a.questionId);
    const questions = await McqQuestion.find({
      _id: { $in: questionIds },
      jobPostingId: application.jobPostingId,
    }).lean();

    const questionMap = new Map(questions.map(q => [q._id.toString(), q]));

    // Grade answers
    let correctCount = 0;
    const gradedAnswers = answers.map(answer => {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        return {
          questionId: answer.questionId,
          selectedOption: answer.selectedOption,
          isCorrect: false,
          timeTakenSeconds: answer.timeTakenSeconds || 0,
        };
      }

      const isCorrect = question.options[answer.selectedOption]?.isCorrect === true;
      if (isCorrect) correctCount++;

      return {
        questionId: answer.questionId,
        selectedOption: answer.selectedOption,
        isCorrect,
        timeTakenSeconds: answer.timeTakenSeconds || 0,
      };
    });

    const totalQuestions = questions.length;
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passingScore = mcqConfig?.passingScore || 60;
    const passed = percentage >= passingScore;

    // Update application with MCQ result
    application.mcqResult = {
      score: correctCount,
      totalQuestions,
      correctAnswers: correctCount,
      percentage,
      passed,
      answers: gradedAnswers,
      startedAt: application.mcqResult?.startedAt || new Date(),
      completedAt: new Date(),
    };

    // Eliminator logic: pass → next round, fail → rejected
    if (passed) {
      const techRounds = posting?.pipeline?.techInterviewRounds || [];
      if (techRounds.length > 0) {
        application.status = 'tech_pending';
        application.currentRound = 'tech';
        application.currentTechRoundNumber = 1;
      } else if (posting?.pipeline?.hrRound?.enabled) {
        application.status = 'hr_pending';
        application.currentRound = 'hr';
      } else {
        application.status = 'selected';
        application.currentRound = 'completed';
      }
    } else {
      application.status = 'mcq_failed';
    }

    application.lastActivityAt = new Date();
    await application.save();

    logger.info('MCQ test submitted', {
      appId,
      correctCount,
      totalQuestions,
      percentage,
      passed,
    });

    // ── Agent hook: fire-and-forget ────────────────────────────────────
    agentService.onApplicationStatusChanged(application._id)
      .catch(err => logger.warn('Agent hook failed after MCQ', { err: err.message }));

    return res.json({
      success: true,
      message: passed ? 'MCQ test passed! Advancing to next round.' : 'MCQ test completed. Score below passing threshold.',
      data: {
        score: correctCount,
        totalQuestions,
        percentage,
        passingScore,
        passed,
        status: application.status,
        currentRound: application.currentRound,
      },
    });
  } catch (err) {
    logger.error('Submit MCQ test error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to submit MCQ test', data: null });
  }
}

/**
 * GET /api/applications/:appId/mcq/result
 * View MCQ test result.
 */
async function getMcqResult(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;

    const application = await Application.findOne({ _id: appId, candidateId })
      .select('mcqResult status')
      .lean();

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (!application.mcqResult || !application.mcqResult.completedAt) {
      return res.status(400).json({
        success: false,
        message: 'MCQ test has not been completed yet',
        data: null,
      });
    }

    return res.json({
      success: true,
      message: 'MCQ result retrieved',
      data: {
        mcqResult: application.mcqResult,
        status: application.status,
      },
    });
  } catch (err) {
    logger.error('Get MCQ result error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get MCQ result', data: null });
  }
}

module.exports = { startMcqTest, submitMcqTest, getMcqResult };
