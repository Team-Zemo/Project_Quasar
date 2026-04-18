/**
 * StudyPlan Model
 * Stores a candidate's AI-generated study plan with a structured
 * day-by-day schedule for cron-driven email reminders.
 * Only ONE plan per user — creating a new plan overrides the old one.
 */
const mongoose = require('mongoose');

const scheduleDaySchema = new mongoose.Schema({
  date:      { type: Date, required: true },
  week:      { type: Number, required: true },
  day:       { type: String, required: true },        // "Mon", "Tue", etc.
  focus:     { type: String, required: true },
  resource:  { type: String, default: '' },
  completed: { type: Boolean, default: false },
}, { _id: false });

const studyPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,                                     // 1 plan per user
  },
  skillToLearn:     { type: String, required: true },
  techStack:        { type: [String], default: [] },
  weeks:            { type: Number, required: true },
  dailyHours:       { type: Number, default: 2 },
  currentLevel:     { type: String, default: '' },
  markdownContent:  { type: String, default: '' },    // full generated markdown
  schedule:         { type: [scheduleDaySchema], default: [] },
  status: {
    type: String,
    enum: ['saved', 'active', 'paused', 'completed'],
    default: 'saved',
  },
  startedAt:          { type: Date, default: null },
  lastEmailSentDate:  { type: Date, default: null },
}, {
  timestamps: true,
});

module.exports = mongoose.model('StudyPlan', studyPlanSchema);
