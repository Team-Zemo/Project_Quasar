const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const config = require('./env');
const { pool } = require('./database');
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
      let result = await pool.query('SELECT id, email, name FROM users WHERE google_id = $1', [googleId]);

      if (result.rows.length > 0) {
        return done(null, result.rows[0]);
      }

      // Check by email — link accounts
      result = await pool.query('SELECT id, email, name FROM users WHERE email = $1', [email.toLowerCase()]);

      if (result.rows.length > 0) {
        // Link Google ID to existing account
        await pool.query('UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3', [googleId, avatarUrl, result.rows[0].id]);
        return done(null, result.rows[0]);
      }

      // Create new user
      result = await pool.query(
        'INSERT INTO users (email, name, google_id, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
        [email.toLowerCase(), name, googleId, avatarUrl]
      );

      const user = result.rows[0];

      // Initialize skill vectors
      const skills = ['communication', 'technical_depth', 'leadership', 'problem_structuring', 'result_orientation', 'culture_fit'];
      for (const skill of skills) {
        await pool.query(
          'INSERT INTO skill_vectors (user_id, skill, score) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [user.id, skill, 5.0]
        );
      }

      return done(null, user);
    } catch (err) {
      logger.error('Google OAuth strategy error', { err: err.message });
      return done(err, null);
    }
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [id]);
      done(null, result.rows[0] || null);
    } catch (err) {
      done(err, null);
    }
  });
}

module.exports = { configurePassport };
