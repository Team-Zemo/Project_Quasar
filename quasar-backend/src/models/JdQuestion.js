const mongoose = require('mongoose');

const jdQuestionSchema = new mongoose.Schema({
  jdSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JdSession',
    required: true,
    index: true,
  },
  question: { type: String, required: true },
  category: { type: String, default: null },
  difficulty: { type: Number, default: 1 },
  targetSkill: { type: String, default: null },
  weight: { type: Number, default: 0.5 },
  lastAttemptedSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    default: null,
  },
  lastScore: { type: Number, default: null },
}, {
  timestamps: true,
});

module.exports = mongoose.model('JdQuestion', jdQuestionSchema);
