const mongoose = require('mongoose');

// ── MCQ answer sub-schema ─────────────────────────────────────────────

const mcqAnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'McqQuestion', required: true },
  selectedOption: { type: Number, default: -1 }, // index of chosen option, -1 = unanswered
  isCorrect: { type: Boolean, default: false },
  timeTakenSeconds: { type: Number, default: 0 },
}, { _id: false });

const mcqResultSchema = new mongoose.Schema({
  score: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  answers: { type: [mcqAnswerSchema], default: [] },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { _id: false });

// ── Tech interview result sub-schema ──────────────────────────────────

const techResultSchema = new mongoose.Schema({
  roundNumber: { type: Number, required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  score: { type: Number, default: null },
  passed: { type: Boolean, default: null },
  transcript: { type: String, default: '' },
  evaluation: { type: mongoose.Schema.Types.Mixed, default: null },
  completedAt: { type: Date, default: null },
}, { _id: false });

// ── HR result sub-schema ──────────────────────────────────────────────

const hrResultSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  score: { type: Number, default: null },
  passed: { type: Boolean, default: null },
  transcript: { type: String, default: '' },
  evaluation: { type: mongoose.Schema.Types.Mixed, default: null },
  completedAt: { type: Date, default: null },
}, { _id: false });

// ── Screening result sub-schema ───────────────────────────────────────

const screeningResultSchema = new mongoose.Schema({
  matchScore: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  matchedSkills: { type: [String], default: [] },
  missingSkills: { type: [String], default: [] },
  summary: { type: String, default: '' },
  evaluatedAt: { type: Date, default: null },
}, { _id: false });

// ── Main Application schema ───────────────────────────────────────────

const applicationSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  jobPostingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true,
    index: true,
  },

  status: {
    type: String,
    enum: [
      'applied',           // Initial state
      'screening',         // AI resume screening in progress
      'screening_passed',  // Resume matched JD
      'screening_failed',  // Resume didn't match
      'mcq_pending',       // Awaiting MCQ round
      'mcq_in_progress',   // Candidate is taking MCQ
      'mcq_passed',
      'mcq_failed',
      'tech_pending',      // Awaiting next tech round
      'tech_in_progress',  // Candidate is in tech interview
      'tech_passed',       // All tech rounds passed
      'tech_failed',       // Failed a tech round (eliminates)
      'hr_pending',
      'hr_in_progress',
      'hr_passed',
      'hr_failed',
      'selected',          // Passed all rounds
      'rejected',          // Manually rejected by recruiter
      'withdrawn',         // Candidate withdrew
    ],
    default: 'applied',
    index: true,
  },

  currentRound: {
    type: String,
    enum: ['screening', 'mcq', 'tech', 'hr', 'completed'],
    default: 'screening',
  },
  currentTechRoundNumber: { type: Number, default: 1 },

  // Results
  screeningResult: { type: screeningResultSchema, default: null },
  mcqResult: { type: mcqResultSchema, default: null },
  techResults: { type: [techResultSchema], default: [] },
  hrResult: { type: hrResultSchema, default: null },

  // Aggregate scoring (for ranking among fully-passed candidates)
  totalScore: { type: Number, default: 0 },
  rank: { type: Number, default: null },

  appliedAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Prevent duplicate applications
applicationSchema.index({ candidateId: 1, jobPostingId: 1 }, { unique: true });

// For recruiter dashboard queries
applicationSchema.index({ jobPostingId: 1, status: 1, totalScore: -1 });

module.exports = mongoose.model('Application', applicationSchema);
