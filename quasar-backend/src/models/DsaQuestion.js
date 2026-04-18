const mongoose = require('mongoose');

// ── Test case sub-schema ──────────────────────────────────────────────

const testCaseSchema = new mongoose.Schema({
  input: { type: String, default: '', validate: { validator: v => v != null, message: 'Input must not be null' } },
  expectedOutput: { type: String, required: true },
  isHidden: { type: Boolean, default: false },
  timeLimit: { type: Number, default: 2000 },   // ms
  memoryLimit: { type: Number, default: 262144 }, // KB (256MB)
}, { _id: true });

// ── Starter code sub-schema ───────────────────────────────────────────

const starterCodeSchema = new mongoose.Schema({
  javascript: { type: String, default: '' },
  java: { type: String, default: '' },
  c: { type: String, default: '' },
  cpp: { type: String, default: '' },
  kotlin: { type: String, default: '' },
  go: { type: String, default: '' },
}, { _id: false });

// ── Main DsaQuestion schema ──────────────────────────────────────────

const dsaQuestionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true }, // Markdown problem statement
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true,
    index: true,
  },
  domain: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  constraints: { type: String, default: '' },
  inputFormat: { type: String, default: '' },
  outputFormat: { type: String, default: '' },
  sampleInput: { type: String, default: '' },
  sampleOutput: { type: String, default: '' },
  testCases: {
    type: [testCaseSchema],
    validate: {
      validator: function (cases) {
        return cases && cases.length >= 1;
      },
      message: 'At least one test case is required',
    },
  },
  starterCode: { type: starterCodeSchema, default: () => ({}) },
  tags: { type: [String], default: [] },
  source: {
    type: String,
    enum: ['system', 'recruiter'],
    default: 'system',
  },
  // null = global/system question, ObjectId = job-specific recruiter question
  jobPostingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    default: null,
    index: true,
  },
}, {
  timestamps: true,
});

// Compound index for efficient question selection
dsaQuestionSchema.index({ difficulty: 1, source: 1, jobPostingId: 1 });

module.exports = mongoose.model('DsaQuestion', dsaQuestionSchema);
