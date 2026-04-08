const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');

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

/**
 * requireRole — restricts access to users with specific role(s).
 * Must be placed after requireAuth.
 * @param  {...string} roles — allowed roles, e.g. 'recruiter', 'candidate'
 */
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required', data: null });
      }

      const user = await User.findById(userId).select('role').lean();
      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found', data: null });
      }

      if (!user.role || !roles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: requires role [${roles.join(' | ')}]`,
          data: null,
        });
      }

      // Attach role to req.user for downstream use
      req.user.role = user.role;
      next();
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Authorization check failed', data: null });
    }
  };
}

/**
 * requireProfileComplete — ensures user has completed the onboarding profile.
 * Must be placed after requireAuth.
 */
async function requireProfileComplete(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required', data: null });
    }

    const user = await User.findById(userId).select('profileComplete role').lean();
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found', data: null });
    }

    if (!user.role) {
      return res.status(403).json({
        success: false,
        message: 'Role selection required. Complete onboarding first.',
        data: { requiresOnboarding: true, step: 'role' },
      });
    }

    if (!user.profileComplete) {
      return res.status(403).json({
        success: false,
        message: 'Profile setup required. Complete onboarding first.',
        data: { requiresOnboarding: true, step: 'profile' },
      });
    }

    req.user.role = user.role;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Profile check failed', data: null });
  }
}

module.exports = { requireAuth, optionalAuth, requireRole, requireProfileComplete };
