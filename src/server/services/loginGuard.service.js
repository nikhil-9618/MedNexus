/**
 * Account lockout — the per-account counterpart to the IP rate limiter.
 *
 * IP limiting alone cannot stop a distributed guess against one account, and it
 * punishes an innocent shared office address. This counts failures per account
 * instead: once the limit is reached the account refuses sign-ins for a cooling
 * period no matter where the attempts come from. A successful sign-in clears
 * the counter, so a user who mistypes a few times is never stranded.
 */
const { ApiError } = require('../utils/ApiError');
const { auditAsync } = require('./audit.service');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

/** Milliseconds left on an active lock (0 when not locked). */
function lockRemainingMs(user) {
  if (!user || !user.lockedUntil) return 0;
  return Math.max(0, new Date(user.lockedUntil).getTime() - Date.now());
}

/** Refuse a sign-in while the account is locked. Call BEFORE comparing passwords. */
function assertNotLocked(user) {
  const remaining = lockRemainingMs(user);
  if (remaining <= 0) return;

  const minutes = Math.ceil(remaining / 60000);
  auditAsync({
    action: 'LOGIN_BLOCKED',
    role: user.role,
    userId: user._id.toString(),
    resourceType: 'AUTH',
    result: 'DENIED',
    detail: `Locked account — ${minutes} minute(s) remaining`,
  });
  throw ApiError.tooMany(
    `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
  );
}

/** Count one failed attempt, locking the account once the limit is reached. */
async function recordFailure(user) {
  user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

  if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
    user.lockedUntil = new Date(Date.now() + LOCK_MS);
    auditAsync({
      action: 'SECURITY_EVENT',
      role: user.role,
      userId: user._id.toString(),
      resourceType: 'AUTH',
      resourceId: user._id.toString(),
      result: 'DENIED',
      detail: `Account locked after ${user.failedLoginAttempts} failed sign-in attempts`,
    });
  }

  await user.save();
}

/** Clear failure state and stamp the sign-in. */
async function recordSuccess(user) {
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();
}

module.exports = { assertNotLocked, recordFailure, recordSuccess, lockRemainingMs, MAX_FAILED_ATTEMPTS, LOCK_MS };
