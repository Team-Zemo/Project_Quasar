const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: { type: String, default: null },
  name: { type: String, required: true, trim: true },
  googleId: { type: String, unique: true, sparse: true },
  githubId: { type: String, unique: true, sparse: true },
  avatarUrl: { type: String, default: null },
  passwordResetToken: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },

  // ── Role-based fields ───────────────────────────────────────────
  role: {
    type: String,
    enum: ['candidate', 'recruiter'],
    default: null,
  },
  profileComplete: { type: Boolean, default: false },
  phone: { type: String, default: null, trim: true },
  headline: { type: String, default: null, trim: true },
  location: { type: String, default: null, trim: true },

  // ── Candidate-specific fields ───────────────────────────────────
  resumeUrl: { type: String, default: null },
  resumeText: { type: String, default: null },
  resumeParsed: { type: mongoose.Schema.Types.Mixed, default: null },
  resumeKey: { type: String, default: null },          // MinIO object key
  resumeUploadedAt: { type: Date, default: null },
  resumeFilename: { type: String, default: null },     // original filename
  skills: { type: [String], default: [] },
  experience: { type: Number, default: null },

  // ── Recruiter-specific fields ───────────────────────────────────
  company: { type: String, default: null, trim: true },
  designation: { type: String, default: null, trim: true },
  companyWebsite: { type: String, default: null, trim: true },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
