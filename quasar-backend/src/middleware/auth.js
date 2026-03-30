const jwt = require('jsonwebtoken');
const config = require('../config/env');

/**
 * requireAuth — blocks unauthenticated requests.
 * Reads access token from httpOnly cookie, verifies, attaches req.user.
 */
function requireAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required', data: null });
  }

  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret);
    req.user = { id: decoded.sub, email: decoded.email, name: decoded.name };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired', data: null });
    }
    return res.status(401).json({ success: false, message: 'Invalid token', data: null });
  }
}

/**
 * optionalAuth — attaches user if present, but does not block unauthenticated.
 */
function optionalAuth(req, res, next) {
  const token = req.cookies?.accessToken;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtAccessSecret);
    req.user = { id: decoded.sub, email: decoded.email, name: decoded.name };
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
