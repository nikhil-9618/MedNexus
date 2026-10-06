/**
 * Zod schemas for authentication and profile payloads.
 */
const { z } = require('zod');
const { ROLES, GENDERS } = require('../config/constants');
const { isISODate } = require('../utils/datetime');

/** Password policy: 8+ chars, upper, lower, digit. */
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password too long')
  .regex(/[A-Z]/, 'Must include an uppercase letter')
  .regex(/[a-z]/, 'Must include a lowercase letter')
  .regex(/[0-9]/, 'Must include a digit');

const isoDate = z
  .string()
  .refine((v) => isISODate(v), 'Use a valid date (YYYY-MM-DD)');

const phone = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s()-]{7,20}$/, 'Enter a valid phone number');

const email = z.string().trim().toLowerCase().email('Enter a valid email').max(120);

// ---- Bot-trap fields -------------------------------------------------------
// `website` is a honeypot: real users never see it, so any value means a bot.
// `formStartedAt` is the epoch-ms the form was rendered; submissions faster
// than HUMAN_FILL_MS are treated as automated. Both are declared so zod keeps
// them, then discarded by the controller — they never reach the database.
const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is too short').max(80),
    email,
    phone,
    dob: isoDate,
    gender: z.enum(GENDERS),
    password,
    confirmPassword: z.string(),
    website: z.string().max(200).optional(),
    formStartedAt: z.union([z.number(), z.string()]).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72),
  role: z.enum(ROLES).optional(),
});

const patientProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: phone.optional(),
  dob: isoDate.optional(),
  gender: z.enum(GENDERS).optional(),
  address: z.string().trim().max(200).optional(),
  bloodGroup: z.string().trim().max(5).optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/* ---- Email OTP verification ---- */
const otpCode = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email');
const verifyOtpSchema = z.object({ email, otp: otpCode });
const resendOtpSchema = z.object({ email });

/** Minimum realistic time (ms) a human needs to read and complete the form. */
const HUMAN_FILL_MS = 1500;

module.exports = {
  registerSchema,
  HUMAN_FILL_MS,
  verifyOtpSchema,
  resendOtpSchema,
  loginSchema,
  patientProfileSchema,
  changePasswordSchema,
  password,
  isoDate,
  phone,
  email,
};
