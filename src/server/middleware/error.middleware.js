/**
 * Centralized error handling. Returns safe JSON — never stack traces,
 * Mongo internals, or secret material.
 */
const { ApiError } = require('../utils/ApiError');
const { config } = require('../config/env');
const { formatIssues } = require('./validation.middleware');

function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let statusCode = err instanceof ApiError ? err.statusCode : 500;
  let message = err instanceof ApiError ? err.message : 'Internal server error';
  let details;

  if (!(err instanceof ApiError)) {
    // Known operational error families mapped to safe responses.
    if (err && err.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation failed';
      details = Object.values(err.errors || {}).map((e) => ({ field: e.path, message: e.message }));
    } else if (err && err.name === 'CastError') {
      statusCode = 400;
      message = 'Invalid identifier format';
    } else if (err && err.code === 11000) {
      statusCode = 409;
      message = 'Duplicate resource';
      const fields = Object.keys(err.keyValue || {});
      if (fields.length) message = `Duplicate value for: ${fields.join(', ')}`;
    } else if (err && err.type === 'entity.too.large') {
      statusCode = 413;
      message = 'Request body too large';
    } else if (statusCode === 500) {
      console.error('[error]', err && err.stack ? err.stack : err);
    }
  }

  const payload = { success: false, message };
  if (details) payload.details = details;
  else if (err instanceof ApiError && err.details) payload.details = err.details;
  if (config.isDev && statusCode >= 500) payload.debug = String(err && err.message);

  res.status(statusCode).json(payload);
}

module.exports = { notFoundHandler, errorHandler };
