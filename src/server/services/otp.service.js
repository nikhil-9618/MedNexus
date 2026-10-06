/**
 * Email OTP service — one-time codes for patient email verification.
 *
 * Design notes:
 *  - Codes are 6 digits from a CSPRNG (crypto.randomInt), never Math.random.
 *  - Only a bcrypt HASH of the code is stored; the plaintext never persists.
 *  - Codes expire after OTP_TTL_MS and are capped at MAX_ATTEMPTS attempts.
 *  - Delivery is pluggable. With no email provider configured the code is
 *    logged server-side (dev transport) and returned to the client ONLY when
 *    config.isDev is true, so the flow is testable without an SMTP account.
 *    In production `devCode` is never populated and nothing is returned.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { ApiError } = require('../utils/ApiError');
const { config } = require('../config/env');
const { auditAsync } = require('./audit.service');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000; // 30 seconds

/** Generate a cryptographically secure 6-digit code. */
function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Deliver a code to the user.
 *
 * The dev transport writes to the server log and returns the code so the
 * registration flow can be exercised end to end without an email provider.
 * Swap this for a real provider (Resend/SendGrid/SES) and return
 * { delivered: true, devCode: null } once credentials exist.
 */
async function deliver({ email, code, name }) {
  console.log(`[otp] verification code for ${email} (${name}): ${code} — expires in 10 minutes`);
  const expose = config.isDev || config.isTest;
  return { delivered: false, transport: 'dev-console', devCode: expose ? code : null };
}

/** Issue (or re-issue) a verification code for a user. */
async function issueOtp(user, { force = false } = {}) {
  if (!force && user.emailOtpLastSentAt) {
    const since = Date.now() - new Date(user.emailOtpLastSentAt).getTime();
    if (since < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - since) / 1000);
      throw ApiError.badRequest(`Please wait ${wait}s before requesting another code`);
    }
  }

  const code = generateCode();
  user.emailOtpHash = await bcrypt.hash(code, config.bcrypt.rounds);
  user.emailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.emailOtpAttempts = 0;
  user.emailOtpLastSentAt = new Date();
  await user.save();

  const delivery = await deliver({ email: user.email, code, name: user.name });

  auditAsync({
    action: 'OTP_ISSUED',
    role: user.role,
    userId: user._id.toString(),
    resourceType: 'AUTH',
    resourceId: user._id.toString(),
    result: 'SUCCESS',
    detail: `Verification code issued via ${delivery.transport}`,
  });

  return delivery;
}

/**
 * Verify a submitted code. On success the account is marked verified and all
 * OTP state is cleared. Throws with a safe, non-enumerating message otherwise.
 */
async function verifyOtp(user, submitted) {
  const generic = 'That verification code is not valid or has expired';

  // emailOtpHash is select:false, so it must be read explicitly BEFORE the
  // guard below — otherwise the guard always sees undefined.
  const fresh = await user.constructor.findById(user._id).select('+emailOtpHash');
  const hash = fresh ? fresh.emailOtpHash : null;

  if (!hash || !user.emailOtpExpiresAt) {
    throw ApiError.badRequest(generic);
  }
  if (user.emailOtpAttempts >= MAX_ATTEMPTS) {
    throw ApiError.tooMany('Too many incorrect attempts. Request a new code.');
  }
  if (new Date(user.emailOtpExpiresAt).getTime() < Date.now()) {
    throw ApiError.badRequest('That verification code has expired. Request a new one.');
  }

  const match = await bcrypt.compare(String(submitted), hash);
  if (!match) {
    user.emailOtpAttempts += 1;
    await user.save();
    throw ApiError.badRequest(generic);
  }

  user.emailVerified = true;
  user.emailOtpHash = null;
  user.emailOtpExpiresAt = null;
  user.emailOtpAttempts = 0;
  await user.save();

  auditAsync({
    action: 'EMAIL_VERIFIED',
    role: user.role,
    userId: user._id.toString(),
    resourceType: 'AUTH',
    resourceId: user._id.toString(),
    result: 'SUCCESS',
    detail: 'Email ownership confirmed via one-time code',
  });

  return true;
}

module.exports = { issueOtp, verifyOtp, OTP_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS };
