/**
 * Agent Scheduler
 * Background job system using node-cron. Three recurring jobs:
 *   1. Pipeline poller  — every 60s, processes pending applications
 *   2. Daily digest     — 9 PM IST, generates and emails daily summaries
 *   3. Deadline checker  — 9 AM IST, escalates jobs approaching deadlines
 *
 * Uses an isProcessing lock to prevent overlapping poll ticks.
 */
const cron = require('node-cron');
const AgentConfig = require('../models/AgentConfig');
const AgentEvent = require('../models/AgentEvent');
const AgentDigest = require('../models/AgentDigest');
const Application = require('../models/Application');
const JobPosting = require('../models/JobPosting');
const User = require('../models/User');
const { processJobApplications } = require('./agentService');
const { checkDeadline } = require('./agentDecisionEngine');
const { sendDailyDigest, sendEscalationAlert } = require('./emailService');
const logger = require('../utils/logger');

class AgentScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
    this._isProcessingPoll = false;
    this._isProcessingDigest = false;
  }

  /**
   * Start all cron jobs. Call once after database connection is established.
   */
  start() {
    // ── Pipeline Poller: every 60 seconds ──────────────────────────────
    this.jobs.push(
      cron.schedule('*/60 * * * * *', () => this._pollPipelineEvents(), {
        scheduled: true,
      })
    );

    // ── Daily Digest: every day at 9:00 PM IST ────────────────────────
    this.jobs.push(
      cron.schedule('0 21 * * *', () => this._generateDailyDigests(), {
        timezone: 'Asia/Kolkata',
        scheduled: true,
      })
    );

    // ── Deadline Check: every day at 9:00 AM IST ──────────────────────
    this.jobs.push(
      cron.schedule('0 9 * * *', () => this._checkDeadlines(), {
        timezone: 'Asia/Kolkata',
        scheduled: true,
      })
    );

    this.isRunning = true;
    logger.info('🤖 Agent scheduler started — pipeline poll (60s), digest (21:00 IST), deadline check (09:00 IST)');
  }

  /**
   * Stop all cron jobs gracefully.
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    this.isRunning = false;
    logger.info('🤖 Agent scheduler stopped');
  }

  // ── Pipeline Poller ─────────────────────────────────────────────────

  async _pollPipelineEvents() {
    // Prevent overlapping ticks
    if (this._isProcessingPoll) {
      return;
    }

    this._isProcessingPoll = true;

    try {
      // Find all active agent configs
      const activeConfigs = await AgentConfig.find({
        enabled: true,
        status: 'running',
      }).lean();

      if (activeConfigs.length === 0) {
        this._isProcessingPoll = false;
        return;
      }

      let totalProcessed = 0;

      for (const config of activeConfigs) {
        try {
          // Re-fetch as full document for the service
          const agentConfig = await AgentConfig.findById(config._id);
          if (!agentConfig) continue;

          const count = await processJobApplications(agentConfig);
          totalProcessed += count;
        } catch (err) {
          logger.error('Agent poll: error processing job config', {
            configId: config._id,
            jobId: config.jobPostingId,
            err: err.message,
          });
        }
      }

      if (totalProcessed > 0) {
        logger.info(`🤖 Agent poll: processed ${totalProcessed} applications across ${activeConfigs.length} jobs`);
      }
    } catch (err) {
      logger.error('Agent poll: critical error', { err: err.message });
    } finally {
      this._isProcessingPoll = false;
    }
  }

  // ── Daily Digest Generator ──────────────────────────────────────────

  async _generateDailyDigests() {
    if (this._isProcessingDigest) return;
    this._isProcessingDigest = true;

    try {
      const activeConfigs = await AgentConfig.find({
        enabled: true,
        status: { $in: ['running', 'paused'] },
      }).lean();

      if (activeConfigs.length === 0) {
        this._isProcessingDigest = false;
        return;
      }

      // Today's date range (midnight to midnight IST)
      const now = new Date();
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      for (const config of activeConfigs) {
        try {
          await this._generateDigestForJob(config, todayStart, todayEnd);
        } catch (err) {
          logger.error('Agent digest: error generating digest', {
            jobId: config.jobPostingId,
            err: err.message,
          });
        }
      }

      logger.info(`🤖 Agent digest: generated ${activeConfigs.length} daily digests`);
    } catch (err) {
      logger.error('Agent digest: critical error', { err: err.message });
    } finally {
      this._isProcessingDigest = false;
    }
  }

  async _generateDigestForJob(config, todayStart, todayEnd) {
    const posting = await JobPosting.findById(config.jobPostingId)
      .select('title company')
      .lean();
    if (!posting) return;

    // Aggregate today's events
    const events = await AgentEvent.find({
      jobPostingId: config.jobPostingId,
      createdAt: { $gte: todayStart, $lt: todayEnd },
    }).lean();

    // Count events by type
    const counts = {};
    for (const event of events) {
      counts[event.eventType] = (counts[event.eventType] || 0) + 1;
    }

    // Count today's new applications
    const newApplications = await Application.countDocuments({
      jobPostingId: config.jobPostingId,
      appliedAt: { $gte: todayStart, $lt: todayEnd },
    });

    // Count pending escalations
    const pendingEscalations = await AgentEvent.countDocuments({
      jobPostingId: config.jobPostingId,
      eventType: { $regex: /^escalation_/ },
      resolved: false,
    });

    // Build summary
    const summary = {
      newApplications,
      screeningPassed: (counts.screening_auto_advanced || 0),
      screeningFailed: (counts.screening_auto_rejected || 0),
      mcqCompleted: (counts.mcq_auto_advanced || 0) + (counts.mcq_auto_rejected || 0),
      mcqPassed: (counts.mcq_auto_advanced || 0),
      techCompleted: (counts.tech_auto_advanced || 0) + (counts.tech_auto_rejected || 0),
      techPassed: (counts.tech_auto_advanced || 0),
      hrCompleted: (counts.hr_auto_advanced || 0) + (counts.hr_auto_rejected || 0),
      hrPassed: (counts.hr_auto_advanced || 0),
      escalations: Object.entries(counts)
        .filter(([k]) => k.startsWith('escalation_'))
        .reduce((sum, [, v]) => sum + v, 0),
      pendingEscalations,
      currentFinalists: config.stats?.currentFinalists || 0,
      targetFinalists: config.targetFinalists || 5,
    };

    // Build highlight bullet points
    const highlights = [];
    if (summary.newApplications > 0) {
      highlights.push(`${summary.newApplications} new application${summary.newApplications > 1 ? 's' : ''} received`);
    }
    if (summary.screeningPassed > 0) {
      highlights.push(`${summary.screeningPassed} candidate${summary.screeningPassed > 1 ? 's' : ''} passed screening and advanced`);
    }
    if (summary.mcqPassed > 0) {
      highlights.push(`${summary.mcqPassed} candidate${summary.mcqPassed > 1 ? 's' : ''} passed MCQ assessment`);
    }
    if (summary.techPassed > 0) {
      highlights.push(`${summary.techPassed} candidate${summary.techPassed > 1 ? 's' : ''} passed technical interview`);
    }
    if (summary.hrPassed > 0) {
      highlights.push(`${summary.hrPassed} candidate${summary.hrPassed > 1 ? 's' : ''} passed HR interview`);
    }
    if (summary.pendingEscalations > 0) {
      highlights.push(`⚠️ ${summary.pendingEscalations} escalation${summary.pendingEscalations > 1 ? 's' : ''} pending your review`);
    }
    highlights.push(`Finalist progress: ${summary.currentFinalists}/${summary.targetFinalists}`);

    // Save or update digest
    const digest = await AgentDigest.findOneAndUpdate(
      { jobPostingId: config.jobPostingId, date: todayStart },
      {
        recruiterId: config.recruiterId,
        jobPostingId: config.jobPostingId,
        date: todayStart,
        summary,
        highlights,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send digest email if not already sent
    if (!digest.emailSent) {
      try {
        const recruiter = await User.findById(config.recruiterId)
          .select('name email')
          .lean();

        if (recruiter?.email) {
          await sendDailyDigest(
            recruiter.email,
            recruiter.name || 'Recruiter',
            posting.title,
            posting.company,
            summary,
            highlights
          );

          digest.emailSent = true;
          digest.emailSentAt = new Date();
          await digest.save();

          // Log digest event
          await AgentEvent.create({
            jobPostingId: config.jobPostingId,
            eventType: 'digest_sent',
            severity: 'info',
            details: { date: todayStart, summary },
          });
        }
      } catch (emailErr) {
        logger.warn('Agent digest: email send failed', { err: emailErr.message });
      }
    }
  }

  // ── Deadline Checker ────────────────────────────────────────────────

  async _checkDeadlines() {
    try {
      // Find configs with deadlines within the next 24 hours
      const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const configs = await AgentConfig.find({
        enabled: true,
        status: 'running',
        deadline: { $ne: null, $lte: cutoff },
      }).lean();

      for (const config of configs) {
        try {
          const decision = checkDeadline(config);
          if (!decision) continue;

          // Check if we already escalated for this deadline today
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          const alreadyEscalated = await AgentEvent.findOne({
            jobPostingId: config.jobPostingId,
            eventType: 'escalation_deadline',
            createdAt: { $gte: todayStart },
          });

          if (alreadyEscalated) continue;

          // Create escalation event
          await AgentEvent.create({
            jobPostingId: config.jobPostingId,
            eventType: decision.eventType,
            severity: decision.severity,
            details: decision.details,
            resolved: false,
          });

          // Notify recruiter
          const posting = await JobPosting.findById(config.jobPostingId)
            .select('title company')
            .lean();
          const recruiter = await User.findById(config.recruiterId)
            .select('name email')
            .lean();

          if (recruiter?.email && posting) {
            await sendEscalationAlert(
              recruiter.email,
              recruiter.name || 'Recruiter',
              posting.title,
              posting.company,
              'System',
              decision.reason,
              decision.details,
              null
            );
          }

          logger.info('Agent deadline: escalation created', {
            jobId: config.jobPostingId,
            reason: decision.reason,
          });
        } catch (err) {
          logger.error('Agent deadline: error checking config', {
            configId: config._id,
            err: err.message,
          });
        }
      }
    } catch (err) {
      logger.error('Agent deadline: critical error', { err: err.message });
    }
  }
}

// Singleton instance
const scheduler = new AgentScheduler();

module.exports = scheduler;
