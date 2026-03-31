const mongoose = require('mongoose');

const badgeSchema = new mongoose.Schema({
  id:          { type: String, required: true },
  name:        { type: String, required: true },
  description: { type: String, required: true },
  icon:        { type: String, required: true },
  unlockedAt:  { type: Date, default: Date.now },
}, { _id: false });

const userStatsSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    unique:   true,
    index:    true,
  },
  xp:               { type: Number, default: 0 },
  level:            { type: Number, default: 1 },
  currentStreak:    { type: Number, default: 0 },
  longestStreak:    { type: Number, default: 0 },
  /** UTC date-only string "YYYY-MM-DD" of the last day a session was evaluated */
  lastPracticeDate: { type: String, default: null },
  totalSessions:    { type: Number, default: 0 },
  domainsPlayed:    { type: [String], default: [] },
  personasUsed:     { type: [String], default: [] },
  jdsParsed:        { type: Number, default: 0 },
  resumeComparesRun:{ type: Number, default: 0 },
  badges:           { type: [badgeSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('UserStats', userStatsSchema);
