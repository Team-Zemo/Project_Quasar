/**
 * Agent Controller
 * API handlers for the recruiter-facing agent management endpoints.
 * Handles config CRUD, agent lifecycle (start/pause/stop), event feed,
 * escalation resolution, stats, and digest retrieval.
 */
const AgentConfig = require('../models/AgentConfig');
const AgentEvent = require('../models/AgentEvent');
const AgentDigest = require('../models/AgentDigest');
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const User = require('../models/User');
const { sendPipelineNotification } = require('../services/emailService');
const logger = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Verify the recruiter owns the job posting. Returns the posting or null.
 */
async function verifyJobOwnership(jobId, recruiterId) {
  return JobPosting.findOne({ _id: jobId, recruiterId }).select('_id title company pipeline screeningThreshold').lean();
}

// ── Config Management ─────────────────────────────────────────────────

/**
 * GET /api/recruiter/agent/:jobId/config
 * Retrieve the agent configuration for a job posting.
 */
async function getConfig(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId } = req.params;

    const posting = await verifyJobOwnership(jobId, recruiterId);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const config = await AgentConfig.findOne({ jobPostingId: jobId }).lean();

    return res.json({
      success: true,
      message: config ? 'Agent config retrieved' : 'No agent config exists yet',
      data: config || null,
    });
  } catch (err) {
    logger.error('Agent getConfig error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get agent config', data: null });
  }
}

/**
 * PUT /api/recruiter/agent/:jobId/config
 * Create or update agent configuration for a job posting.
 */
async function upsertConfig(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId } = req.params;

    const posting = await verifyJobOwnership(jobId, recruiterId);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const {
      targetFinalists, deadline,
      screeningThreshold, mcqThreshold, techThreshold, hrThreshold,
      escalation,
      autoAdvanceScreening, autoAdvanceMcq, autoAdvanceTech, autoAdvanceHr,
      sendCandidateEmails,
    } = req.body;

    // Whitelist updatable fields
    const updates = { recruiterId, jobPostingId: jobId };

    if (targetFinalists != null) updates.targetFinalists = Math.max(1, Math.min(100, targetFinalists));
    if (deadline !== undefined) updates.deadline = deadline ? new Date(deadline) : null;
    if (screeningThreshold !== undefined) updates.screeningThreshold = screeningThreshold;
    if (mcqThreshold !== undefined) updates.mcqThreshold = mcqThreshold;
    if (techThreshold !== undefined) updates.techThreshold = techThreshold;
    if (hrThreshold !== undefined) updates.hrThreshold = hrThreshold;
    if (escalation) updates.escalation = escalation;
    if (autoAdvanceScreening != null) updates.autoAdvanceScreening = autoAdvanceScreening;
    if (autoAdvanceMcq != null) updates.autoAdvanceMcq = autoAdvanceMcq;
    if (autoAdvanceTech != null) updates.autoAdvanceTech = autoAdvanceTech;
    if (autoAdvanceHr != null) updates.autoAdvanceHr = autoAdvanceHr;
    if (sendCandidateEmails != null) updates.sendCandidateEmails = sendCandidateEmails;

    const config = await AgentConfig.findOneAndUpdate(
      { jobPostingId: jobId },
      { $set: updates },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info('Agent config upserted', { jobId, recruiterId });

    return res.json({
      success: true,
      message: 'Agent configuration saved',
      data: config,
    });
  } catch (err) {
    logger.error('Agent upsertConfig error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to save agent config', data: null });
  }
}

// ── Agent Lifecycle ───────────────────────────────────────────────────

/**
 * POST /api/recruiter/agent/:jobId/start
 * Activate the agent for a job posting.
 */
async function startAgent(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId } = req.params;

    const posting = await verifyJobOwnership(jobId, recruiterId);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    let config = await AgentConfig.findOne({ jobPostingId: jobId });
    if (!config) {
      // Create default config
      config = await AgentConfig.create({
        jobPostingId: jobId,
        recruiterId,
        enabled: true,
        status: 'running',
      });
    } else {
      config.enabled = true;
      config.status = 'running';
      await config.save();
    }

    // Mark the job posting as agent-enabled
    await JobPosting.findByIdAndUpdate(jobId, { agentEnabled: true });

    // Log lifecycle event
    await AgentEvent.create({
      jobPostingId: jobId,
      eventType: 'agent_started',
      severity: 'info',
      details: { startedBy: recruiterId },
    });

    logger.info('Agent started', { jobId, recruiterId });

    return res.json({
      success: true,
      message: 'Hiring agent activated',
      data: config,
    });
  } catch (err) {
    logger.error('Agent startAgent error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to start agent', data: null });
  }
}

/**
 * POST /api/recruiter/agent/:jobId/pause
 * Pause the agent (stops processing but retains config).
 */
async function pauseAgent(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId } = req.params;

    const posting = await verifyJobOwnership(jobId, recruiterId);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const config = await AgentConfig.findOne({ jobPostingId: jobId });
    if (!config) {
      return res.status(404).json({ success: false, message: 'No agent config found', data: null });
    }

    config.status = 'paused';
    await config.save();

    await AgentEvent.create({
      jobPostingId: jobId,
      eventType: 'agent_paused',
      severity: 'info',
      details: { pausedBy: recruiterId },
    });

    logger.info('Agent paused', { jobId, recruiterId });

    return res.json({
      success: true,
      message: 'Hiring agent paused',
      data: config,
    });
  } catch (err) {
    logger.error('Agent pauseAgent error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to pause agent', data: null });
  }
}

/**
 * POST /api/recruiter/agent/:jobId/stop
 * Fully deactivate the agent.
 */
async function stopAgent(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId } = req.params;

    const posting = await verifyJobOwnership(jobId, recruiterId);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const config = await AgentConfig.findOne({ jobPostingId: jobId });
    if (!config) {
      return res.status(404).json({ success: false, message: 'No agent config found', data: null });
    }

    config.enabled = false;
    config.status = 'completed';
    await config.save();

    await JobPosting.findByIdAndUpdate(jobId, { agentEnabled: false });

    await AgentEvent.create({
      jobPostingId: jobId,
      eventType: 'agent_completed',
      severity: 'info',
      details: { stoppedBy: recruiterId },
    });

    logger.info('Agent stopped', { jobId, recruiterId });

    return res.json({
      success: true,
      message: 'Hiring agent deactivated',
      data: config,
    });
  } catch (err) {
    logger.error('Agent stopAgent error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to stop agent', data: null });
  }
}

// ── Event Feed ────────────────────────────────────────────────────────

/**
 * GET /api/recruiter/agent/:jobId/events
 * Paginated activity feed of agent decisions.
 */
async function getEvents(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId } = req.params;
    const { page = 1, limit = 30, type } = req.query;

    const posting = await verifyJobOwnership(jobId, recruiterId);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const filter = { jobPostingId: jobId };
    if (type) {
      filter.eventType = type;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const [events, total] = await Promise.all([
      AgentEvent.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean(),
      AgentEvent.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      message: 'Agent events retrieved',
      data: {
        events,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    logger.error('Agent getEvents error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get agent events', data: null });
  }
}

/**
 * GET /api/recruiter/agent/:jobId/events/escalations
 * Get only pending (unresolved) escalations.
 */
async function getEscalations(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId } = req.params;

    const posting = await verifyJobOwnership(jobId, recruiterId);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const escalations = await AgentEvent.find({
      jobPostingId: jobId,
      eventType: { $regex: /^escalation_/ },
      resolved: false,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Pending escalations retrieved',
      data: {
        escalations,
        total: escalations.length,
      },
    });
  } catch (err) {
    logger.error('Agent getEscalations error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get escalations', data: null });
  }
}

/**
 * POST /api/recruiter/agent/:jobId/events/:eventId/resolve
 * Recruiter resolves an escalation by choosing to advance or reject.
 * Body: { action: 'advance' | 'reject' }
 */
async function resolveEscalation(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId, eventId } = req.params;
    const { action } = req.body;

    if (!['advance', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be "advance" or "reject"',
        data: null,
      });
    }

    const posting = await verifyJobOwnership(jobId, recruiterId);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    // Find the escalation event
    const event = await AgentEvent.findOne({
      _id: eventId,
      jobPostingId: jobId,
      resolved: false,
    });

    if (!event) {
      return res.status(404).json({ success: false, message: 'Escalation not found or already resolved', data: null });
    }

    // Find the application
    const application = await Application.findById(event.applicationId);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found', data: null });
    }

    // Resolve the escalation
    event.resolved = true;
    event.resolvedBy = recruiterId;
    event.resolvedAt = new Date();
    event.resolution = action;
    await event.save();

    // Update the application based on the recruiter's decision
    if (action === 'advance') {
      application.escalated = false;
      application.escalationReason = null;
      application.agentAdvanced = true;

      // Find the next round to advance to
      const { getNextRoundStatus } = require('../services/agentDecisionEngine');
      let currentRound = 'screening';
      if (application.status.startsWith('mcq')) currentRound = 'mcq';
      if (application.status.startsWith('tech')) currentRound = 'tech';
      if (application.status.startsWith('hr')) currentRound = 'hr';

      const nextRound = getNextRoundStatus(currentRound, posting, application);
      if (nextRound) {
        application.status = nextRound.status;
        application.currentRound = nextRound.round;
        if (nextRound.techRoundNumber) {
          application.currentTechRoundNumber = nextRound.techRoundNumber;
        }
      }
    } else {
      // Reject
      application.status = 'rejected';
      application.escalated = false;
      application.escalationReason = null;
      application.agentAdvanced = true;
    }

    application.lastActivityAt = new Date();
    await application.save();

    // Log resolution event
    await AgentEvent.create({
      jobPostingId: jobId,
      applicationId: application._id,
      candidateName: event.candidateName,
      candidateEmail: event.candidateEmail,
      eventType: 'recruiter_resolved',
      severity: 'info',
      details: {
        originalEscalation: event.eventType,
        resolution: action,
        resolvedBy: recruiterId,
      },
    });

    // Update agent stats
    const agentConfig = await AgentConfig.findOne({ jobPostingId: jobId });
    if (agentConfig) {
      const inc = {};
      if (action === 'advance') {
        inc['stats.totalAdvanced'] = 1;
        if (application.status === 'selected') {
          inc['stats.currentFinalists'] = 1;
        }
      } else {
        inc['stats.totalRejected'] = 1;
      }
      await AgentConfig.findByIdAndUpdate(agentConfig._id, { $inc: inc });
    }

    // Send pipeline notification email to the candidate
    try {
      if (event.candidateEmail) {
        const outcome = action === 'advance' ? application.status : 'rejected';
        if (action === 'reject') {
          sendPipelineNotification(
            event.candidateEmail,
            event.candidateName || 'Candidate',
            posting.title,
            posting.company,
            'rejected'
          ).catch(err => logger.warn('Escalation resolution email failed', { err: err.message }));
        }
      }
    } catch (emailErr) {
      logger.warn('Failed to send resolution notification', { err: emailErr.message });
    }

    logger.info('Escalation resolved', { eventId, jobId, action, recruiterId });

    return res.json({
      success: true,
      message: `Escalation resolved — candidate ${action === 'advance' ? 'advanced' : 'rejected'}`,
      data: {
        event: { _id: event._id, resolved: true, resolution: action },
        application: { _id: application._id, status: application.status },
      },
    });
  } catch (err) {
    logger.error('Agent resolveEscalation error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to resolve escalation', data: null });
  }
}

// ── Stats ─────────────────────────────────────────────────────────────

/**
 * GET /api/recruiter/agent/:jobId/stats
 * Get aggregate agent statistics for a job posting.
 */
async function getStats(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId } = req.params;

    const posting = await verifyJobOwnership(jobId, recruiterId);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found', data: null });
    }

    const config = await AgentConfig.findOne({ jobPostingId: jobId })
      .select('stats status enabled targetFinalists deadline')
      .lean();

    // Get pending escalation count
    const pendingEscalations = await AgentEvent.countDocuments({
      jobPostingId: jobId,
      eventType: { $regex: /^escalation_/ },
      resolved: false,
    });

    // Get today's event counts
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEvents = await AgentEvent.countDocuments({
      jobPostingId: jobId,
      createdAt: { $gte: todayStart },
    });

    return res.json({
      success: true,
      message: 'Agent stats retrieved',
      data: {
        ...(config || {}),
        pendingEscalations,
        todayEvents,
      },
    });
  } catch (err) {
    logger.error('Agent getStats error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get agent stats', data: null });
  }
}

// ── Digests ───────────────────────────────────────────────────────────

/**
 * GET /api/recruiter/agent/digests
 * Get all digests for the authenticated recruiter.
 */
async function getDigests(req, res) {
  try {
    const recruiterId = req.user?.id;
    const { jobId, limit = 14 } = req.query;

    const filter = { recruiterId };
    if (jobId) filter.jobPostingId = jobId;

    const digests = await AgentDigest.find(filter)
      .sort({ date: -1 })
      .limit(parseInt(limit, 10))
      .populate('jobPostingId', 'title company')
      .lean();

    return res.json({
      success: true,
      message: 'Digests retrieved',
      data: digests,
    });
  } catch (err) {
    logger.error('Agent getDigests error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to get digests', data: null });
  }
}

module.exports = {
  getConfig,
  upsertConfig,
  startAgent,
  pauseAgent,
  stopAgent,
  getEvents,
  getEscalations,
  resolveEscalation,
  getStats,
  getDigests,
};
