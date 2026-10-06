/**
 * Resource-level (ownership) authorization helpers.
 * Every protected endpoint must pass through one of these checks —
 * "logged in" is never sufficient for protected data.
 */
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const { ApiError } = require('../utils/ApiError');

/**
 * Resolve the Patient document for the current user.
 * PATIENT role => only their own profile. ADMIN may target any patientId.
 */
async function resolvePatientForRequest(req, patientIdParam) {
  if (req.user.role === 'PATIENT') {
    const patient = await Patient.findOne({ userId: req.user.id });
    if (!patient) throw ApiError.notFound('Patient profile not found');
    if (patientIdParam && patient._id.toString() !== String(patientIdParam)) {
      throw ApiError.forbidden('Access denied');
    }
    return patient;
  }
  if (req.user.role === 'ADMIN') {
    if (!patientIdParam) throw ApiError.badRequest('patientId is required');
    const patient = await Patient.findById(patientIdParam);
    if (!patient) throw ApiError.notFound('Patient not found');
    return patient;
  }
  throw ApiError.forbidden('Access denied for your role');
}

/**
 * For DOCTOR: returns { doctor, patient, isAuthorized }.
 * A doctor is authorized for a patient only while an ACTIVE
 * (Scheduled/Confirmed/Completed) appointment exists between them,
 * or when the doctor authored a medical record for that patient.
 */
async function assertDoctorPatientAccess(req, patientRefId) {
  const Appointment = require('../models/Appointment');
  const MedicalRecord = require('../models/MedicalRecord');

  const doctor = await Doctor.findOne({ userId: req.user.id });
  if (!doctor) throw ApiError.forbidden('Doctor profile not found');

  const patient = await Patient.findById(patientRefId);
  if (!patient) throw ApiError.notFound('Patient not found');

  const hasAppointment = await Appointment.exists({
    doctorId: doctor._id,
    patientId: patient._id,
    status: { $in: ['Scheduled', 'Confirmed', 'Completed'] },
  });
  const hasRecord = await MedicalRecord.exists({ doctorId: doctor._id, patientId: patient._id });

  if (!hasAppointment && !hasRecord) {
    throw ApiError.forbidden('Access denied: not your assigned patient');
  }
  return { doctor, patient };
}

/** Guard for GET /api/records/:patientId etc. */
async function assertCanAccessPatient(req, patientRefId) {
  if (req.user.role === 'PATIENT') {
    const patient = await Patient.findOne({ userId: req.user.id });
    if (!patient) throw ApiError.notFound('Patient profile not found');
    if (patient._id.toString() !== String(patientRefId)) throw ApiError.forbidden('Access denied');
    return patient;
  }
  if (req.user.role === 'DOCTOR') {
    const { patient } = await assertDoctorPatientAccess(req, patientRefId);
    return patient;
  }
  if (req.user.role === 'ADMIN') {
    const patient = await Patient.findById(patientRefId);
    if (!patient) throw ApiError.notFound('Patient not found');
    return patient;
  }
  throw ApiError.forbidden('Access denied');
}

/** Guard for PUT /api/patients/me — patients may only edit themselves. */
async function assertSelfPatient(req) {
  if (req.user.role !== 'PATIENT') throw ApiError.forbidden('Access denied for your role');
  const patient = await Patient.findOne({ userId: req.user.id });
  if (!patient) throw ApiError.notFound('Patient profile not found');
  return patient;
}

module.exports = {
  resolvePatientForRequest,
  assertDoctorPatientAccess,
  assertCanAccessPatient,
  assertSelfPatient,
};
