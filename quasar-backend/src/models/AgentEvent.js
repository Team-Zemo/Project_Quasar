/**
 * Agent Event Model
 * Audit log of every autonomous decision made by the hiring agent.
 * Also used for escalation tracking and recruiter resolution.
 */
const mongoose = require('mongoose');

const agentEventSchema = new mongoose.Schema({
  jobPostingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true,
    index: true,
  },
  applicationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    default: null,
  },

  // Denormalized for fast feed rendering without populating
  candidateName: { type: String, default: null },
  candidateEmail: { type: String, default: null },

  eventType: {
    type: String,
    enum: [
      // ── Autonomous decisions ───────────────────────────────────
      'screening_auto_advanced',
      'screening_auto_rejected',
      'mcq_invitation_sent',
      'mcq_auto_advanced',
      'mcq_auto_rejected',
      'tech_invitation_sent',
      'tech_auto_advanced',
      'tech_auto_rejected',
      'hr_invitation_sent',
      'hr_auto_advanced',
      'hr_auto_rejected',

      // ── Escalations ────────────────────────────────────────────
      'escalation_threshold',       // borderline score
      'escalation_proctor',         // proctoring violation flagged
      'escalation_confidence',      // low AI confidence / high STAR variance
      'escalation_target_reached',  // finalists target hit
      'escalation_deadline',        // deadline approaching

      // ── Recruiter actions ──────────────────────────────────────
      'recruiter_resolved',         // recruiter acted on an escalation

      // ── Agent lifecycle ────────────────────────────────────────
      'agent_started',
      'agent_paused',
      'agent_resumed',
      'agent_completed',

      // ── Digest ─────────────────────────────────────────────────
      'digest_sent',
    ],
    required: true,
    index: true,
  },

  severity: {
    type: String,
    enum: ['info', 'success', 'warning', 'critical'],
    default: 'info',
  },

  // Freeform details object: scores, thresholds, reasons, etc.
  details: { type: mongoose.Schema.Types.Mixed, default: {} },

  // ── Escalation resolution tracking ─────────────────────────────
  resolved: { type: Boolean, default: false },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  resolvedAt: { type: Date, default: null },
  resolution: {
    type: String,
    enum: ['advance', 'reject', null],
    default: null,
  },
}, {
  timestamps: true,
});

// Feed query: most recent events for a job
agentEventSchema.index({ jobPostingId: 1, createdAt: -1 });

// Pending escalations query
agentEventSchema.index({ jobPostingId: 1, eventType: 1, resolved: 1 });

// Digest aggregation: events for a job on a given day
agentEventSchema.index({ jobPostingId: 1, createdAt: 1 });

module.exports = mongoose.model('AgentEvent', agentEventSchema);
