/**
 * DSA Round Controller
 * Manages the DSA coding assessment lifecycle: start, run, submit, and complete.
 * Integrates with Judge0 CE for code compilation and test case evaluation.
 */
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const DsaQuestion = require('../models/DsaQuestion');
const { executeCode, executeTestSuite } = require('../services/judge0Service');
const logger = require('../utils/logger');

/**
 * POST /api/candidate/applications/:appId/dsa/start
 * Start the DSA coding round. Selects questions based on difficulty distribution,
 * validates time window, and returns questions with starter code.
 */
async function startDsaTest(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'dsa_pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot start DSA test. Current status: ${application.status}`,
        data: null,
      });
    }

    // Fetch job posting for pipeline config
    const posting = await JobPosting.findById(application.jobPostingId).lean();
    if (!posting || !posting.pipeline?.dsaRound?.enabled) {
      return res.status(400).json({
        success: false,
        message: 'DSA round is not configured for this job',
        data: null,
      });
    }

    const dsaConfig = posting.pipeline.dsaRound;

    // Validate time window
    const now = new Date();
    if (now < new Date(dsaConfig.window.start)) {
      return res.status(400).json({
        success: false,
        message: `DSA test window has not opened yet. Opens at ${dsaConfig.window.start}`,
        data: { opensAt: dsaConfig.window.start },
      });
    }
    if (now > new Date(dsaConfig.window.end)) {
      return res.status(400).json({
        success: false,
        message: 'DSA test window has expired',
        data: { expiredAt: dsaConfig.window.end },
      });
    }

    // Select questions by difficulty from pool (system + job-specific)
    const questions = await selectQuestions(
      application.jobPostingId,
      dsaConfig.easyCount || 1,
      dsaConfig.mediumCount || 1,
      dsaConfig.hardCount || 0,
    );

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No DSA questions available for this test',
        data: null,
      });
    }

    // Strip hidden test cases — only send sample test cases to client
    const clientQuestions = questions.map(q => ({
      _id: q._id,
      title: q.title,
      description: q.description,
      difficulty: q.difficulty,
      domain: q.domain,
      constraints: q.constraints,
      inputFormat: q.inputFormat,
      outputFormat: q.outputFormat,
      sampleInput: q.sampleInput,
      sampleOutput: q.sampleOutput,
      testCases: q.testCases.filter(tc => !tc.isHidden).map(tc => ({
        _id: tc._id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
      starterCode: q.starterCode,
      tags: q.tags,
    }));

    // Update application status
    application.status = 'dsa_in_progress';
    application.dsaResult = {
      questions: questions.map(q => ({
        questionId: q._id,
        language: 'javascript',
        code: '',
        testCaseResults: [],
        passedCount: 0,
        totalCount: q.testCases.length,
        score: 0,
        submittedAt: null,
      })),
      totalScore: 0,
      percentage: 0,
      passed: false,
      startedAt: now,
      completedAt: null,
    };
    application.lastActivityAt = now;
    await application.save();

    logger.info('DSA test started', { appId, candidateId, questionCount: questions.length });

    return res.json({
      success: true,
      message: 'DSA test started',
      data: {
        questions: clientQuestions,
        totalQuestions: clientQuestions.length,
        durationMinutes: dsaConfig.durationMinutes,
        allowedLanguages: dsaConfig.allowedLanguages || ['javascript', 'java', 'c', 'cpp', 'kotlin', 'go'],
        startedAt: now,
        deadline: new Date(now.getTime() + dsaConfig.durationMinutes * 60 * 1000),
      },
    });
  } catch (err) {
    logger.error('Start DSA test error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to start DSA test', data: null });
  }
}

/**
 * POST /api/candidate/applications/:appId/dsa/run
 * Run code against sample (non-hidden) test cases only — for debugging.
 * Body: { questionId, language, code }
 */
async function runDsaCode(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;
    const { questionId, language, code } = req.body;

    if (!questionId || !language || !code) {
      return res.status(400).json({
        success: false,
        message: 'questionId, language, and code are required',
        data: null,
      });
    }

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'dsa_in_progress') {
      return res.status(400).json({
        success: false,
        message: `Cannot run code. Current status: ${application.status}`,
        data: null,
      });
    }

    // Fetch the question — only sample test cases
    const question = await DsaQuestion.findById(questionId).lean();
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found', data: null });
    }

    const sampleTestCases = question.testCases.filter(tc => !tc.isHidden);

    const finalCode = question.driverCode?.[language]
      ? `${code}\n\n${question.driverCode[language]}`
      : code;

    if (sampleTestCases.length === 0) {
      // Just execute and return stdout/stderr
      const result = await executeCode(finalCode, language, '', 2);
      return res.json({
        success: true,
        message: 'Code executed',
        data: {
          stdout: result.stdout,
          stderr: result.stderr,
          compileOutput: result.compileOutput,
          status: result.status?.description || 'Unknown',
          time: result.time * 1000,
          memory: result.memory,
          results: [],
        },
      });
    }

    // Run against sample test cases
    const { results, passedCount, totalCount } = await executeTestSuite(finalCode, language, sampleTestCases);

    return res.json({
      success: true,
      message: `${passedCount}/${totalCount} sample test cases passed`,
      data: {
        results,
        passedCount,
        totalCount,
      },
    });
  } catch (err) {
    logger.error('Run DSA code error', { err: err.message });
    return res.status(500).json({
      success: false,
      message: err.message?.includes('Judge0') ? 'Code execution service unavailable. Please try again.' : 'Failed to run code',
      data: null,
    });
  }
}

/**
 * POST /api/candidate/applications/:appId/dsa/submit
 * Submit a solution for a single question — runs against ALL test cases (sample + hidden).
 * Body: { questionId, language, code }
 */
async function submitDsaSolution(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;
    const { questionId, language, code } = req.body;

    if (!questionId || !language || !code) {
      return res.status(400).json({
        success: false,
        message: 'questionId, language, and code are required',
        data: null,
      });
    }

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'dsa_in_progress') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit. Current status: ${application.status}`,
        data: null,
      });
    }

    // Check deadline
    const posting = await JobPosting.findById(application.jobPostingId).lean();
    const dsaConfig = posting?.pipeline?.dsaRound;
    const startedAt = application.dsaResult?.startedAt;

    if (startedAt && dsaConfig?.durationMinutes) {
      const deadline = new Date(new Date(startedAt).getTime() + dsaConfig.durationMinutes * 60 * 1000);
      const now = new Date();
      // 30 second grace period
      if (now > new Date(deadline.getTime() + 30000)) {
        return res.status(400).json({
          success: false,
          message: 'DSA test time limit exceeded',
          data: null,
        });
      }
    }

    // Fetch the question — ALL test cases
    const question = await DsaQuestion.findById(questionId).lean();
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found', data: null });
    }

    // Prevent resubmission
    const qIndex = application.dsaResult.questions.findIndex(
      q => q.questionId.toString() === questionId
    );
    if (qIndex >= 0 && application.dsaResult.questions[qIndex].submittedAt) {
      return res.status(400).json({ success: false, message: 'Question already submitted', data: null });
    }

    const finalCode = question.driverCode?.[language]
      ? `${code}\n\n${question.driverCode[language]}`
      : code;

    // Execute against all test cases
    const { results, passedCount, totalCount } = await executeTestSuite(finalCode, language, question.testCases);

    const questionScore = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;



    if (qIndex >= 0) {
      application.dsaResult.questions[qIndex].language = language;
      application.dsaResult.questions[qIndex].code = code;
      application.dsaResult.questions[qIndex].testCaseResults = results.map(r => ({
        passed: r.passed,
        input: r.input,
        expected: r.expected,
        actual: r.actual,
        time: r.time,
        memory: r.memory,
        status: r.status,
      }));
      application.dsaResult.questions[qIndex].passedCount = passedCount;
      application.dsaResult.questions[qIndex].totalCount = totalCount;
      application.dsaResult.questions[qIndex].score = questionScore;
      application.dsaResult.questions[qIndex].submittedAt = new Date();
    }

    application.lastActivityAt = new Date();
    await application.save();

    logger.info('DSA solution submitted', {
      appId, questionId, language, passedCount, totalCount, questionScore,
    });

    // Return results — hide input/expected for hidden test cases in response
    const clientResults = results.map((r, i) => {
      const tc = question.testCases[i];
      if (tc?.isHidden) {
        return {
          passed: r.passed,
          input: '(hidden)',
          expected: '(hidden)',
          actual: r.passed ? '(correct)' : '(incorrect)',
          time: r.time,
          memory: r.memory,
          status: r.status,
          isHidden: true,
        };
      }
      return { ...r, isHidden: false };
    });

    return res.json({
      success: true,
      message: `${passedCount}/${totalCount} test cases passed`,
      data: {
        results: clientResults,
        passedCount,
        totalCount,
        score: questionScore,
      },
    });
  } catch (err) {
    logger.error('Submit DSA solution error', { err: err.message });
    return res.status(500).json({
      success: false,
      message: err.message?.includes('Judge0') ? 'Code execution service unavailable. Please try again.' : 'Failed to submit solution',
      data: null,
    });
  }
}

/**
 * POST /api/candidate/applications/:appId/dsa/complete
 * Finalize the DSA round. Calculates total score and applies eliminator logic.
 */
async function completeDsaTest(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (application.status !== 'dsa_in_progress') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete DSA test. Current status: ${application.status}`,
        data: null,
      });
    }

    const posting = await JobPosting.findById(application.jobPostingId).lean();
    const dsaConfig = posting?.pipeline?.dsaRound;
    const passingScore = dsaConfig?.passingScore || 60;

    // Calculate total score: average of all question scores (each is a percentage)
    const questionResults = application.dsaResult?.questions || [];
    const submittedQuestions = questionResults.filter(q => q.submittedAt);

    let totalPassed = 0;
    let totalTestCases = 0;

    for (const q of questionResults) {
      totalPassed += q.passedCount || 0;
      totalTestCases += q.totalCount || 0;
    }

    const percentage = totalTestCases > 0 ? Math.round((totalPassed / totalTestCases) * 100) : 0;
    const passed = percentage >= passingScore;

    // Update DSA result
    application.dsaResult.totalScore = totalPassed;
    application.dsaResult.percentage = percentage;
    application.dsaResult.passed = passed;
    application.dsaResult.completedAt = new Date();

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
      application.status = 'dsa_failed';
    }

    application.lastActivityAt = new Date();
    await application.save();

    logger.info('DSA test completed', {
      appId,
      totalPassed,
      totalTestCases,
      percentage,
      passed,
      newStatus: application.status,
    });

    return res.json({
      success: true,
      message: passed
        ? 'DSA test passed! Advancing to next round.'
        : `DSA test completed. Score ${percentage}% is below passing threshold of ${passingScore}%.`,
      data: {
        totalPassed,
        totalTestCases,
        percentage,
        passingScore,
        passed,
        status: application.status,
        currentRound: application.currentRound,
        questionsSubmitted: submittedQuestions.length,
        totalQuestions: questionResults.length,
      },
    });
  } catch (err) {
    logger.error('Complete DSA test error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to complete DSA test', data: null });
  }
}

/**
 * Select questions by difficulty from the pool (system + job-specific).
 * Shuffles and picks the requested count for each difficulty.
 */
async function selectQuestions(jobPostingId, easyCount, mediumCount, hardCount) {
  const questions = [];

  for (const [difficulty, count] of [['easy', easyCount], ['medium', mediumCount], ['hard', hardCount]]) {
    if (count <= 0) continue;

    // First pick job-specific questions of this difficulty
    const jobPool = await DsaQuestion.find({
      difficulty,
      jobPostingId,
    }).lean();

    // Shuffle job pool
    for (let i = jobPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [jobPool[i], jobPool[j]] = [jobPool[j], jobPool[i]];
    }

    const selectedForDiff = jobPool.slice(0, count);
    questions.push(...selectedForDiff);

    // If we need more, fetch from system pool
    const remaining = count - selectedForDiff.length;
    if (remaining > 0) {
      const systemPool = await DsaQuestion.find({
        difficulty,
        jobPostingId: null,
        source: 'system',
      }).lean();

      for (let i = systemPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [systemPool[i], systemPool[j]] = [systemPool[j], systemPool[i]];
      }

      questions.push(...systemPool.slice(0, remaining));
    }
  }

  return questions;
}

module.exports = {
  startDsaTest,
  runDsaCode,
  submitDsaSolution,
  completeDsaTest,
};
