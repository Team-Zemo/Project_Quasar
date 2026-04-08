const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  isCorrect: { type: Boolean, default: false },
}, { _id: false });

const mcqQuestionSchema = new mongoose.Schema({
  jobPostingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobPosting',
    required: true,
    index: true,
  },
  question: { type: String, required: true, trim: true },
  options: {
    type: [optionSchema],
    validate: {
      validator: function (opts) {
        return opts && opts.length >= 2 && opts.length <= 6;
      },
      message: 'Each question must have between 2 and 6 options',
    },
  },
  explanation: { type: String, default: null, trim: true },
  difficulty: {
    type: Number,
    enum: [1, 2, 3],
    default: 2,
  },
  topic: { type: String, default: null, trim: true },
  source: {
    type: String,
    enum: ['recruiter', 'ai_generated'],
    default: 'recruiter',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('McqQuestion', mcqQuestionSchema);
