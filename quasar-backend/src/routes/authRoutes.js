const express = require('express');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Rate limiting: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later', data: null },
});

// Stricter limiter for password reset to prevent abuse
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many reset attempts, please try again later', data: null },
});

// ── Standard auth routes ────────────────────────────────────────────
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

// ── Password management ─────────────────────────────────────────────
router.post('/forgot-password', resetLimiter, authController.forgotPassword);
router.post('/reset-password', resetLimiter, authController.resetPassword);
router.post('/change-password', requireAuth, authController.changePassword);

// ── Google OAuth ────────────────────────────────────────────────────
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth_failed' }),
  authController.googleCallback
);

// ── GitHub OAuth ────────────────────────────────────────────────────
router.get('/github', passport.authenticate('github', { scope: ['user:email'], session: false }));
router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/login?error=oauth_failed' }),
  authController.githubCallback
);

module.exports = router;
