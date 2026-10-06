/**
 * Zod schemas for admin endpoints.
 */
const { z } = require('zod');
const { USER_STATUS, SPECIALIZATIONS, ROLES, DOCTOR_SLOTS, WEEKDAYS } = require('../config/constants');
const { isoDate, phone, email } = require('./auth.validator');
const { isISODate } = require('../utils/datetime');
const { objectId } = require('./objectId.validator');

const patientQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    q: z.string().trim().max(80).optional(),
    status: z.enum(USER_STATUS).optional(),
  })
  .partial();

const updatePatientStatusSchema = z.object({ status: z.enum(USER_STATUS) });

const createDoctorSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  email,
  password: z.string().min(8).max(72),
  specialization: z.string().trim().min(2).max(60),
  department: z.string().trim().min(2).max(60),
  experience: z.coerce.number().int().min(0).max(60),
  qualification: z.string().trim().max(120).optional().default(''),
  bio: z.string().trim().max(500).optional().default(''),
  consultationFee: z.coerce.number().min(0).max(100000).optional().default(0),
  isAcceptingNew: z.boolean().optional().default(true),
  availability: z
    .record(z.enum(WEEKDAYS), z.array(z.enum(DOCTOR_SLOTS)).max(16))
    .optional()
    .default({}),
});

const updateDoctorSchema = createDoctorSchema
  .omit({ password: true, email: true })
  .partial();

const updateDoctorStatusSchema = z.object({ status: z.enum(USER_STATUS) });

const appointmentAdminQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    status: z.enum(['Scheduled', 'Confirmed', 'Completed', 'Cancelled']).optional(),
    date: z.string().refine((v) => isISODate(v), 'Invalid date').optional(),
    from: z.string().refine((v) => isISODate(v), 'Invalid date').optional(),
    to: z.string().refine((v) => isISODate(v), 'Invalid date').optional(),
    q: z.string().trim().max(80).optional(),
  })
  .partial();

const auditQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    action: z.string().trim().max(40).optional(),
    role: z.string().trim().max(20).optional(),
    result: z.enum(['SUCCESS', 'DENIED', 'FAILED']).optional(),
    q: z.string().trim().max(80).optional(),
    from: z.string().refine((v) => isISODate(v), 'Invalid date').optional(),
    to: z.string().refine((v) => isISODate(v), 'Invalid date').optional(),
  })
  .partial();

const departmentSchema = z.object({
  code: z.string().trim().min(2).max(12).regex(/^[A-Za-z]+$/, 'Code must be letters'),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).optional().default(''),
  isActive: z.boolean().optional().default(true),
});

const departmentUpdateSchema = departmentSchema.partial();

const settingsSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().trim().min(1).max(60),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    })
  ),
});

const analyticsQuerySchema = z
  .object({ days: z.coerce.number().int().min(7).max(90).optional() })
  .partial();

const queueQuerySchema = z
  .object({
    departmentCode: z.string().trim().max(12).optional(),
    status: z.enum(['Waiting', 'NowServing', 'InConsultation', 'Completed', 'Cancelled']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .partial();

const queueAdvanceSchema = z.object({
  departmentCode: z.string().trim().min(1).max(12),
});

const adminConsultationQuerySchema = z
  .object({
    status: z.enum(['Pending', 'InProgress', 'Completed', 'Cancelled']).optional(),
    departmentCode: z.string().trim().max(12).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .partial();

const adminQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    q: z.string().trim().max(80).optional(),
  })
  .partial();

// Consultation lifecycle request validators.
const vitalsSchema = z
  .object({
    bloodPressure: z.string().trim().max(12).optional(),
    heartRate: z.number().int().min(0).max(300).optional(),
    temperature: z.number().min(30).max(45).optional(),
    oxygenSaturation: z.number().min(0).max(100).optional(),
    respiratoryRate: z.number().int().min(0).max(60).optional(),
    weight: z.number().min(0).max(400).optional(),
    height: z.number().min(0).max(250).optional(),
  })
  .optional();

const prescriptionItemSchema = z.object({
  medicine: z.string().trim().min(1).max(120),
  dosage: z.string().trim().min(1).max(80),
    frequency: z.string().trim().min(1).max(120),
  duration: z.string().trim().max(120).optional().default(''),
  instructions: z.string().trim().max(400).optional().default(''),
});

const labTestSchema = z.object({
  test: z.string().trim().min(1).max(120),
  priority: z.enum(['Routine', 'Urgent', 'STAT']).optional().default('Routine'),
  notes: z.string().trim().max(400).optional().default(''),
});

const startConsultationSchema = z.object({
  chiefComplaint: z.string().trim().max(300).optional().default(''),
  symptoms: z.string().trim().max(600).optional().default(''),
  observations: z.string().trim().max(800).optional().default(''),
  diagnosis: z.string().trim().max(300).optional().default(''),
  vitals: vitalsSchema,
  notes: z.string().trim().max(1200).optional().default(''),
  followUpDate: z.string().trim().max(12).optional().default(''),
  recommendedTests: z.string().trim().max(400).optional().default(''),
  referral: z.string().trim().max(300).optional().default(''),
});

const completeConsultationSchema = startConsultationSchema
  .extend({
    prescriptions: z
      .array(prescriptionItemSchema)
      .max(50, 'Too many prescription items at once')
      .optional(),
    labOrders: z
      .array(labTestSchema)
      .max(50, 'Too many lab tests at once')
      .optional(),
  })
  .partial();

module.exports = {
  objectId,
  patientQuerySchema,
  updatePatientStatusSchema,
  createDoctorSchema,
  updateDoctorSchema,
  updateDoctorStatusSchema,
  appointmentAdminQuerySchema,
  auditQuerySchema,
  departmentSchema,
  departmentUpdateSchema,
  settingsSchema,
  analyticsQuerySchema,
  queueQuerySchema,
  queueAdvanceSchema,
  adminConsultationQuerySchema,
  adminQuerySchema,
  startConsultationSchema,
  completeConsultationSchema,
  ROLES,
  SPECIALIZATIONS,
};
