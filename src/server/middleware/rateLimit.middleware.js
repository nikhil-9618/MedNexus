/**
 * Rate limiting configuration.
 * - globalLimiter: broad throttle across the API.
 * - authLimiter:   strict throttle on /api/auth (brute-force protection).
 * - apiLimiter:    moderate throttle for the rest of the API.
 */
const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');

const json = (message) => (_req, res) => {
  res.status(429).json({ success: false, message });
};

const globalLimiter = rateLimit({
  windowMs: config.rateLimits.globalWindowMs,
  max: config.rateLimits.globalMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Too many requests, please slow down'),
});

const authLimiter = rateLimit({
  windowMs: config.rateLimits.authWindowMs,
  max: config.rateLimits.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // count only failures
  handler: json('Too many login attempts. Please try again later.'),
});

const apiLimiter = rateLimit({
  windowMs: config.rateLimits.apiWindowMs,
  max: config.rateLimits.apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json('Rate limit exceeded'),
});

module.exports = { globalLimiter, authLimiter, apiLimiter };
