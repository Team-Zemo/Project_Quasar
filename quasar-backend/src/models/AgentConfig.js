/**
 * Agent Configuration Model
 * Stores recruiter's goal, thresholds, escalation rules, and capabilities
 * for the autonomous hiring agent per job posting. One config per job.
 */
const mongoose = require('mongoose');

// ── Escalation rules sub-schema ───────────────────────────────────────

const escalationSchema = new mongoose.Schema({
  thresholdMarginPercent: { type: Number, default: 5, min: 0, max: 25 },
  // e.g. 5 → if cutoff is 70%, escalate scores between 65-70%
  onProctoringFlag: { type: Boolean, default: true },
  onLowAiConfidence: { type: Boolean, default: true },
  onTargetReached: { type: Boolean, default: true },
}, { _id: false });

// ── Agent stats sub-schema ────────────────────────────────────────────

const agentStatsSchema = new mongoose.Schema({
  totalProcessed: { type: Number, default: 0 },
  totalAdvanced: { type: Number, default: 0 },
  totalRejected: { type: Number, default: 0 },
  totalEscalated: { type: Number, default: 0 },
  currentFinalists: { type: Number, default: 0 },
}, { _id: false });

// ── Main AgentConfig schema ───────────────────────────────────────────

const agentConfigSchema = new mongoose.Schema({
  jobPostingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true,
    unique: true,    // one config per job posting
    index: true,
  },
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // ── Agent State ───────────────────────────────────────────────
  enabled: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['idle', 'running', 'paused', 'completed'],
    default: 'idle',
  },

  // ── Goal Definition ───────────────────────────────────────────
  targetFinalists: { type: Number, default: 5, min: 1, max: 100 },
  deadline: { type: Date, default: null },

  // ── Threshold Overrides ───────────────────────────────────────
  // When null, the agent inherits from JobPosting.pipeline config
  screeningThreshold: { type: Number, default: null, min: 0, max: 100 },
  mcqThreshold: { type: Number, default: null, min: 0, max: 100 },
  techThreshold: { type: Number, default: null, min: 0, max: 10 },
  hrThreshold: { type: Number, default: null, min: 0, max: 10 },

  // ── Escalation Rules ──────────────────────────────────────────
  escalation: { type: escalationSchema, default: () => ({}) },

  // ── Agent Capabilities ────────────────────────────────────────
  autoAdvanceScreening: { type: Boolean, default: true },
  autoAdvanceMcq: { type: Boolean, default: true },
  autoAdvanceTech: { type: Boolean, default: true },
  autoAdvanceHr: { type: Boolean, default: true },
  sendCandidateEmails: { type: Boolean, default: true },

  // ── Stats (maintained by the agent service) ────────────────────
  stats: { type: agentStatsSchema, default: () => ({}) },
}, {
  timestamps: true,
});

// Compound index for scheduler polling
agentConfigSchema.index({ enabled: 1, status: 1 });

module.exports = mongoose.model('AgentConfig', agentConfigSchema);
