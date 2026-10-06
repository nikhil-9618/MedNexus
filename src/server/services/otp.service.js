/**
 * Email OTP service — one-time codes for patient email verification.
 *
 * Design notes:
 *  - Codes are 6 digits from a CSPRNG (crypto.randomInt), never Math.random.
 *  - Only a bcrypt HASH of the code is stored; the plaintext never persists.
 *  - Codes expire after OTP_TTL_MS and are capped at MAX_ATTEMPTS attempts.
 *  - Delivery is pluggable. With no email provider configured the code is
 *    logged server-side (dev transport) and returned to the client in
 *    development, in tests, and on a hosted DEMO that explicitly sets
 *    OTP_DEV_ECHO=true (no shell to run the flow manually, no SMTP account).
 *    Any deployment that leaves the switch off never returns a code.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { ApiError } = require('../utils/ApiError');
const { config } = require('../config/env');
const { auditAsync } = require('./audit.service');
const emailService = require('./email.service');

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
 * Two transports, in order:
 *  1. Real email via email.service (Resend) when RESEND_API_KEY is configured.
 *  2. The console/dev transport otherwise — it logs the code and returns it so
 *     the registration flow can still be exercised without a provider.
 *
 * `devCode` is only ever populated when the code is exposed on purpose
 * (development, tests, or an explicit OTP_DEV_ECHO demo switch), so a real
 * deployment never leaks a code to the client.
 */
async function deliver({ email, code, name }) {
  const expose = config.isDev || config.isTest || config.otpEcho;

  if (emailService.isConfigured()) {
    const sent = await emailService.sendOtpEmail({ to: email, name, code });
    if (sent.delivered) {
      console.log(`[otp] verification code emailed to ${email} via ${sent.transport} — expires in 10 minutes`);
      // Report the transport that actually carried the message. Hardcoding this
      // to 'resend' made the audit trail claim an SMTP delivery came from
      // Resend, which is exactly the detail needed when a code does not arrive.
      return { delivered: true, transport: sent.transport, devCode: expose ? code : null };
    }
    // Provider configured but the send failed: fall through to the console so
    // the flow stays recoverable (and the failure is already logged).
  }

  const transport = expose && config.isProd ? 'demo-console' : 'dev-console';
  console.log(`[otp] verification code for ${email} (${name}): ${code} — expires in 10 minutes`);
  return { delivered: false, transport, devCode: expose ? code : null };
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
