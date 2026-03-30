const mongoose = require('mongoose');

const skillVectorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  skill: { type: String, required: true },
  score: { type: Number, default: 5.0 },
  attemptCount: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

// Compound unique index: one entry per (user, skill)
skillVectorSchema.index({ userId: 1, skill: 1 }, { unique: true });

module.exports = mongoose.model('SkillVector', skillVectorSchema);
