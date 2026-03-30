const mongoose = require('mongoose');

const speechMetricsSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true,
  },
  transcript: { type: String, default: '' },
  fillerBuckets: {
    type: [mongoose.Schema.Types.Mixed],
    default: [],
  },
  totalFillers: { type: Number, default: 0 },
  wordsPerMinute: { type: Number, default: 0 },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SpeechMetrics', speechMetricsSchema);
