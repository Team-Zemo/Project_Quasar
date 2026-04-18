/**
 * Proctoring Controller
 * Handles violation logging from candidates during exams
 * and proctoring report retrieval for recruiters.
 */
const Application = require('../models/Application');
const logger = require('../utils/logger');

// Severity config — critical violations reduce trust more
const SEVERITY_MAP = {
  fullscreen_exit: 'critical',
  right_click: 'warning',
  tab_switch: 'critical',
  copy_paste: 'warning',
  keyboard_shortcut: 'warning',
  devtools_open: 'critical',
  multi_monitor: 'warning',
  print_screen: 'warning',
};

const TRUST_PENALTY = {
  warning: 2,   // -2 per warning
  critical: 5,  // -5 per critical
};

/**
 * POST /api/candidate/applications/:appId/proctor/violation
 * Log a proctoring violation during an exam.
 * Body: { type, round, roundNumber?, details? }
 *
 * Returns updated violation counts + whether auto-termination should occur.
 */
async function logViolation(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;
    const { type, round, roundNumber = 1, details = '' } = req.body;

    if (!type || !round) {
      return res.status(400).json({
        success: false,
        message: 'type and round are required',
        data: null,
      });
    }

    const validTypes = [
      'fullscreen_exit', 'right_click', 'tab_switch', 'copy_paste',
      'keyboard_shortcut', 'devtools_open', 'multi_monitor', 'print_screen',
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid violation type: ${type}`,
        data: null,
      });
    }

    const validRounds = ['mcq', 'dsa', 'tech', 'hr'];
    if (!validRounds.includes(round)) {
      return res.status(400).json({
        success: false,
        message: `Invalid round: ${round}`,
        data: null,
      });
    }

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    const severity = SEVERITY_MAP[type] || 'warning';
    const violation = {
      type,
      round,
      roundNumber,
      timestamp: new Date(),
      details,
      severity,
    };

    // Push violation
    application.proctoringViolations.push(violation);

    // Update aggregate flags
    if (!application.proctoringFlags) {
      application.proctoringFlags = {
        totalViolations: 0,
        criticalViolations: 0,
        autoTerminated: false,
        autoTerminatedRound: null,
        trustScore: 100,
      };
    }

    application.proctoringFlags.totalViolations += 1;
    if (severity === 'critical') {
      application.proctoringFlags.criticalViolations += 1;
    }

    // Calculate trust score
    const penalty = TRUST_PENALTY[severity] || 2;
    application.proctoringFlags.trustScore = Math.max(
      0,
      application.proctoringFlags.trustScore - penalty,
    );

    // Check auto-termination threshold
    // Auto-terminate if: 5+ critical violations OR trust score drops to 0
    const shouldAutoTerminate =
      application.proctoringFlags.criticalViolations >= 5 ||
      application.proctoringFlags.trustScore <= 0;

    if (shouldAutoTerminate && !application.proctoringFlags.autoTerminated) {
      application.proctoringFlags.autoTerminated = true;
      application.proctoringFlags.autoTerminatedRound = round;
      logger.warn('Proctoring auto-termination triggered', {
        appId,
        candidateId,
        round,
        criticalViolations: application.proctoringFlags.criticalViolations,
        trustScore: application.proctoringFlags.trustScore,
      });
    }

    application.lastActivityAt = new Date();
    await application.save();

    logger.info('Proctoring violation logged', {
      appId,
      candidateId,
      type,
      round,
      severity,
      totalViolations: application.proctoringFlags.totalViolations,
      trustScore: application.proctoringFlags.trustScore,
    });

    return res.json({
      success: true,
      message: 'Violation logged',
      data: {
        totalViolations: application.proctoringFlags.totalViolations,
        criticalViolations: application.proctoringFlags.criticalViolations,
        trustScore: application.proctoringFlags.trustScore,
        shouldAutoTerminate,
      },
    });
  } catch (err) {
    logger.error('Log proctoring violation error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to log violation', data: null });
  }
}

/**
 * POST /api/candidate/applications/:appId/proctor/violations/batch
 * Log multiple violations at once (for offline batching).
 * Body: { violations: [{ type, round, roundNumber?, details?, timestamp? }] }
 */
async function logViolationsBatch(req, res) {
  try {
    const candidateId = req.user?.id;
    const { appId } = req.params;
    const { violations } = req.body;

    if (!Array.isArray(violations) || violations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'violations array is required',
        data: null,
      });
    }

    const application = await Application.findOne({ _id: appId, candidateId });
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    if (!application.proctoringFlags) {
      application.proctoringFlags = {
        totalViolations: 0,
        criticalViolations: 0,
        autoTerminated: false,
        autoTerminatedRound: null,
        trustScore: 100,
      };
    }

    for (const v of violations) {
      const severity = SEVERITY_MAP[v.type] || 'warning';
      application.proctoringViolations.push({
        type: v.type,
        round: v.round,
        roundNumber: v.roundNumber || 1,
        timestamp: v.timestamp ? new Date(v.timestamp) : new Date(),
        details: v.details || '',
        severity,
      });

      application.proctoringFlags.totalViolations += 1;
      if (severity === 'critical') {
        application.proctoringFlags.criticalViolations += 1;
      }

      const penalty = TRUST_PENALTY[severity] || 2;
      application.proctoringFlags.trustScore = Math.max(
        0,
        application.proctoringFlags.trustScore - penalty,
      );
    }

    const shouldAutoTerminate =
      application.proctoringFlags.criticalViolations >= 5 ||
      application.proctoringFlags.trustScore <= 0;

    if (shouldAutoTerminate && !application.proctoringFlags.autoTerminated) {
      application.proctoringFlags.autoTerminated = true;
      application.proctoringFlags.autoTerminatedRound = violations[0]?.round || 'unknown';
    }

    application.lastActivityAt = new Date();
    await application.save();

    logger.info('Proctoring violations batch logged', {
      appId,
      count: violations.length,
      totalViolations: application.proctoringFlags.totalViolations,
    });

    return res.json({
      success: true,
      message: `${violations.length} violations logged`,
      data: {
        totalViolations: application.proctoringFlags.totalViolations,
        criticalViolations: application.proctoringFlags.criticalViolations,
        trustScore: application.proctoringFlags.trustScore,
        shouldAutoTerminate,
      },
    });
  } catch (err) {
    logger.error('Batch log proctoring violations error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to log violations', data: null });
  }
}

/**
 * GET /api/recruiter/jobs/:id/applicants/:appId/proctor
 * Retrieve proctoring report for a specific applicant.
 */
async function getProctoringReport(req, res) {
  try {
    const { id: jobId, appId } = req.params;

    const application = await Application.findOne({
      _id: appId,
      jobPostingId: jobId,
    })
      .select('proctoringViolations proctoringFlags candidateId')
      .populate('candidateId', 'name email')
      .lean();

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    // Group violations by round
    const byRound = {};
    for (const v of application.proctoringViolations || []) {
      const key = v.roundNumber > 1 ? `${v.round}_${v.roundNumber}` : v.round;
      if (!byRound[key]) byRound[key] = [];
      byRound[key].push(v);
    }

    // Group violations by type for summary
    const byType = {};
    for (const v of application.proctoringViolations || []) {
      if (!byType[v.type]) byType[v.type] = 0;
      byType[v.type]++;
    }

    return res.json({
      success: true,
      message: 'Proctoring report retrieved',
      data: {
        flags: application.proctoringFlags || {
          totalViolations: 0,
          criticalViolations: 0,
          autoTerminated: false,
          trustScore: 100,
        },
        violations: application.proctoringViolations || [],
        byRound,
        byType,
        candidate: application.candidateId,
      },
    });
  } catch (err) {
    logger.error('Get proctoring report error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get proctoring report', data: null });
  }
}

module.exports = { logViolation, logViolationsBatch, getProctoringReport };
