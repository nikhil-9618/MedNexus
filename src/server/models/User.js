/**
 * User model — authentication identity for every role.
 * Password hashes NEVER leave the API (toJSON strips them).
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES, USER_STATUS } = require('../config/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ROLES, index: true },
    status: { type: String, enum: USER_STATUS, default: 'ACTIVE', index: true },
    lastLoginAt: { type: Date, default: null },

    // Email OTP verification (patient self-registration).
    // Defaults to true so seeded/admin/doctor accounts are not gated; a new
    // patient registration explicitly sets it false until the code is verified.
    emailVerified: { type: Boolean, default: true, index: true },
    emailOtpHash: { type: String, default: null, select: false },
    emailOtpExpiresAt: { type: Date, default: null },
    emailOtpAttempts: { type: Number, default: 0 },
    emailOtpLastSentAt: { type: Date, default: null },

    // ---- Session revocation ----
    // Bumped whenever every outstanding token for this account must die
    // (password change, "sign out everywhere"). Tokens carry the value they
    // were issued with, so a stale token is rejected even though its signature
    // and expiry are still valid.
    tokenVersion: { type: Number, default: 0 },

    // ---- Brute-force lockout ----
    // IP rate limiting slows an attacker down; this stops one account from
    // being guessed at indefinitely from many addresses.
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash; // never expose
        return ret;
      },
    },
  }
);

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** Invalidate every token already issued to this account. */
userSchema.methods.revokeTokens = function revokeTokens() {
  this.tokenVersion = (this.tokenVersion || 0) + 1;
  return this.save();
};

/** Hash a plaintext password for storage (never store plaintext). */
userSchema.statics.hashPassword = function hashPassword(plain, rounds = 10) {
  return bcrypt.hash(plain, rounds);
};

module.exports = mongoose.model('User', userSchema);
