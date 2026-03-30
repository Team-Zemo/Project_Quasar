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
  googleId: { type: String, unique: true, sparse: true, default: null },
  avatarUrl: { type: String, default: null },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
