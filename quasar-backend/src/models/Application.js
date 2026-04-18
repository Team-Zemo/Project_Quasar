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

// ── DSA result sub-schema ─────────────────────────────────────────────

const dsaTestCaseResultSchema = new mongoose.Schema({
  passed: { type: Boolean, default: false },
  input: { type: String, default: '' },
  expected: { type: String, default: '' },
  actual: { type: String, default: '' },
  time: { type: Number, default: 0 },    // ms
  memory: { type: Number, default: 0 },  // KB
  status: { type: String, default: '' },  // e.g. 'Accepted', 'Wrong Answer', 'TLE', 'MLE', 'Runtime Error'
}, { _id: false });

const dsaQuestionResultSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DsaQuestion', required: true },
  language: { type: String, default: 'javascript' },
  code: { type: String, default: '' },
  testCaseResults: { type: [dsaTestCaseResultSchema], default: [] },
  passedCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  score: { type: Number, default: 0 }, // percentage for this question
  submittedAt: { type: Date, default: null },
}, { _id: false });

const dsaResultSchema = new mongoose.Schema({
  questions: { type: [dsaQuestionResultSchema], default: [] },
  totalScore: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  startedAt: { type: Date, default: null },
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

// ── Recruiter interaction result sub-schema ────────────────────────────

const recruiterInteractionResultSchema = new mongoose.Schema({
  meetLink:      { type: String, default: '' },
  scheduledAt:   { type: Date, default: null },
  passed:        { type: Boolean, default: null },
  notes:         { type: String, default: '' },
  completedAt:   { type: Date, default: null },
}, { _id: false });

// ── Proctoring violation sub-schema ───────────────────────────────────

const proctoringViolationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'fullscreen_exit', 'right_click', 'tab_switch', 'copy_paste',
      'keyboard_shortcut', 'devtools_open', 'multi_monitor', 'print_screen',
    ],
    required: true,
  },
  round: { type: String, enum: ['mcq', 'dsa', 'tech', 'hr'], required: true },
  roundNumber: { type: Number, default: 1 },
  timestamp: { type: Date, default: Date.now },
  details: { type: String, default: '' },
  severity: { type: String, enum: ['warning', 'critical'], default: 'warning' },
}, { _id: false });

const proctoringFlagsSchema = new mongoose.Schema({
  totalViolations: { type: Number, default: 0 },
  criticalViolations: { type: Number, default: 0 },
  autoTerminated: { type: Boolean, default: false },
  autoTerminatedRound: { type: String, default: null },
  trustScore: { type: Number, default: 100 },
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
      'dsa_pending',       // Awaiting DSA coding round
      'dsa_in_progress',   // Candidate is taking DSA test
      'dsa_passed',
      'dsa_failed',
      'tech_pending',      // Awaiting next tech round
      'tech_in_progress',  // Candidate is in tech interview
      'tech_passed',       // All tech rounds passed
      'tech_failed',       // Failed a tech round (eliminates)
      'hr_pending',
      'hr_in_progress',
      'hr_passed',
      'hr_failed',
      'ri_pending',        // Awaiting recruiter interaction scheduling
      'ri_scheduled',      // Meeting scheduled, waiting for it to happen
      'ri_passed',
      'ri_failed',
      'selected',          // Passed all rounds
      'rejected',          // Manually rejected by recruiter
      'withdrawn',         // Candidate withdrew
    ],
    default: 'applied',
    index: true,
  },

  currentRound: {
    type: String,
    enum: ['screening', 'mcq', 'dsa', 'tech', 'hr', 'recruiter_interaction', 'completed'],
    default: 'screening',
  },
  currentTechRoundNumber: { type: Number, default: 1 },

  // Results
  screeningResult: { type: screeningResultSchema, default: null },
  mcqResult: { type: mcqResultSchema, default: null },
  dsaResult: { type: dsaResultSchema, default: null },
  techResults: { type: [techResultSchema], default: [] },
  hrResult: { type: hrResultSchema, default: null },
  recruiterInteractionResult: { type: recruiterInteractionResultSchema, default: null },

  // Proctoring
  proctoringViolations: { type: [proctoringViolationSchema], default: [] },
  proctoringFlags: { type: proctoringFlagsSchema, default: () => ({}) },

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
