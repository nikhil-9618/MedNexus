/**
 * Centralized environment configuration.
 * Every module reads settings from here — no process.env scatter.
 * Secrets live only in .env (never committed). See .env.example.
 */
require('dotenv').config();

// Under the node:test runner, never let a developer .env influence config.
// NOTE: dotenv.config() does NOT override already-set vars, so a test harness
// that sets process.env.JWT_SECRET BEFORE requiring this module is respected.
// We only zero values that were NOT explicitly provided by the harness.
if (process.env.NODE_ENV === 'test') {
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-only-secret-change-me';
  if (!process.env.MONGODB_URI) process.env.MONGODB_URI = '';
  if (!process.env.PORT) process.env.PORT = '0';
}

const path = require('path');

const int = (value, fallback, { min = -Infinity, max = Infinity } = {}) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < min || n > max) return fallback;
  return n;
};

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const parseList = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const config = {
  nodeEnv,
  isProd,
  isTest,
  isDev: !isProd && !isTest,
  port: int(process.env.PORT, 5000, { min: 1, max: 65535 }),

  mongo: {
    // Empty => the DB layer auto-starts a local in-memory MongoDB (dev convenience).
    uri: process.env.MONGODB_URI || '',
    dbName: process.env.MONGODB_DB || 'mednexus',
  },

  jwt: {
    secret: process.env.JWT_SECRET || (isTest ? 'test-only-secret-change-me' : ''),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'mednexus-api',
    audience: process.env.JWT_AUDIENCE || 'mednexus-client',
    // Cookie never used for auth (Authorization header only) — kept for clarity.
    algorithm: 'HS256',
  },

  clientUrls: parseList(process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173'),

  trustProxy: int(process.env.TRUST_PROXY, 0),

  // Redirect any plain-HTTP request to HTTPS. Defaults to on in production;
  // health-check probes and localhost are always exempt (see app.js).
  forceHttps: bool(process.env.FORCE_HTTPS, isProd),

  rateLimits: {
    globalWindowMs: int(process.env.RL_GLOBAL_WINDOW_MS, 15 * 60 * 1000),
    globalMax: int(process.env.RL_GLOBAL_MAX, 900),
    authWindowMs: int(process.env.RL_AUTH_WINDOW_MS, 15 * 60 * 1000),
    authMax: int(process.env.RL_AUTH_MAX, 25),
    apiWindowMs: int(process.env.RL_API_WINDOW_MS, 60 * 1000),
    apiMax: int(process.env.RL_API_MAX, 180),
  },

  bcrypt: {
    rounds: int(process.env.BCRYPT_ROUNDS, 10),
  },

  // The first administrator's address. Used by `npm run create-admin` when
  // --email is not passed, so a hosted deploy can bootstrap without a shell.
  adminEmail: process.env.ADMIN_EMAIL || '',

  ai: {
    apiKey: process.env.AI_API_KEY || '',
  },

  bodyLimit: process.env.BODY_LIMIT || '32kb',

  logRequests: bool(process.env.LOG_REQUESTS, !isTest),

  // ---- Outbound email (verification codes, security notices) --------------
  // Two transports, in order of preference:
  //  - Resend's HTTP API, called with the runtime's global fetch (no dependency).
  //  - SMTP, which works with any provider or a personal mailbox (e.g. a Gmail
  //    app password). SMTP is the only way to reach arbitrary recipients when
  //    no sending domain can be verified.
  // With neither configured the OTP service falls back to its console transport.
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    // Empty means "derive from the chosen transport" — see email.service.js.
    from: process.env.EMAIL_FROM || '',
    replyTo: process.env.EMAIL_REPLY_TO || '',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: int(process.env.SMTP_PORT, 587, { min: 1, max: 65535 }),
      // Implicit TLS on 465, STARTTLS on 587/25. Defaulted from the port.
      secure: bool(process.env.SMTP_SECURE, int(process.env.SMTP_PORT, 587) === 465),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },

  // ---- Demo-deployment switches (both default OFF) ------------------------
  // Seeding is a development convenience by default; a hosted demo has no
  // developer shell to run `npm run seed` in, so it can opt in explicitly.
  seedOnEmpty: bool(process.env.SEED_ON_EMPTY, false),

  // With no email provider configured, an OTP can never be delivered. This
  // switch lets a hosted DEMO echo the code to the client so the registration
  // flow stays completable. It must stay off for any real patient data.
  otpEcho: bool(process.env.OTP_DEV_ECHO, false),
};

// A real send needs a provider URL or a credentialed SMTP host.
config.email.smtp.enabled = Boolean(
  config.email.smtp.host && config.email.smtp.user && config.email.smtp.pass
);
config.email.enabled = Boolean(config.email.resendApiKey) || config.email.smtp.enabled;
// Which transport a send would actually use.
config.email.transport = config.email.enabled
  ? (config.email.resendApiKey ? 'resend' : 'smtp')
  : 'none';

/** Fail fast in production when a required secret is missing. */
function validateProductionConfig() {
  const problems = [];
  if (config.isProd) {
    if (!config.mongo.uri) problems.push('MONGODB_URI is required in production');
    if (!config.jwt.secret) problems.push('JWT_SECRET is required in production');
    else if (config.jwt.secret.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
    if (config.jwt.secret === 'replace-me-with-a-long-random-string-min-32-chars') {
      problems.push('JWT_SECRET still equals the .env.example placeholder');
    }
    if (config.clientUrls.length === 0) problems.push('CLIENT_URL is required in production');
    if (config.otpEcho) {
      console.warn(
        '[security] OTP_DEV_ECHO is ON — verification codes are returned to the client ' +
          'because no email provider is configured. Demo/synthetic data only.'
      );
    }
    if (!config.email.enabled && !config.otpEcho) {
      // Not fatal: the server still boots, but no patient can ever finish
      // signup. Surface it loudly rather than failing silently in someone's inbox.
      console.warn(
        '[security] No email transport configured (RESEND_API_KEY and SMTP_* are ' +
          'empty) and OTP_DEV_ECHO is off — verification codes cannot reach users.'
      );
    }
    if (config.email.resendApiKey && config.email.from === '') {
      // Resend's shared sandbox sender is usable but only delivers to the
      // account owner's own address, which looks exactly like "verification is
      // broken" to everyone else. Warn rather than refuse to boot.
      console.warn(
        '[security] RESEND_API_KEY is set without EMAIL_FROM, so codes are sent from ' +
          "Resend's sandbox sender (onboarding@resend.dev), which only delivers to the " +
          'Resend account owner. Set EMAIL_FROM to an address on a verified domain.'
      );
    }
  } else if (!config.jwt.secret) {
    // Development fallback so the app boots with zero setup. Never used in prod.
    config.jwt.secret = 'mednexus-dev-only-secret-do-not-use-in-production-0123456789';
  }
  return problems;
}

module.exports = { config, validateProductionConfig, path };
