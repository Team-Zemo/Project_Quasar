/**
 * Agent Service
 * Orchestrator layer — takes a decision from the engine and executes it:
 * advances/rejects applications, logs events, sends emails, updates stats.
 *
 * This is the single point of mutation for the agent system.
 */
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const AgentConfig = require('../models/AgentConfig');
const AgentEvent = require('../models/AgentEvent');
const User = require('../models/User');
const { evaluateApplication, ACTIONS } = require('./agentDecisionEngine');
const {
  sendMcqInvitation,
  sendTechInterviewInvitation,
  sendHrInterviewInvitation,
  sendEscalationAlert,
} = require('./emailService');
const logger = require('../utils/logger');

// ── Core: Process a single application ────────────────────────────────

/**
 * Called when an application's status changes (from controller hooks or scheduler poll).
 * Loads all required context, runs the decision engine, and executes the result.
 *
 * @param {string} applicationId - The MongoDB ObjectId of the application
 * @returns {object|null} The decision that was executed, or null if skipped
 */
async function onApplicationStatusChanged(applicationId) {
  try {
    const application = await Application.findById(applicationId);
    if (!application) {
      logger.debug('Agent: application not found', { applicationId });
      return null;
    }

    // Load agent config for this job
    const agentConfig = await AgentConfig.findOne({
      jobPostingId: application.jobPostingId,
      enabled: true,
      status: 'running',
    });

    if (!agentConfig) {
      return null; // No active agent for this job
    }

    // Load posting
    const posting = await JobPosting.findById(application.jobPostingId).lean();
    if (!posting) return null;

    // Load candidate for email sending
    const candidate = await User.findById(application.candidateId)
      .select('name email')
      .lean();

    // Run decision engine
    const decision = evaluateApplication(application, agentConfig, posting);

    if (decision.action === ACTIONS.NOOP) {
      return decision;
    }

    // Execute the decision
    await executeDecision(decision, application, agentConfig, posting, candidate);

    return decision;
  } catch (err) {
    logger.error('Agent: onApplicationStatusChanged error', {
      applicationId,
      err: err.message,
    });
    return null;
  }
}

// ── Decision Executor ─────────────────────────────────────────────────

/**
 * Execute a decision returned by the decision engine.
 * Handles status transitions, event logging, stats updates, and email sending.
 */
async function executeDecision(decision, application, agentConfig, posting, candidate) {
  const candidateName = candidate?.name || 'Unknown';
  const candidateEmail = candidate?.email || null;

  switch (decision.action) {
    case ACTIONS.ADVANCE:
      await executeAdvance(decision, application, agentConfig, posting, candidateName, candidateEmail);
      break;

    case ACTIONS.REJECT:
      await executeReject(decision, application, agentConfig, candidateName, candidateEmail);
      break;

    case ACTIONS.ESCALATE:
      await executeEscalate(decision, application, agentConfig, posting, candidateName, candidateEmail);
      break;

    default:
      logger.warn('Agent: unknown decision action', { action: decision.action });
  }
}

// ── Advance ───────────────────────────────────────────────────────────

async function executeAdvance(decision, application, agentConfig, posting, candidateName, candidateEmail) {
  // Update application status
  if (decision.nextStatus) {
    application.status = decision.nextStatus;
  }
  if (decision.nextRound) {
    application.currentRound = decision.nextRound;
  }
  if (decision.techRoundNumber) {
    application.currentTechRoundNumber = decision.techRoundNumber;
  }

  application.agentAdvanced = true;
  application.escalated = false;
  application.escalationReason = null;
  application.lastActivityAt = new Date();
  await application.save();

  // Log agent event
  await AgentEvent.create({
    jobPostingId: application.jobPostingId,
    applicationId: application._id,
    candidateName,
    candidateEmail,
    eventType: decision.eventType,
    severity: decision.severity,
    details: decision.details,
  });

  // Update stats
  await AgentConfig.findByIdAndUpdate(agentConfig._id, {
    $inc: {
      'stats.totalProcessed': 1,
      'stats.totalAdvanced': 1,
      ...(decision.nextStatus === 'selected' ? { 'stats.currentFinalists': 1 } : {}),
    },
  });

  // Send candidate notification emails
  if (agentConfig.sendCandidateEmails && candidateEmail) {
    try {
      await sendRoundInvitationEmail(decision.nextRound, candidateEmail, candidateName, posting);
    } catch (emailErr) {
      logger.warn('Agent: invitation email failed', { err: emailErr.message });
    }
  }

  logger.info('Agent: candidate advanced', {
    appId: application._id,
    candidate: candidateName,
    from: decision.eventType,
    to: decision.nextStatus,
  });
}

// ── Reject ────────────────────────────────────────────────────────────

async function executeReject(decision, application, agentConfig, candidateName, candidateEmail) {
  // Application status should already be in *_failed state from the pipeline controllers,
  // but mark it as agent-processed
  application.agentAdvanced = true;
  application.escalated = false;
  application.escalationReason = null;
  application.lastActivityAt = new Date();
  await application.save();

  // Log agent event
  await AgentEvent.create({
    jobPostingId: application.jobPostingId,
    applicationId: application._id,
    candidateName,
    candidateEmail,
    eventType: decision.eventType,
    severity: decision.severity,
    details: decision.details,
  });

  // Update stats
  await AgentConfig.findByIdAndUpdate(agentConfig._id, {
    $inc: {
      'stats.totalProcessed': 1,
      'stats.totalRejected': 1,
    },
  });

  logger.info('Agent: candidate rejected', {
    appId: application._id,
    candidate: candidateName,
    reason: decision.reason,
  });
}

// ── Escalate ──────────────────────────────────────────────────────────

async function executeEscalate(decision, application, agentConfig, posting, candidateName, candidateEmail) {
  // Mark application as escalated
  application.escalated = true;
  application.escalationReason = decision.reason;
  application.lastActivityAt = new Date();
  await application.save();

  // Log escalation event
  const event = await AgentEvent.create({
    jobPostingId: application.jobPostingId,
    applicationId: application._id,
    candidateName,
    candidateEmail,
    eventType: decision.eventType,
    severity: decision.severity,
    details: decision.details,
    resolved: false,
  });

  // Update stats
  await AgentConfig.findByIdAndUpdate(agentConfig._id, {
    $inc: {
      'stats.totalProcessed': 1,
      'stats.totalEscalated': 1,
    },
  });

  // Send escalation alert to the recruiter
  try {
    const recruiter = await User.findById(agentConfig.recruiterId)
      .select('name email')
      .lean();

    if (recruiter?.email) {
      await sendEscalationAlert(
        recruiter.email,
        recruiter.name || 'Recruiter',
        posting.title,
        posting.company,
        candidateName,
        decision.reason,
        decision.details,
        event._id.toString()
      );
    }
  } catch (emailErr) {
    logger.warn('Agent: escalation email failed', { err: emailErr.message });
  }

  logger.info('Agent: candidate escalated', {
    appId: application._id,
    candidate: candidateName,
    reason: decision.reason,
    eventId: event._id,
  });
}

// ── Email Helpers ─────────────────────────────────────────────────────

/**
 * Send the appropriate round invitation email based on the next round.
 */
async function sendRoundInvitationEmail(nextRound, candidateEmail, candidateName, posting) {
  const mcqConfig = posting.pipeline?.mcqRound;
  const techRounds = posting.pipeline?.techInterviewRounds || [];
  const hrConfig = posting.pipeline?.hrRound;

  switch (nextRound) {
    case 'mcq':
      if (mcqConfig) {
        await sendMcqInvitation(
          candidateEmail,
          candidateName,
          posting.title,
          posting.company,
          mcqConfig.window?.start,
          mcqConfig.window?.end,
          mcqConfig.durationMinutes
        );
        // Log email event
        await AgentEvent.create({
          jobPostingId: posting._id,
          candidateName,
          candidateEmail,
          eventType: 'mcq_invitation_sent',
          severity: 'info',
          details: { window: mcqConfig.window },
        });
      }
      break;

    case 'tech':
      if (techRounds.length > 0) {
        const firstRound = techRounds[0];
        await sendTechInterviewInvitation(
          candidateEmail,
          candidateName,
          posting.title,
          posting.company,
          firstRound.title || `Tech Round ${firstRound.roundNumber}`,
          firstRound.window?.start,
          firstRound.window?.end,
          firstRound.durationMinutes
        );
        await AgentEvent.create({
          jobPostingId: posting._id,
          candidateName,
          candidateEmail,
          eventType: 'tech_invitation_sent',
          severity: 'info',
          details: { roundNumber: firstRound.roundNumber, window: firstRound.window },
        });
      }
      break;

    case 'hr':
      if (hrConfig) {
        await sendHrInterviewInvitation(
          candidateEmail,
          candidateName,
          posting.title,
          posting.company,
          hrConfig.window?.start,
          hrConfig.window?.end,
          hrConfig.durationMinutes
        );
        await AgentEvent.create({
          jobPostingId: posting._id,
          candidateName,
          candidateEmail,
          eventType: 'hr_invitation_sent',
          severity: 'info',
          details: { window: hrConfig.window },
        });
      }
      break;

    default:
      // 'completed' / 'selected' — no invitation needed
      break;
  }
}

// ── Batch Processing (for scheduler) ──────────────────────────────────

/**
 * Process all pending applications for a given agent config.
 * Called by the scheduler's poll job.
 *
 * @param {AgentConfig} agentConfig
 * @returns {number} Number of applications processed
 */
async function processJobApplications(agentConfig) {
  try {
    const posting = await JobPosting.findById(agentConfig.jobPostingId).lean();
    if (!posting) return 0;

    // Find applications that need agent processing:
    // - Belong to this job
    // - Are in a "completed round" status (*_passed or *_failed)
    // - Have NOT been processed by the agent yet
    // - Are NOT currently escalated
    const pendingStatuses = [
      'screening_passed', 'screening_failed',
      'mcq_passed', 'mcq_failed',
      'tech_passed', 'tech_failed',
      'hr_passed', 'hr_failed',
    ];

    const applications = await Application.find({
      jobPostingId: agentConfig.jobPostingId,
      status: { $in: pendingStatuses },
      agentAdvanced: false,
      escalated: false,
    }).limit(50); // Process max 50 per tick to avoid overload

    let processed = 0;
    for (const app of applications) {
      try {
        const result = await onApplicationStatusChanged(app._id);
        if (result && result.action !== ACTIONS.NOOP) {
          processed++;
        }
      } catch (err) {
        logger.error('Agent: failed to process application in batch', {
          appId: app._id,
          err: err.message,
        });
      }
    }

    return processed;
  } catch (err) {
    logger.error('Agent: processJobApplications error', {
      jobId: agentConfig.jobPostingId,
      err: err.message,
    });
    return 0;
  }
}

module.exports = {
  onApplicationStatusChanged,
  processJobApplications,
  executeDecision,
};
