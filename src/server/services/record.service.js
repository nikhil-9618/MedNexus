/**
 * Medical-record service — access control matrix + audit on every access.
 *
 * Permission matrix:
 *   PATIENT: view own only; never create/update.
 *   DOCTOR:  view patients with an appointment/record relationship;
 *            create only after an authorized, live (Scheduled/Confirmed) or
 *            same-day Completed consultation; update own records only.
 *   ADMIN:   view all (per administrative policy); no clinical writes.
 */
const mongoose = require('mongoose');
const MedicalRecord = require('../models/MedicalRecord');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { ApiError } = require('../utils/ApiError');
const { auditAsync } = require('./audit.service');
const { nextRecordCode } = require('../utils/ids');

const viewAudit = (user, record, ip, result = 'SUCCESS', detail) =>
  auditAsync({
    action: result === 'SUCCESS' ? 'VIEW_MEDICAL_RECORD' : 'VIEW_MEDICAL_RECORD_DENIED',
    role: user.role,
    userId: user.id,
    resourceType: 'MEDICAL_RECORD',
    resourceId: (record && (record.recordId || record._id)) || null,
    result,
    ipAddress: ip,
    detail: detail || `Accessed ${user.role} view`,
  });

/** Doctor -> patient authorization (appointment or authored record). */
async function doctorHasPatientAccess(doctorId, patientRefId) {
  const hasAppointment = await Appointment.exists({
    doctorId,
    patientId: patientRefId,
    status: { $in: ['Scheduled', 'Confirmed', 'Completed'] },
  });
  if (hasAppointment) return true;
  const hasRecord = await MedicalRecord.exists({ doctorId, patientId: patientRefId });
  return hasRecord;
}

/**
 * List records for a patient reference with full authorization.
 * Returns records only for users entitled to see them.
 */
const CATEGORIES = ['history', 'lab', 'prescription', 'note'];

async function listRecordsForPatient(patientRefId, user, { page, limit, category }, ip) {
  if (!mongoose.isValidObjectId(patientRefId)) throw ApiError.badRequest('Invalid patient id');
  if (category !== undefined && !CATEGORIES.includes(category)) {
    throw ApiError.badRequest('Invalid record category');
  }

  const patient = await Patient.findById(patientRefId);
  if (!patient) throw ApiError.notFound('Patient not found');

  let filter = { patientId: patient._id };
  if (category) filter.category = category;

  if (user.role === 'PATIENT') {
    const own = await Patient.findOne({ userId: user.id });
    if (!own || own._id.toString() !== patient._id.toString()) {
      viewAudit(user, patient, ip, 'DENIED', 'Patient tried to read another patient\'s records');
      throw ApiError.forbidden('Access denied');
    }
  } else if (user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: user.id });
    if (!doctor) throw ApiError.forbidden('Doctor profile not found');
    const ok = await doctorHasPatientAccess(doctor._id, patient._id);
    if (!ok) {
      viewAudit(user, patient, ip, 'DENIED', 'Doctor lacks relationship with patient');
      throw ApiError.forbidden('Access denied: not your assigned patient');
    }
    filter = { patientId: patient._id, doctorId: doctor._id };
  }
  // ADMIN: sees all records for the patient (policy).

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MedicalRecord.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'doctorId', select: 'doctorId userId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'patientId', select: 'patientId userId', populate: { path: 'userId', select: 'name' } })
      .lean(),
    MedicalRecord.countDocuments(filter),
  ]);

  auditAsync({
    action: 'VIEW_MEDICAL_RECORD',
    role: user.role,
    userId: user.id,
    resourceType: 'PATIENT',
    resourceId: patient.patientId,
    result: 'SUCCESS',
    ipAddress: oneIp(ip),
    detail: `Listed ${items.length} records`,
  });

  return {
    patient: {
      id: patient._id.toString(),
      patientId: patient.patientId,
      name: (patient.userId && patient.userId.name) || undefined,
    },
    category: category || null,
    items: items.map(hydrateRecord),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

function oneIp(ip) {
  return (ip || '').slice(0, 60);
}

/** Hydrate a record with doctor/patient display names. */
function hydrateRecord(r) {
  const src = r.toObject ? r.toObject() : r;
  const doctor = src.doctorId || {};
  const patient = src.patientId || {};
  const doctorUser = doctor.userId || {};
  const patientUser = patient.userId || {};
  return {
    id: (src._id || src.id).toString(),
    recordId: src.recordId,
    patientId: src.patientId,
    doctorId: src.doctorId,
    appointmentId: src.appointmentId || null,
    diagnosis: src.diagnosis,
    prescription: src.prescription,
    notes: src.notes,
    date: src.date,
    createdAt: src.createdAt,
    doctor: {
      id: doctor._id ? doctor._id.toString() : undefined,
      doctorId: doctor.doctorId,
      name: doctorUser.name,
    },
    patient: {
      id: patient._id ? patient._id.toString() : undefined,
      patientId: patient.patientId,
      name: patientUser.name,
    },
  };
}

/** Fetch a single record with authorization + audit. */
async function getRecord(recordId, user, ip) {
  if (!mongoose.isValidObjectId(recordId)) throw ApiError.badRequest('Invalid record id');
  const record = await MedicalRecord.findById(recordId)
    .populate({ path: 'doctorId', select: 'doctorId userId', populate: { path: 'userId', select: 'name' } })
    .populate({ path: 'patientId', select: 'patientId userId', populate: { path: 'userId', select: 'name' } });
  if (!record) throw ApiError.notFound('Record not found');

  if (user.role === 'PATIENT') {
    const own = await Patient.findOne({ userId: user.id });
    if (!own || record.patientId._id.toString() !== own._id.toString()) {
      viewAudit(user, record, ip, 'DENIED', 'Patient tried to read foreign record');
      throw ApiError.forbidden('Access denied');
    }
  } else if (user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: user.id });
    if (!doctor || record.doctorId._id.toString() !== doctor._id.toString()) {
      // Doctors may only view records they authored (scoped view).
      viewAudit(user, record, ip, 'DENIED', 'Doctor tried to read record they did not author');
      throw ApiError.forbidden('Access denied');
    }
  }

  auditAsync({
    action: 'VIEW_MEDICAL_RECORD',
    role: user.role,
    userId: user.id,
    resourceType: 'MEDICAL_RECORD',
    resourceId: record.recordId,
    result: 'SUCCESS',
    ipAddress: oneIp(ip),
    detail: `Single record view (${user.role})`,
  });

  return hydrateRecord(record);
}

/**
 * Create a record after an authorized consultation.
 * Only DOCTOR role. The doctor must have a live appointment with the
 * patient, and the appointment must belong to that doctor+patient pair.
 */
async function createRecord({ appointmentId, diagnosis, prescription, notes, category }, user, ip) {
  if (user.role !== 'DOCTOR') {
    auditAsync({
      action: 'CREATE_MEDICAL_RECORD',
      role: user.role,
      userId: user.id,
      resourceType: 'MEDICAL_RECORD',
      result: 'DENIED',
      ipAddress: oneIp(ip),
      detail: `Role ${user.role} attempted record creation`,
    });
    throw ApiError.forbidden('Access denied for your role');
  }

  const doctor = await Doctor.findOne({ userId: user.id });
  if (!doctor) throw ApiError.forbidden('Doctor profile not found');

  const appt = await Appointment.findById(appointmentId).populate('patientId', 'patientId');
  if (!appt) throw ApiError.notFound('Appointment not found');

  // The appointment must belong to this doctor.
  if (appt.doctorId.toString() !== doctor._id.toString()) {
    auditAsync({
      action: 'CREATE_MEDICAL_RECORD',
      role: user.role,
      userId: user.id,
      resourceType: 'MEDICAL_RECORD',
      result: 'DENIED',
      ipAddress: oneIp(ip),
      detail: 'Appointment belongs to another doctor',
    });
    throw ApiError.forbidden('Access denied: appointment not assigned to you');
  }

  // Doctors may document on live consultations or a same-day completed one.
  const today = new Date().toISOString().slice(0, 10);
  const documentable = ['Scheduled', 'Confirmed'].includes(appt.status) ||
    (appt.status === 'Completed' && appt.date === today);
  if (!documentable) {
    throw ApiError.conflict('Records can only be added for live or same-day completed consultations');
  }

  // Prevent duplicate documentation on the same appointment.
  const existing = await MedicalRecord.exists({ appointmentId: appt._id });
  if (existing) throw ApiError.conflict('A medical record already exists for this appointment');

  const record = await MedicalRecord.create({
    recordId: await nextRecordCode(),
    patientId: appt.patientId._id,
    doctorId: doctor._id,
    appointmentId: appt._id,
    diagnosis,
    prescription,
    notes,
    category: CATEGORIES.includes(category) ? category : 'history',
    date: appt.date,
    createdBy: user.id,
  });

  auditAsync({
    action: 'CREATE_MEDICAL_RECORD',
    role: user.role,
    userId: user.id,
    resourceType: 'MEDICAL_RECORD',
    resourceId: record.recordId,
    result: 'SUCCESS',
    ipAddress: oneIp(ip),
    detail: `Diagnosis recorded for ${appt.patientId.patientId}`,
  });

  return record;
}

/** Update a record. Only its author (doctor) may edit, and only clinical fields. */
async function updateRecord(recordId, updates, user, ip) {
  if (user.role !== 'DOCTOR') throw ApiError.forbidden('Access denied for your role');

  const doctor = await Doctor.findOne({ userId: user.id });
  if (!doctor) throw ApiError.forbidden('Doctor profile not found');

  const record = await MedicalRecord.findById(recordId);
  if (!record) throw ApiError.notFound('Record not found');

  if (record.doctorId.toString() !== doctor._id.toString()) {
    auditAsync({
      action: 'UPDATE_MEDICAL_RECORD',
      role: user.role,
      userId: user.id,
      resourceType: 'MEDICAL_RECORD',
      resourceId: record.recordId,
      result: 'DENIED',
      ipAddress: oneIp(ip),
      detail: 'Doctor tried to edit a record they did not author',
    });
    throw ApiError.forbidden('Access denied: not the authoring doctor');
  }

  if (updates.diagnosis !== undefined) record.diagnosis = updates.diagnosis;
  if (updates.prescription !== undefined) record.prescription = updates.prescription;
  if (updates.notes !== undefined) record.notes = updates.notes;
  await record.save();

  auditAsync({
    action: 'UPDATE_MEDICAL_RECORD',
    role: user.role,
    userId: user.id,
    resourceType: 'MEDICAL_RECORD',
    resourceId: record.recordId,
    result: 'SUCCESS',
    ipAddress: oneIp(ip),
    detail: 'Clinical fields updated by authoring doctor',
  });

  return record;
}

module.exports = {
  doctorHasPatientAccess,
  listRecordsForPatient,
  getRecord,
  createRecord,
  updateRecord,
  hydrateRecord,
};
