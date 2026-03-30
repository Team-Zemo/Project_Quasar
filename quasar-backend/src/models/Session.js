const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  domain: { type: String, default: null },
  personaId: { type: String, default: null },
  jdSessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JdSession',
    default: null,
  },
  status: { type: String, default: 'active', enum: ['active', 'completed', 'error'] },
  overallScore: { type: Number, default: null },
  starScores: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  clarityScore: { type: Number, default: null },
  transcript: { type: String, default: '' },
  durationSeconds: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  emotionMetrics: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Session', sessionSchema);
