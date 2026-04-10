const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const config = require('./env');
const User = require('../models/User');
const SkillVector = require('../models/SkillVector');
const { sendWelcome } = require('../services/emailService');
const logger = require('../utils/logger');

const SKILLS = ['communication', 'technical_depth', 'leadership', 'problem_structuring', 'result_orientation', 'culture_fit'];

async function initSkillVectors(userId) {
  for (const skill of SKILLS) {
    await SkillVector.findOneAndUpdate(
      { userId, skill },
      { $setOnInsert: { score: 5.0, attemptCount: 0 } },
      { upsert: true }
    );
  }
}

/**
 * Unified OAuth handler — find or create user, merging accounts by email.
 * @param {object} opts - { providerId, providerField, email, name, avatarUrl }
 */
async function findOrCreateOAuthUser({ providerId, providerField, email, name, avatarUrl }) {
  // 1. Find by this provider's ID
  let user = await User.findOne({ [providerField]: providerId });
  if (user) {
    return { id: user._id, email: user.email, name: user.name };
  }

  // 2. Find by email — merge/link all provider IDs
  user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    const wasNew = !user[providerField];
    user[providerField] = providerId;
    if (!user.avatarUrl && avatarUrl) user.avatarUrl = avatarUrl;
    await user.save();
    if (wasNew) {
      logger.info('Linked OAuth provider to existing account', { email, providerField });
    }
    return { id: user._id, email: user.email, name: user.name };
  }

  // 3. Create brand-new user
  user = await User.create({
    email: email.toLowerCase(),
    name,
    [providerField]: providerId,
    avatarUrl,
  });
  await initSkillVectors(user._id);

  // Send async welcome email
  const providerName = providerField === 'googleId' ? 'google' : 'github';
  sendWelcome(user.email, user.name, null, providerName)
    .catch(err => logger.warn('Welcome email failed (OAuth)', { err: err.message }));

  return { id: user._id, email: user.email, name: user.name };
}

function configurePassport() {
  // ── Google ──────────────────────────────────────────────────────
  if (config.googleClientId && config.googleClientSecret) {
    passport.use(new GoogleStrategy({
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: `${config.appUrl}/auth/google/callback`,
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await findOrCreateOAuthUser({
          providerId: profile.id,
          providerField: 'googleId',
          email: profile.emails?.[0]?.value || '',
          name: profile.displayName || 'Google User',
          avatarUrl: profile.photos?.[0]?.value || '',
        });
        return done(null, user);
      } catch (err) {
        logger.error('Google OAuth strategy error', { err: err.message });
        return done(err, null);
      }
    }));
  } else {
    logger.warn('Google OAuth credentials not configured — skipping Google strategy');
  }

  // ── GitHub ──────────────────────────────────────────────────────
  if (config.githubClientId && config.githubClientSecret) {
    passport.use(new GitHubStrategy({
      clientID: config.githubClientId,
      clientSecret: config.githubClientSecret,
      callbackURL: `${config.appUrl}/auth/github/callback`,
      scope: ['user:email'],
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          (profile.emails?.find(e => e.primary)?.value) ||
          profile.emails?.[0]?.value ||
          '';
        if (!email) {
          return done(new Error('GitHub account must have a public or verified email'), null);
        }
        const user = await findOrCreateOAuthUser({
          providerId: profile.id,
          providerField: 'githubId',
          email,
          name: profile.displayName || profile.username || 'GitHub User',
          avatarUrl: profile.photos?.[0]?.value || '',
        });
        return done(null, user);
      } catch (err) {
        logger.error('GitHub OAuth strategy error', { err: err.message });
        return done(err, null);
      }
    }));
  } else {
    logger.warn('GitHub OAuth credentials not configured — skipping GitHub strategy');
  }

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
