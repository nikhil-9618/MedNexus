/**
 * ID / pagination / sanitization utilities.
 * Sanitization relies on express-mongo-sanitize globally; these helpers
 * add explicit checks where handlers need them.
 */
const { PAGINATION } = require('../config/constants');
const { ApiError } = require('./ApiError');

/** True when value is a 24-char hex string (MongoDB ObjectId form). */
function isValidObjectId(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

/** 404 when the condition is falsy. */
function assertFound(condition, message = 'Resource not found') {
  if (!condition) throw ApiError.notFound(message);
}

/** Parse ?page & ?limit with clamping. */
function getPagination(query, defaults = {}) {
  const def = { ...PAGINATION, ...defaults };
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = def.defaultPage;
  if (!Number.isFinite(limit) || limit < 1) limit = def.defaultLimit;
  limit = Math.min(limit, def.maxLimit);
  return { page, limit, skip: (page - 1) * limit };
}

/** Parse a boolean-ish query flag. */
function parseBool(value, fallback = undefined) {
  if (value === undefined || value === '') return fallback;
  if (['true', '1', 'yes'].includes(String(value).toLowerCase())) return true;
  if (['false', '0', 'no'].includes(String(value).toLowerCase())) return false;
  return fallback;
}

/** Escape user text used inside RegExp search filters. */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  isValidObjectId,
  assertFound,
  getPagination,
  parseBool,
  escapeRegex,
};
