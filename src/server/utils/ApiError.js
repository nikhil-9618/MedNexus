/**
 * Operational error with an HTTP status and a client-safe message.
 *
 * `code` is an optional stable, machine-readable identifier (e.g.
 * 'EMAIL_NOT_VERIFIED') that lets the client branch on an error without
 * string-matching a human-facing message.
 */
class ApiError extends Error {
  constructor(statusCode, message, details = undefined, code = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
    this.isOperational = true;
  }

  static badRequest(msg = 'Bad request', details) {
    return new ApiError(400, msg, details);
  }
  static unauthorized(msg = 'Authentication required') {
    return new ApiError(401, msg);
  }
  static forbidden(msg = 'Access denied', code) { return new ApiError(403, msg, undefined, code); }
  static notFound(msg = 'Resource not found') {
    return new ApiError(404, msg);
  }
  static conflict(msg = 'Conflict') { return new ApiError(409, msg); }
  static tooMany(msg = 'Too many requests. Please try again later.') {
    return new ApiError(429, msg);
  }
}

module.exports = { ApiError };
