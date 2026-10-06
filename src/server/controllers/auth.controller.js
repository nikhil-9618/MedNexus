const { wrapAll } = require('../utils/asyncHandler');
/**
 * Auth controller — registration, login, logout, me.
 * Only safe user fields are ever returned; passwords are bcrypt-hashed.
 */
const crypto = require('crypto');
const User = require('../models/User');
const Patient = require('../models/Patient');
const { issueToken } = require('../services/token.service');
const { writeAudit, auditAsync } = require('../services/audit.service');
const { ApiError } = require('../utils/ApiError');
const { config } = require('../config/env');
const { nextPatientCode } = require('../utils/ids');
const otpService = require('../services/otp.service');
const loginGuard = require('../services/loginGuard.service');
const { HUMAN_FILL_MS } = require('../validators/auth.validator');

/**
 * Describe how a verification code left the building, truthfully.
 *
 * There are three genuinely different outcomes and the user needs to be able to
 * tell them apart, because the recovery step is different for each:
 *   - a provider accepted it        -> it is in the inbox
 *   - no provider, code echoed back -> it is on screen (development)
 *   - no provider, nothing echoed   -> nothing was delivered; an operator must
 *                                      configure RESEND_API_KEY or SMTP_*
 * The previous wording asserted an email had been sent in all three cases.
 */
function otpDeliveryMessage(delivery) {
  if (delivery.delivered) return 'We emailed you a 6-digit verification code.';
  if (delivery.devCode) {
    return 'Email delivery is not configured, so the 6-digit code is shown below instead of being sent.';
  }
  return 'This deployment cannot send email yet, so no code could be delivered. Ask the administrator to configure RESEND_API_KEY or SMTP_*.';
}

/** Shape the safe public user object returned by auth endpoints. */
function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

/** POST /api/auth/register — patient self-registration. */
async function register(req, res) {
  const { name, email, phone, dob, gender, password, website, formStartedAt } = req.body;

  // ---- Bot traps -------------------------------------------------------
  // Checked before any I/O so scripted signups cost nothing: hashing, writes
  // and outbound email only ever happen for plausible human traffic.
  //  - `website` is a hidden field no human can fill in.
  //  - `formStartedAt` catches instant submissions (missing value = old client,
  //    negative value = clock skew, both allowed so nobody is locked out).
  const startedAt = Number(formStartedAt) || 0;
  const fillMs = startedAt > 0 ? Date.now() - startedAt : Infinity;
  const trippedHoneypot = Boolean(String(website || '').trim());
  const filledTooFast = fillMs >= 0 && fillMs < HUMAN_FILL_MS;

  if (trippedHoneypot || filledTooFast) {
    // role/result values must exist in the AuditLog enums (SYSTEM, DENIED).
    auditAsync({
      action: 'REGISTER',
      role: 'SYSTEM',
      resourceType: 'AUTH',
      result: 'DENIED',
      ipAddress: req.ip,
      detail: trippedHoneypot ? 'Honeypot field was filled' : 'Form submitted faster than a human could type',
    });
    // Deliberately generic: automated clients learn nothing from this reply.
    throw ApiError.badRequest('We could not process this registration. Please try again.');
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await User.hashPassword(password, config.bcrypt.rounds);
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: 'PATIENT',
    status: 'ACTIVE',
    // Ownership of the email must be proven before the account can sign in.
    emailVerified: false,
  });

  await Patient.create({
    userId: user._id,
    patientId: await nextPatientCode(),
    dob,
    gender,
    phone,
  });

  const delivery = await otpService.issueOtp(user, { force: true });

  auditAsync({
    action: 'REGISTER',
    role: 'PATIENT',
    userId: user._id.toString(),
    resourceType: 'AUTH',
    resourceId: user._id.toString(),
    result: 'SUCCESS',
    ipAddress: req.ip,
    detail: 'Patient self-registration (email verification pending)',
  });

  // No token yet: the account must confirm the emailed code first.
  res.status(201).json({
    success: true,
    otpRequired: true,
    email: user.email,
    // This message must never claim an email was sent when none was. Saying
    // "we sent a code to your email" with no transport configured told the user
    // to go and check an inbox that could never receive anything, which is
    // indistinguishable from a broken signup.
    message: otpDeliveryMessage(delivery),
    // Whether a real provider accepted the message, and which one. When false
    // the client can say where the code actually went instead of "check your inbox".
    delivered: delivery.delivered,
    transport: delivery.transport,
    // Populated only by the development/test transport — never in production.
    devOtp: delivery.devCode || undefined,
  });
}

/** POST /api/auth/verify-otp — confirm the emailed code and issue a session. */
async function verifyEmailOtp(req, res) {
  const { email, otp } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() });

  // Same message whether the account is missing or the code is wrong.
  if (!user) throw ApiError.badRequest('That verification code is not valid or has expired');
  if (user.emailVerified) throw ApiError.conflict('This email address is already verified');

  await otpService.verifyOtp(user, otp);

  user.lastLoginAt = new Date();
  await user.save();

  res.json({
    success: true,
    message: 'Email verified',
    token: issueToken(user),
    user: safeUser(user),
  });
}

/** POST /api/auth/resend-otp — re-issue a code (never reveals account existence). */
async function resendEmailOtp(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() });

  if (!user || user.emailVerified) {
    return res.json({
      success: true,
      message: user
        ? 'That account is already verified. You can sign in.'
        : 'If that account exists, a new code has been sent.',
    });
  }

  const delivery = await otpService.issueOtp(user);
  return res.json({
    success: true,
    message: otpDeliveryMessage(delivery),
    delivered: delivery.delivered,
    transport: delivery.transport,
    devOtp: delivery.devCode || undefined,
  });
}

/** POST /api/auth/login */
async function login(req, res) {
  const { email, password, role } = req.body;
  const ip = req.ip;

  const generic = 'Invalid email or password';
  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');
  if (!user) {
    auditAsync({
      action: 'FAILED_LOGIN', role: role || 'SYSTEM', userId: null, resourceType: 'AUTH',
      result: 'FAILED', ipAddress: ip, detail: 'Unknown email',
    });
    throw ApiError.unauthorized(generic);
  }

  // Account lockout is checked before the password is compared, so a locked
  // account cannot be probed at all (IP limiting is the other half of this).
  loginGuard.assertNotLocked(user);

  const ok = await user.comparePassword(password);
  if (!ok) {
    await loginGuard.recordFailure(user);
    auditAsync({
      action: 'FAILED_LOGIN', role: user.role, userId: user._id.toString(), resourceType: 'AUTH',
      result: 'FAILED', ipAddress: ip, detail: 'Wrong password',
    });
    throw ApiError.unauthorized(generic);
  }

  // Role must match the selected account type (prevents patient token on doctor portal).
  if (role && user.role !== role) {
    auditAsync({
      action: 'FAILED_LOGIN', role: user.role, userId: user._id.toString(), resourceType: 'AUTH',
      result: 'DENIED', ipAddress: ip, detail: `Role mismatch: account is ${user.role}, login requested ${role}`,
    });
    throw ApiError.forbidden(`This account is registered as ${user.role}. Choose the correct portal.`);
  }

  if (user.status !== 'ACTIVE') {
    auditAsync({
      action: 'LOGIN_BLOCKED', role: user.role, userId: user._id.toString(), resourceType: 'AUTH',
      result: 'DENIED', ipAddress: ip, detail: 'Inactive account attempted login',
    });
    throw ApiError.forbidden('Account is inactive. Contact an administrator.');
  }

  // Email ownership gate — applies to self-registered accounts.
  if (!user.emailVerified) {
    auditAsync({
      action: 'LOGIN_BLOCKED', role: user.role, userId: user._id.toString(), resourceType: 'AUTH',
      result: 'DENIED', ipAddress: ip, detail: 'Unverified email attempted login',
    });
    throw ApiError.forbidden(
      // "the code we sent you" was a claim the server cannot always honour: with
      // no email transport configured, none was ever sent.
      'Please verify your email address before signing in. Enter the 6-digit code for this account, or request a new one.',
      // Lets the client send the user straight to the verification step with
      // this address prefilled instead of dead-ending them on a toast.
      'EMAIL_NOT_VERIFIED'
    );
  }

  await loginGuard.recordSuccess(user);

  const token = issueToken(user);
  auditAsync({
    action: 'LOGIN', role: user.role, userId: user._id.toString(), resourceType: 'AUTH',
    resourceId: user._id.toString(), result: 'SUCCESS', ipAddress: ip,
    detail: `${user.role} logged in`,
  });

  res.json({ success: true, token, user: safeUser(user) });
}

/** POST /api/auth/logout — client drops the token; server records the event. */
async function logout(req, res) {
  if (req.user) {
    await writeAudit({
      action: 'LOGOUT',
      role: req.user.role,
      userId: req.user.id,
      resourceType: 'AUTH',
      resourceId: req.user.id,
      result: 'SUCCESS',
      ipAddress: req.ip,
      detail: 'User logged out',
    });
  }
  res.json({ success: true, message: 'Logged out' });
}

/** GET /api/auth/me */
async function me(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.unauthorized('Account not found');
  res.json({ success: true, user: safeUser(user) });
}

/**
 * POST /api/auth/logout-all — revoke every token issued to this account.
 * The token generation is bumped, so tokens that are still unexpired (and
 * correctly signed) stop working everywhere, not just in this browser.
 */
async function logoutAll(req, res) {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.unauthorized('Invalid or expired token');

  await user.revokeTokens();
  await writeAudit({
    action: 'LOGOUT',
    role: user.role,
    userId: user._id.toString(),
    resourceType: 'AUTH',
    resourceId: user._id.toString(),
    result: 'SUCCESS',
    ipAddress: req.ip,
    detail: 'All sessions revoked (signed out everywhere)',
  });

  res.json({ success: true, message: 'Signed out of all devices' });
}

/** POST /api/auth/change-password (self-service, audited). */
async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user.id).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Account not found');

  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    auditAsync({
      action: 'SECURITY_EVENT', role: user.role, userId: user._id.toString(), resourceType: 'AUTH',
      result: 'DENIED', ipAddress: req.ip, detail: 'Password change failed: wrong current password',
    });
    throw ApiError.unauthorized('Current password is incorrect');
  }

  user.passwordHash = await User.hashPassword(newPassword, config.bcrypt.rounds);
  // A password change must invalidate every existing session, otherwise a
  // token stolen before the change keeps working after it.
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  auditAsync({
    action: 'SECURITY_EVENT', role: user.role, userId: user._id.toString(), resourceType: 'AUTH',
    resourceId: user._id.toString(), result: 'SUCCESS', ipAddress: req.ip,
    detail: 'Password changed successfully — all sessions revoked',
  });

  // The device that made the change stays signed in with a fresh generation.
  res.json({ success: true, message: 'Password updated', token: issueToken(user) });
}

module.exports = {
  register,
  verifyEmailOtp,
  resendEmailOtp,
  login,
  logout,
  me,
  changePassword,
  logoutAll,
  safeUser,
};

wrapAll(module.exports);
