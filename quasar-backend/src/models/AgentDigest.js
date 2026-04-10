/**
 * Agent Digest Model
 * Stores daily summary records of agent activity per job posting.
 * Used for the daily recruiter digest email and historical reference.
 */
const mongoose = require('mongoose');

const digestSummarySchema = new mongoose.Schema({
  newApplications: { type: Number, default: 0 },
  screeningPassed: { type: Number, default: 0 },
  screeningFailed: { type: Number, default: 0 },
  mcqCompleted: { type: Number, default: 0 },
  mcqPassed: { type: Number, default: 0 },
  techCompleted: { type: Number, default: 0 },
  techPassed: { type: Number, default: 0 },
  hrCompleted: { type: Number, default: 0 },
  hrPassed: { type: Number, default: 0 },
  escalations: { type: Number, default: 0 },
  pendingEscalations: { type: Number, default: 0 },
  currentFinalists: { type: Number, default: 0 },
  targetFinalists: { type: Number, default: 0 },
}, { _id: false });

const agentDigestSchema = new mongoose.Schema({
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  jobPostingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true,
  },
  date: { type: Date, required: true },  // midnight (start) of the digest day

  summary: { type: digestSummarySchema, default: () => ({}) },

  // Human-readable bullet-point highlights for the email
  highlights: [{ type: String }],

  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date, default: null },
}, {
  timestamps: true,
});

// Prevent duplicate digests per job per day
agentDigestSchema.index({ jobPostingId: 1, date: 1 }, { unique: true });

// Recruiter's digest feed, most recent first
agentDigestSchema.index({ recruiterId: 1, date: -1 });

module.exports = mongoose.model('AgentDigest', agentDigestSchema);
