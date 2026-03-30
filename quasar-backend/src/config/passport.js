const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('./env');
const User = require('../models/User');
const SkillVector = require('../models/SkillVector');
const logger = require('../utils/logger');

function configurePassport() {
  if (!config.googleClientId || !config.googleClientSecret) {
    logger.warn('Google OAuth credentials not configured — skipping Google strategy');
    return;
  }

  passport.use(new GoogleStrategy({
    clientID: config.googleClientId,
    clientSecret: config.googleClientSecret,
    callbackURL: `${config.appUrl}/auth/google/callback`,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value || '';
      const name = profile.displayName || 'Google User';
      const avatarUrl = profile.photos?.[0]?.value || '';

      // Check if user exists by Google ID
      let user = await User.findOne({ googleId });

      if (user) {
        return done(null, { id: user._id, email: user.email, name: user.name });
      }

      // Check by email — link accounts
      user = await User.findOne({ email: email.toLowerCase() });

      if (user) {
        // Link Google ID to existing account
        user.googleId = googleId;
        user.avatarUrl = avatarUrl;
        await user.save();
        return done(null, { id: user._id, email: user.email, name: user.name });
      }

      // Create new user
      user = await User.create({
        email: email.toLowerCase(),
        name,
        googleId,
        avatarUrl,
      });

      // Initialize skill vectors
      const skills = ['communication', 'technical_depth', 'leadership', 'problem_structuring', 'result_orientation', 'culture_fit'];
      for (const skill of skills) {
        await SkillVector.findOneAndUpdate(
          { userId: user._id, skill },
          { $setOnInsert: { score: 5.0, attemptCount: 0 } },
          { upsert: true }
        );
      }

      return done(null, { id: user._id, email: user.email, name: user.name });
    } catch (err) {
      logger.error('Google OAuth strategy error', { err: err.message });
      return done(err, null);
    }
  }));

  passport.serializeUser((user, done) => done(null, user.id || user._id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id).select('email name');
      done(null, user ? { id: user._id, email: user.email, name: user.name } : null);
    } catch (err) {
      done(err, null);
    }
  });
}

module.exports = { configurePassport };
