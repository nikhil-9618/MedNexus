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

/** Hash a plaintext password for storage (never store plaintext). */
userSchema.statics.hashPassword = function hashPassword(plain, rounds = 10) {
  return bcrypt.hash(plain, rounds);
};

module.exports = mongoose.model('User', userSchema);
