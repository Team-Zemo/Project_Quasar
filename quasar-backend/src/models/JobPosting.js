const mongoose = require('mongoose');

// ── Sub-schemas for pipeline round configuration ──────────────────────

const timeWindowSchema = new mongoose.Schema({
  start: { type: Date, required: true },
  end: { type: Date, required: true },
}, { _id: false });

const mcqRoundConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  durationMinutes: { type: Number, default: 30, min: 5, max: 180 },
  passingScore: { type: Number, default: 60, min: 0, max: 100 }, // percentage
  window: { type: timeWindowSchema, required: true },
}, { _id: false });

const dsaRoundConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  durationMinutes: { type: Number, default: 60, min: 15, max: 240 },
  passingScore: { type: Number, default: 60, min: 0, max: 100 }, // percentage of test cases passed
  window: { type: timeWindowSchema, required: true },
  easyCount: { type: Number, default: 1, min: 0, max: 10 },
  mediumCount: { type: Number, default: 1, min: 0, max: 10 },
  hardCount: { type: Number, default: 0, min: 0, max: 10 },
  allowedLanguages: {
    type: [String],
    default: ['javascript', 'java', 'c', 'cpp', 'kotlin', 'go'],
  },
}, { _id: false });

const techRoundConfigSchema = new mongoose.Schema({
  roundNumber: { type: Number, required: true, min: 1 },
  title: { type: String, required: true, trim: true },
  domain: { type: String, default: 'General', trim: true },
  personaId: { type: String, default: 'faang_engineer' },
  durationMinutes: { type: Number, default: 30, min: 10, max: 120 },
  passingScore: { type: Number, default: 6.0, min: 0, max: 10 }, // out of 10
  window: { type: timeWindowSchema, required: true },
}, { _id: false });

const hrRoundConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  durationMinutes: { type: Number, default: 20, min: 10, max: 60 },
  passingScore: { type: Number, default: 6.0, min: 0, max: 10 }, // out of 10
  window: { type: timeWindowSchema, required: true },
}, { _id: false });

const recruiterInteractionRoundConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
}, { _id: false });

const pipelineConfigSchema = new mongoose.Schema({
  mcqRound: { type: mcqRoundConfigSchema, default: null },
  dsaRound: { type: dsaRoundConfigSchema, default: null },
  techInterviewRounds: { type: [techRoundConfigSchema], default: [] },
  hrRound: { type: hrRoundConfigSchema, default: null },
  recruiterInteractionRound: { type: recruiterInteractionRoundConfigSchema, default: null },
}, { _id: false });

const salaryRangeSchema = new mongoose.Schema({
  min: { type: Number, default: null },
  max: { type: Number, default: null },
  currency: { type: String, default: 'INR', trim: true },
}, { _id: false });

// ── Main JobPosting schema ────────────────────────────────────────────

const jobPostingSchema = new mongoose.Schema({
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  location: { type: String, default: null, trim: true },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship'],
    default: 'full-time',
  },
  salaryRange: { type: salaryRangeSchema, default: null },
  jobDescription: { type: String, required: true },
  parsedJd: { type: mongoose.Schema.Types.Mixed, default: null },

  status: {
    type: String,
    enum: ['draft', 'published', 'closed', 'archived'],
    default: 'draft',
    index: true,
  },

  pipeline: { type: pipelineConfigSchema, default: () => ({}) },

  // Auto-screening config
  autoScreeningEnabled: { type: Boolean, default: true },
  screeningThreshold: { type: Number, default: 50, min: 0, max: 100 }, // min resume match %

  applicantCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Compound index for recruiter's job listings
jobPostingSchema.index({ recruiterId: 1, status: 1 });

// Text index for candidate job browsing & search
jobPostingSchema.index({ title: 'text', company: 'text', jobDescription: 'text' });

module.exports = mongoose.model('JobPosting', jobPostingSchema);
