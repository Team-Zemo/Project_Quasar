const mongoose = require('mongoose');

const personaSchema = new mongoose.Schema({
  _id: { type: String },
  name: { type: String, required: true },
  description: { type: String, required: true },
  systemPrompt: { type: String, required: true },
  interruptionStyle: { type: String, default: 'minimal' },
  followUpAggression: { type: Number, default: 3 },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Persona', personaSchema);
