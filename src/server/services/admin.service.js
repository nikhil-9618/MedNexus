/**
 * Admin service — user, doctor, appointment, department and settings
 * management. Every sensitive action writes an audit entry.
 */
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const Department = require('../models/Department');
const Setting = require('../models/Setting');
const MedicalRecord = require('../models/MedicalRecord');
const { ApiError } = require('../utils/ApiError');
const { auditAsync } = require('./audit.service');
const { nextDoctorCode, nextPatientCode } = require('../utils/ids');
const { config } = require('../config/env');

/** Paginated patient directory with search. */
async function listPatients({ q, status, page, limit }) {
  const filter = {};
  if (status) {
    const users = await User.find({ role: 'PATIENT', status }).select('_id').lean();
    filter.userId = { $in: users.map((u) => u._id) };
  }
  if (q) {
    const re = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const users = await User.find({ role: 'PATIENT', $or: [{ name: re }, { email: re }] }).select('_id').lean();
    filter.userId = filter.userId
      ? { $in: users.map((u) => u._id).filter((id) => filter.userId.$in.some((x) => x.equals(id))) }
      : { $in: users.map((u) => u._id) };
  }

  const skip = (page - 1) * limit;
  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email status createdAt')
      .lean(),
    Patient.countDocuments(filter),
  ]);

  const items = patients.map((p) => ({
    id: p._id.toString(),
    patientId: p.patientId,
    name: p.userId ? p.userId.name : '',
    email: p.userId ? p.userId.email : '',
    status: p.userId ? p.userId.status : 'ACTIVE',
    dob: p.dob,
    gender: p.gender,
    phone: p.phone,
    joinedAt: p.userId && p.userId.createdAt ? p.userId.createdAt : p.createdAt,
    appointmentStats: { total: 0, upcoming: 0, completed: 0, cancelled: 0 },
  }));

  return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

/** Single patient for admin with appointment statistics. */
async function getPatientDetail(patientRefId) {
  if (!/^[0-9a-fA-F]{24}$/.test(String(patientRefId))) {
    const p = await Patient.findOne({ patientId: patientRefId });
    return getPatientDetail(p ? p._id : patientRefId);
  }
  const patient = await Patient.findById(patientRefId).populate('userId', 'name email status role createdAt');
  if (!patient) throw ApiError.notFound('Patient not found');

  const [total, upcoming, completed, cancelled] = await Promise.all([
    Appointment.countDocuments({ patientId: patient._id }),
    Appointment.countDocuments({ patientId: patient._id, status: { $in: ['Scheduled', 'Confirmed'] }, date: { $gte: new Date().toISOString().slice(0, 10) } }),
    Appointment.countDocuments({ patientId: patient._id, status: 'Completed' }),
    Appointment.countDocuments({ patientId: patient, status: 'Cancelled' }),
  ]);

  return {
    patient: {
      id: patient._id.toString(),
      patientId: patient.patientId,
      dob: patient.dob,
      gender: patient.gender,
      phone: patient.phone,
      address: patient.address,
      bloodGroup: patient.bloodGroup,
    },
    user: patient.userId
      ? {
          id: patient.userId._id.toString(),
          name: patient.userId.name,
          email: patient.userId.email,
          status: patient.userId.status,
          role: patient.userId.role,
          createdAt: patient.userId.createdAt,
        }
      : null,
    appointmentStats: { total, upcoming, completed, cancelled },
  };
}

/** Activate/deactivate a PATIENT account (audited). */
async function setPatientStatus(patientRefId, status, admin, ip) {
  const patient = await resolvePatient(patientRefId);
  const user = await User.findById(patient.userId);
  if (!user) throw ApiError.notFound('Patient account not found');
  if (user._id.toString() === admin.id) {
    throw ApiError.conflict('Admins cannot change their own account here');
  }

  user.status = status;
  await user.save();

  auditAsync({
    action: status === 'ACTIVE' ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_DEACTIVATED',
    role: admin.role,
    userId: admin.id,
    resourceType: 'USER',
    resourceId: user._id.toString(),
    result: 'SUCCESS',
    ipAddress: ip,
    detail: `Patient ${patient.patientId} set to ${status}`,
  });

  return { patientId: patient.patientId, status };
}

async function resolvePatient(ref) {
  if (/^[0-9a-fA-F]{24}$/.test(String(ref))) return Patient.findById(ref);
  return Patient.findOne({ patientId: ref });
}

/** Create a doctor (creates User + Doctor profile, audited). */
async function createDoctor(payload, admin, ip) {
  const email = payload.email.toLowerCase();
  const dup = await User.findOne({ email });
  if (dup) throw ApiError.conflict('An account with this email already exists');

  const user = await User.create({
    name: payload.name,
    email,
    passwordHash: await User.hashPassword(payload.password, config.bcrypt.rounds),
    role: 'DOCTOR',
    status: 'ACTIVE',
  });

  const doctor = await Doctor.create({
    userId: user._id,
    doctorId: await nextDoctorCode(),
    specialization: payload.specialization,
    department: payload.department,
    experience: payload.experience,
    qualification: payload.qualification || '',
    bio: payload.bio || '',
    rating: 0,
    reviewsCount: 0,
    consultationFee: payload.consultationFee || 0,
    availability: new Map(Object.entries(payload.availability || {})),
    isAcceptingNew: payload.isAcceptingNew !== false,
  });

  auditAsync({
    action: 'DOCTOR_CREATED',
    role: admin.role,
    userId: admin.id,
    resourceType: 'DOCTOR',
    resourceId: doctor.doctorId,
    result: 'SUCCESS',
    ipAddress: ip,
    detail: `Created Dr ${payload.name} (${payload.specialization})`,
  });

  return { user: user.toJSON(), doctor: doctor.toJSON() };
}

/** Update doctor profile fields (not status). */
async function updateDoctor(doctorRefId, updates, admin, ip) {
  const doctor = await resolveDoctor(doctorRefId);
  if (!doctor) throw ApiError.notFound('Doctor not found');
  const user = await User.findById(doctor.userId);
  if (!user) throw ApiError.notFound('Doctor account not found');

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.experience !== undefined) doctor.experience = updates.experience;
  if (updates.specialization !== undefined) doctor.specialization = updates.specialization;
  if (updates.department !== undefined) doctor.department = updates.department;
  if (updates.qualification !== undefined) doctor.qualification = updates.qualification;
  if (updates.bio !== undefined) doctor.bio = updates.bio;
  if (updates.consultationFee !== undefined) doctor.consultationFee = updates.consultationFee;
  if (updates.isAcceptingNew !== undefined) doctor.isAcceptingNew = updates.isAcceptingNew;
  if (updates.availability !== undefined) {
    doctor.availability = new Map(Object.entries(updates.availability));
  }

  await Promise.all([user.save(), doctor.save()]);

  auditAsync({
    action: 'DOCTOR_UPDATED',
    role: admin.role,
    userId: admin.id,
    resourceType: 'DOCTOR',
    resourceId: doctor.doctorId,
    result: 'SUCCESS',
    ipAddress: ip,
    detail: `Updated: ${Object.keys(updates).join(', ')}`,
  });

  return doctor.toJSON();
}

/** Activate/deactivate a doctor (deactivation hides from directory & blocks booking). */
async function setDoctorStatus(doctorRefId, status, admin, ip) {
  const doctor = await resolveDoctor(doctorRefId);
  if (!doctor) throw ApiError.notFound('Doctor not found');
  const user = await User.findById(doctor.userId);
  if (!user) throw ApiError.notFound('Doctor account not found');

  user.status = status;
  await user.save();

  auditAsync({
    action: status === 'ACTIVE' ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_DEACTIVATED',
    role: admin.role,
    userId: admin.id,
    resourceType: 'USER',
    resourceId: user._id.toString(),
    result: 'SUCCESS',
    ipAddress: ip,
    detail: `Doctor ${doctor.doctorId} set to ${status}`,
  });

  return { doctorId: doctor.doctorId, status };
}

async function resolveDoctor(ref) {
  if (/^[0-9a-fA-F]{24}$/.test(String(ref))) return Doctor.findById(ref);
  return Doctor.findOne({ doctorId: ref });
}

/** Admin appointment management list with patient/doctor names + search. */
async function listAppointmentsAdmin({ page, limit, status, date, from, to, q }) {
  const filter = {};
  if (status) filter.status = status;
  if (date) filter.date = date;
  else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }

  if (q) {
    const re = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const users = await User.find({ name: re }).select('_id').lean();
    const userIds = users.map((u) => u._id);
    const patients = await Patient.find({ $or: [{ patientId: re }, { userId: { $in: userIds } }] }).select('_id').lean();
    const doctors = await Doctor.find({ doctorId: re }).select('_id').lean();
    filter.$or = [
      { reason: re },
      { patientId: { $in: patients.map((p) => p._id) } },
      { doctorId: { $in: doctors.map((d) => d._id) } },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ date: -1, time: -1 })
      .skip(skip).limit(limit)
      .populate({
        path: 'doctorId',
        select: 'doctorId specialization department userId',
        populate: { path: 'userId', select: 'name' },
      })
      .populate({
        path: 'patientId',
        select: 'patientId userId',
        populate: { path: 'userId', select: 'name' },
      })
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  const appointmentService = require('./appointment.service');
  return {
    items: items.map(appointmentService.hydrateAppointment),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

/** Departments CRUD (list used by directory + admin UI). */
async function listDepartments() {
  return Department.find().sort({ name: 1 }).lean();
}

async function createDepartment(payload, admin, ip) {
  const code = payload.code.toUpperCase();
  const dup = await Department.findOne({ code });
  if (dup) throw ApiError.conflict(`Department ${code} already exists`);
  const dept = await Department.create({ ...payload, code });
  auditAsync({
    action: 'DEPARTMENT_CREATED',
    role: admin.role,
    userId: admin.id,
    resourceType: 'DEPARTMENT',
    resourceId: dept.code,
    result: 'SUCCESS',
    ipAddress: ip,
    detail: `Created department ${dept.name}`,
  });
  return dept.toJSON();
}

async function updateDepartment(code, updates, admin, ip) {
  const dept = await Department.findOne({ code: code.toUpperCase() });
  if (!dept) throw ApiError.notFound('Department not found');
  if (updates.name !== undefined) dept.name = updates.name;
  if (updates.description !== undefined) dept.description = updates.description;
  if (updates.isActive !== undefined) dept.isActive = updates.isActive;
  await dept.save();
  auditAsync({
    action: 'DEPARTMENT_UPDATED',
    role: admin.role,
    userId: admin.id,
    resourceType: 'DEPARTMENT',
    resourceId: dept.code,
    result: 'SUCCESS',
    ipAddress: ip,
    detail: `Updated: ${Object.keys(updates).join(', ')}`,
  });
  return dept.toJSON();
}

async function deleteDepartment(code, admin, ip) {
  const dept = await Department.findOne({ code: code.toUpperCase() });
  if (!dept) throw ApiError.notFound('Department not found');
  const inUse = await Doctor.exists({ department: dept.name });
  if (inUse) throw ApiError.conflict('Cannot delete: doctors are assigned to this department');
  await dept.deleteOne();
  auditAsync({
    action: 'DEPARTMENT_DELETED',
    role: admin.role,
    userId: admin.id,
    resourceType: 'DEPARTMENT',
    resourceId: dept.code,
    result: 'SUCCESS',
    ipAddress: ip,
    detail: `Deleted department ${dept.name}`,
  });
  return { deleted: true };
}

/** Settings get/update (audited). */
async function getSettings() {
  const docs = await Setting.find().sort({ key: 1 }).lean();
  return docs.map((s) => ({ key: s.key, value: s.value, label: s.label, updatedAt: s.updatedAt }));
}

async function updateSettings(entries, admin, ip) {
  const out = [];
  for (const e of entries) {
    const doc = await Setting.findOneAndUpdate(
      { key: e.key },
      { $set: { value: e.value, updatedAtBy: admin.id } },
      { new: true, upsert: true }
    );
    out.push({ key: doc.key, value: doc.value });
  }
  auditAsync({
    action: 'SETTINGS_UPDATED',
    role: admin.role,
    userId: admin.id,
    resourceType: 'SETTING',
    resourceId: entries.map((e) => e.key).join(',').slice(0, 60),
    result: 'SUCCESS',
    ipAddress: ip,
    detail: `Updated ${entries.length} setting(s)`,
  });
  return out;
}

module.exports = {
  listPatients,
  getPatientDetail,
  setPatientStatus,
  createDoctor,
  updateDoctor,
  setDoctorStatus,
  listAppointmentsAdmin,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getSettings,
  updateSettings,
};
