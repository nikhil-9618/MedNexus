/**
 * Zod schemas for appointments, doctors and records.
 */
const { z } = require('zod');
const {
  APPOINTMENT_STATUS,
  DOCTOR_SLOTS,
  SPECIALIZATIONS,
} = require('../config/constants');
const { isISODate, isHHMM, todayISO } = require('../utils/datetime');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier');

const slotTime = z
  .string()
  .refine((v) => isHHMM(v) && DOCTOR_SLOTS.includes(v), 'Choose one of the available clinic slots');

const bookingSchema = z.object({
  doctorId: objectId,
  date: z
    .string()
    .refine((v) => isISODate(v), 'Use a valid date (YYYY-MM-DD)')
    .refine((v) => v >= todayISO(), 'Cannot book a date in the past'),
  time: slotTime,
  reason: z
    .string()
    .trim()
    .min(5, 'Describe the reason (min 5 characters)')
    .max(300, 'Reason is too long (max 300 characters)'),
});

const rescheduleSchema = z.object({
  date: z
    .string()
    .refine((v) => isISODate(v), 'Use a valid date (YYYY-MM-DD)')
    .refine((v) => v >= todayISO(), 'Cannot reschedule to a past date'),
  time: slotTime,
});

const statusUpdateSchema = z.object({
  status: z.enum(APPOINTMENT_STATUS),
  note: z.string().trim().max(300).optional(),
});

const appointmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(APPOINTMENT_STATUS).optional(),
  date: z.string().refine((v) => isISODate(v), 'Invalid date').optional(),
  from: z.string().refine((v) => isISODate(v), 'Invalid date').optional(),
  to: z.string().refine((v) => isISODate(v), 'Invalid date').optional(),
  doctorId: objectId.optional(),
  patientId: objectId.optional(),
  q: z.string().trim().max(80).optional(),
}).partial();

const recordCreateSchema = z.object({
  appointmentId: objectId,
  diagnosis: z.string().trim().min(3, 'Diagnosis is required').max(200),
  prescription: z.string().trim().max(400).optional().default(''),
  notes: z.string().trim().max(600).optional().default(''),
});

const recordUpdateSchema = z.object({
  diagnosis: z.string().trim().min(3).max(200).optional(),
  prescription: z.string().trim().max(400).optional(),
  notes: z.string().trim().max(600).optional(),
});

const recordQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).partial();

module.exports = {
  objectId,
  bookingSchema,
  rescheduleSchema,
  statusUpdateSchema,
  appointmentQuerySchema,
  recordCreateSchema,
  recordUpdateSchema,
  recordQuerySchema,
};
