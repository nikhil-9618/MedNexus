/**
 * Authentication middleware — verifies the JWT in the Authorization header
 * and loads the user. Runs BEFORE any role/resource check.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ApiError } = require('../utils/ApiError');
const { config } = require('../config/env');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

module.exports = async function authMiddleware(req, _res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Authentication required');

    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      });
    } catch (err) {
      // Expired or invalid token — same 401, message stays generic.
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const user = await User.findById(payload.sub);
    if (!user) throw ApiError.unauthorized('Invalid or expired token');

    // Revoked session? The signature and expiry can both still be valid, so the
    // generation stored on the account is the authority. The user document is
    // already loaded here, which makes this check free.
    if ((payload.tv || 0) !== (user.tokenVersion || 0)) {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    if (user.status !== 'ACTIVE') {
      throw ApiError.forbidden('Account is inactive. Contact an administrator.');
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
      status: user.status,
    };
    next();
  } catch (err) {
    next(err);
  }
};
