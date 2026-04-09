const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const SkillVector = require('../models/SkillVector');
const { sendPasswordReset } = require('../services/emailService');
const logger = require('../utils/logger');

/**
 * Build a consistent user payload for auth responses.
 * Every auth endpoint (register, login, refresh) should return the same shape.
 */
function buildUserPayload(user) {
  const linkedProviders = [];
  if (user.googleId) linkedProviders.push('google');
  if (user.githubId) linkedProviders.push('github');

  return {
    id: user._id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    hasPassword: !!user.passwordHash,
    linkedProviders,
    role: user.role || null,
    profileComplete: user.profileComplete || false,
    phone: user.phone || null,
    headline: user.headline || null,
    location: user.location || null,
    company: user.company || null,
    designation: user.designation || null,
    companyWebsite: user.companyWebsite || null,
    skills: user.skills || [],
    experience: user.experience || null,
    resumeKey: user.resumeKey || null,
    resumeFilename: user.resumeFilename || null,
    resumeUploadedAt: user.resumeUploadedAt || null,
  };
}

const BCRYPT_ROUNDS = 12;

// ── Token helpers ───────────────────────────────────────────────────

function generateAccessToken(user) {
  return jwt.sign(
    { sub: user._id || user.id, email: user.email, name: user.name },
    config.jwtAccessSecret,
    { expiresIn: config.jwtAccessExpiry }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user._id || user.id, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiry }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function persistRefreshToken(userId, token) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ userId, tokenHash, expiresAt });
}

async function revokeRefreshToken(tokenHash) {
  await RefreshToken.updateOne({ tokenHash }, { revoked: true });
}

// ── Cookie helpers ──────────────────────────────────────────────────

function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = config.nodeEnv === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 190 * 60 * 1000, // 190 minutes — matches JWT expiry
    path: '/',
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/auth',
  });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/auth' });
}

async function issueSessionTokens(res, user) {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await persistRefreshToken(user._id || user.id, refreshToken);
  setAuthCookies(res, accessToken, refreshToken);
  return { accessToken, refreshToken };
}

// ── Skill vector helper ─────────────────────────────────────────────

async function initSkillVectors(userId) {
  const skills = ['communication', 'technical_depth', 'leadership', 'problem_structuring', 'result_orientation', 'culture_fit'];
  for (const skill of skills) {
    await SkillVector.findOneAndUpdate(
      { userId, skill },
      { $setOnInsert: { score: 5.0, attemptCount: 0 } },
      { upsert: true }
    );
  }
}

// ── Controllers ─────────────────────────────────────────────────────

async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, password, and name are required', data: null });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters', data: null });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered', data: null });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ email: email.toLowerCase(), passwordHash, name });
    await initSkillVectors(user._id);
    await issueSessionTokens(res, user);

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: buildUserPayload(user),
    });
  } catch (err) {
    logger.error('Registration error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Registration failed', data: null });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required', data: null });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
    }

    if (!user.passwordHash) {
      // Detect which OAuth provider is linked and hint the user
      const providers = [];
      if (user.googleId) providers.push('Google');
      if (user.githubId) providers.push('GitHub');
      const hint = providers.length ? `This account uses ${providers.join(' / ')} login` : 'This account has no password set';
      return res.status(401).json({ success: false, message: hint, data: null });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
    }

    await issueSessionTokens(res, user);

    return res.json({
      success: true,
      message: 'Login successful',
      data: buildUserPayload(user),
    });
  } catch (err) {
    logger.error('Login error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Login failed', data: null });
  }
}

async function refresh(req, res) {
  try {
    const oldRefreshToken = req.cookies?.refreshToken;
    if (!oldRefreshToken) {
      return res.status(401).json({ success: false, message: 'No refresh token', data: null });
    }

    let decoded;
    try {
      decoded = jwt.verify(oldRefreshToken, config.jwtRefreshSecret);
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Invalid refresh token', data: null });
    }

    const oldHash = hashToken(oldRefreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash: oldHash, userId: decoded.sub });

    if (!tokenDoc || tokenDoc.revoked) {
      await RefreshToken.updateMany({ userId: decoded.sub }, { revoked: true });
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Token reuse detected', data: null });
    }

    await revokeRefreshToken(oldHash);

    const user = await User.findById(decoded.sub);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'User not found', data: null });
    }

    await issueSessionTokens(res, user);

    return res.json({
      success: true,
      message: 'Token refreshed',
      data: buildUserPayload(user),
    });
  } catch (err) {
    logger.error('Token refresh error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Token refresh failed', data: null });
  }
}

async function logout(req, res) {
  try {
    const refreshTokenValue = req.cookies?.refreshToken;
    if (refreshTokenValue) {
      await revokeRefreshToken(hashToken(refreshTokenValue));
    }
    clearAuthCookies(res);
    return res.json({ success: true, message: 'Logged out', data: null });
  } catch (err) {
    logger.error('Logout error', { err: err.message });
    clearAuthCookies(res);
    return res.json({ success: true, message: 'Logged out', data: null });
  }
}

async function me(req, res) {
  try {
    // Fetch full user record to return provider info and password status
    const user = await User.findById(req.user?.id || req.user?._id)
      .select('email name avatarUrl googleId githubId passwordHash role profileComplete phone headline location company designation companyWebsite skills experience resumeKey resumeFilename resumeUploadedAt');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    return res.json({
      success: true,
      message: 'User retrieved',
      data: buildUserPayload(user),
    });
  } catch (err) {
    logger.error('me() error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Failed to retrieve user', data: null });
  }
}

/**
 * Forgot password — generate token, store hash, send email
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required', data: null });
    }

    // Always return 200 to avoid user enumeration
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.', data: null });
    }

    // Generate a cryptographically secure token (works for both password and OAuth-only accounts
    // OAuth-only users can use this flow to SET a password for the first time)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    user.passwordResetToken = tokenHash;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const sent = await sendPasswordReset(user.email, rawToken);
    if (!sent) {
      logger.warn('Password reset email not sent (SMTP not configured) — token generated but email skipped');
    }

    return res.json({ success: true, message: 'If that email is registered, a reset link has been sent.', data: null });
  } catch (err) {
    logger.error('Forgot password error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Request failed', data: null });
  }
}

/**
 * Reset password — validate token, set new password
 */
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required', data: null });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters', data: null });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired', data: null });
    }

    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    // Revoke all existing sessions for security
    await RefreshToken.updateMany({ userId: user._id }, { revoked: true });
    clearAuthCookies(res);

    logger.info('Password reset successful', { userId: user._id });
    return res.json({ success: true, message: 'Password has been reset. Please sign in.', data: null });
  } catch (err) {
    logger.error('Reset password error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Reset failed', data: null });
  }
}

/**
 * Change password (authenticated) — old password + new password
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required', data: null });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters', data: null });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    if (!user.passwordHash) {
      return res.status(400).json({ success: false, message: 'Your account uses OAuth login — set a password via "Forgot Password" first', data: null });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect', data: null });
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await user.save();

    logger.info('Password changed', { userId });
    return res.json({ success: true, message: 'Password changed successfully', data: null });
  } catch (err) {
    logger.error('Change password error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Password change failed', data: null });
  }
}

/**
 * Handle Google OAuth callback
 */
async function googleCallback(req, res) {
  try {
    const user = req.user;
    await issueSessionTokens(res, user);
    return res.redirect(config.corsOrigin + '/');
  } catch (err) {
    logger.error('Google OAuth callback error', { err: err.message });
    return res.redirect(config.corsOrigin + '/login?error=oauth_failed');
  }
}

/**
 * Handle GitHub OAuth callback
 */
async function githubCallback(req, res) {
  try {
    const user = req.user;
    await issueSessionTokens(res, user);
    return res.redirect(config.corsOrigin + '/');
  } catch (err) {
    logger.error('GitHub OAuth callback error', { err: err.message });
    return res.redirect(config.corsOrigin + '/login?error=oauth_failed');
  }
}

module.exports = { register, login, refresh, logout, me, forgotPassword, resetPassword, changePassword, googleCallback, githubCallback };
