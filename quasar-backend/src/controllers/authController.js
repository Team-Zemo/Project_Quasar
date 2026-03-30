const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const BCRYPT_ROUNDS = 12;

/**
 * Generate access token (15min)
 */
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    config.jwtAccessSecret,
    { expiresIn: config.jwtAccessExpiry }
  );
}

/**
 * Generate refresh token (7 days)
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, type: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: config.jwtRefreshExpiry }
  );
}

/**
 * Hash a refresh token for DB storage
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Save hashed refresh token to DB
 */
async function persistRefreshToken(userId, token) {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, tokenHash, expiresAt]
  );
}

/**
 * Revoke a refresh token
 */
async function revokeRefreshToken(tokenHash) {
  await pool.query(
    'UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1',
    [tokenHash]
  );
}

/**
 * Set auth cookies on response
 */
function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = config.nodeEnv === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000, // 15 min
    path: '/',
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/auth',
  });
}

/**
 * Clear auth cookies
 */
function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/auth' });
}

/**
 * Register a new user
 */
async function register(req, res) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, password, and name are required', data: null });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters', data: null });
    }

    // Check existing user
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered', data: null });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
      [email.toLowerCase(), passwordHash, name]
    );

    const user = result.rows[0];

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await persistRefreshToken(user.id, refreshToken);

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Initialize skill vectors
    const skills = ['communication', 'technical_depth', 'leadership', 'problem_structuring', 'result_orientation', 'culture_fit'];
    for (const skill of skills) {
      await pool.query(
        'INSERT INTO skill_vectors (user_id, skill, score) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [user.id, skill, 5.0]
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    logger.error('Registration error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Registration failed', data: null });
  }
}

/**
 * Login with email + password
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required', data: null });
    }

    const result = await pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ success: false, message: 'This account uses Google login', data: null });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials', data: null });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await persistRefreshToken(user.id, refreshToken);

    setAuthCookies(res, accessToken, refreshToken);

    return res.json({
      success: true,
      message: 'Login successful',
      data: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    logger.error('Login error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Login failed', data: null });
  }
}

/**
 * Refresh tokens — rotation: invalidate old, issue new
 */
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

    // Check if token exists and is not revoked
    const tokenResult = await pool.query(
      'SELECT id, revoked FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2',
      [oldHash, decoded.sub]
    );

    if (tokenResult.rows.length === 0 || tokenResult.rows[0].revoked) {
      // Possible token reuse — revoke all tokens for this user
      await pool.query('UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1', [decoded.sub]);
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Token reuse detected', data: null });
    }

    // Revoke old token
    await revokeRefreshToken(oldHash);

    // Fetch user
    const userResult = await pool.query('SELECT id, email, name FROM users WHERE id = $1', [decoded.sub]);
    if (userResult.rows.length === 0) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'User not found', data: null });
    }

    const user = userResult.rows[0];

    // Issue new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    await persistRefreshToken(user.id, newRefreshToken);

    setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.json({
      success: true,
      message: 'Token refreshed',
      data: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    logger.error('Token refresh error', { err: err.message });
    return res.status(500).json({ success: false, message: 'Token refresh failed', data: null });
  }
}

/**
 * Logout — revoke current refresh token, clear cookies
 */
async function logout(req, res) {
  try {
    const refreshTokenValue = req.cookies?.refreshToken;
    if (refreshTokenValue) {
      const tokenHash = hashToken(refreshTokenValue);
      await revokeRefreshToken(tokenHash);
    }
    clearAuthCookies(res);
    return res.json({ success: true, message: 'Logged out', data: null });
  } catch (err) {
    logger.error('Logout error', { err: err.message });
    clearAuthCookies(res);
    return res.json({ success: true, message: 'Logged out', data: null });
  }
}

/**
 * Get current authenticated user
 */
async function me(req, res) {
  return res.json({
    success: true,
    message: 'User retrieved',
    data: req.user
  });
}

/**
 * Handle Google OAuth callback
 */
async function googleCallback(req, res) {
  try {
    const user = req.user; // Set by passport
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await persistRefreshToken(user.id, refreshToken);

    setAuthCookies(res, accessToken, refreshToken);

    // Redirect to frontend
    return res.redirect(config.corsOrigin + '/');
  } catch (err) {
    logger.error('Google OAuth callback error', { err: err.message });
    return res.redirect(config.corsOrigin + '/login?error=oauth_failed');
  }
}

module.exports = { register, login, refresh, logout, me, googleCallback };
