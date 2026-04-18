/**
 * LaTeX Resume Model
 * Stores candidate-created LaTeX resume versions.
 */
const mongoose = require('mongoose');

const latexResumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    default: 'My Resume',
  },
  templateId: {
    type: String,
    enum: ['classic', 'modern', 'minimal'],
    required: true,
  },
  latexSource: {
    type: String,
    required: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  // MinIO key for compiled PDF (if compiled server-side)
  compiledPdfKey: {
    type: String,
    default: null,
  },
  compiledAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('LatexResume', latexResumeSchema);
