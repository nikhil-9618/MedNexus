/**
 * Role middleware — usage: requireRoles('DOCTOR', 'ADMIN').
 * Must run after auth.middleware (req.user must exist).
 */
const { ApiError } = require('../utils/ApiError');

module.exports = function requireRoles(...roles) {
  if (!roles.length) throw new Error('requireRoles() needs at least one role');
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Access denied for your role'));
    }
    return next();
  };
};
