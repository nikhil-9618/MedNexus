const { wrapAll } = require('../utils/asyncHandler');
/**
 * Admin controller — dashboards, user/doctor/appointment/department/
 * settings management, audit log access, and the clinical-workflow admin
 * reads (queues, consultations, prescriptions, lab orders, notifications).
 *
 * The 3D digital twin data endpoint is ADMIN-only: any non-admin request
 * receives 403 Forbidden. All twin data comes from MedNexus's database —
 * never fabricated patients, doctors, or queue counts.
 */
const adminService = require('../services/admin.service');
const analyticsService = require('../services/analytics.service');
const appointmentService = require('../services/appointment.service');
const workflowService = require('../services/workflow.service');
const AuditLog = require('../models/AuditLog');
const Queue = require('../models/Queue');
const Consultation = require('../models/Consultation');
const Prescription = require('../models/Prescription');
const LabOrder = require('../models/LabOrder');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const { getPagination, escapeRegex } = require('../utils/query');
const { ApiError } = require('../utils/ApiError');

// ---------------------------------------------------------------------------
// Existing core endpoints (behavior unchanged)
// ---------------------------------------------------------------------------

async function dashboard(req, res) {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 14, 7), 90);
  const overview = await analyticsService.getAdminOverview({ days });
  return res.json({ success: true, ...overview });
}

async function listPatients(req, res) {
  const { page, limit } = getPagination(req.query);
  const result = await adminService.listPatients({ ...req.query, page, limit });
  const Appointment = require('../models/Appointment');
  const today = new Date().toISOString().slice(0, 10);
  result.items = await Promise.all(result.items.map(async (p) => {
    const [total, upcoming, completed, cancelled] = await Promise.all([
      Appointment.countDocuments({ patientId: p.id }),
      Appointment.countDocuments({ patientId: p.id, status: { $in: ['Scheduled', 'Confirmed', 'InQueue', 'NowServing', 'InConsultation'] }, date: { $gte: today } }),
      Appointment.countDocuments({ patientId: p.id, status: 'Completed' }),
      Appointment.countDocuments({ patientId: p.id, status: { $in: ['Cancelled', 'NoShow'] } }),
    ]);
    return { ...p, appointmentStats: { total, upcoming, completed, cancelled } };
  }));
  return res.json({ success: true, ...result });
}

async function getPatient(req, res) {
  const detail = await adminService.getPatientDetail(req.params.id);
  return res.json({ success: true, ...detail });
}

async function setPatientStatus(req, res) {
  const result = await adminService.setPatientStatus(req.params.id, req.body.status, req.user, req.ip);
  return res.json({ success: true, message: `Patient account ${result.status.toLowerCase()}`, ...result });
}

async function listDoctors(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const q = req.query.q ? escapeRegex(req.query.q) : null;
  const status = req.query.status;

  const User = require('../models/User');
  const Doctor = require('../models/Doctor');
  const userFilter = { role: 'DOCTOR' };
  if (q) userFilter.$or = [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }];
  if (status) userFilter.status = status;

  const doctors = await Doctor.find().populate({ path: 'userId', match: userFilter, select: 'name email status createdAt' }).lean();
  let rows = doctors.filter((d) => d.userId).map((d) => ({
    id: d._id.toString(),
    doctorId: d.doctorId,
    name: d.userId.name,
    email: d.userId.email,
    status: d.userId.status,
    specialization: d.specialization,
    department: d.department,
    experience: d.experience,
    rating: d.rating,
    consultationFee: d.consultationFee,
    isAcceptingNew: d.isAcceptingNew,
    createdAt: d.createdAt,
  }));
  const total = rows.length;
  rows = rows.sort((a, b) => a.name.localeCompare(b.name)).slice((page - 1) * limit, (page - 1) * limit + limit);
  return res.json({ success: true, items: rows, total, page, limit, pages: Math.ceil(total / limit) || 1 });
}

async function createDoctor(req, res) {
  const result = await adminService.createDoctor(req.body, req.user, req.ip);
  return res.status(201).json({ success: true, message: 'Doctor created', doctor: result.doctor, user: result.user });
}

async function updateDoctor(req, res) {
  const doctor = await adminService.updateDoctor(req.params.id, req.body, req.user, req.ip);
  return res.json({ success: true, message: 'Doctor updated', doctor });
}

async function setDoctorStatus(req, res) {
  const result = await adminService.setDoctorStatus(req.params.id, req.body.status, req.user, req.ip);
  return res.json({ success: true, message: `Doctor account ${result.status.toLowerCase()}`, ...result });
}

async function listAppointments(req, res) {
  const { page, limit } = getPagination(req.query);
  const result = await adminService.listAppointmentsAdmin({ ...req.query, page, limit });
  return res.json({ success: true, ...result });
}

async function updateAppointmentStatus(req, res) {
  const appt = await appointmentService.getAuthorizedAppointment(req.params.id, req.user);
  const updated = await appointmentService.changeStatus(
    appt,
    req.body.status,
    { role: req.user.role, userId: req.user.id, ipAddress: req.ip },
    req.body.note
  );
  return res.json({ success: true, message: `Appointment ${updated.status.toLowerCase()}`, appointment: appointmentService.hydrateAppointment(updated) });
}

async function listDepartments(_req, res) {
  const items = await adminService.listDepartments();
  return res.json({ success: true, items });
}

async function createDepartment(req, res) {
  const dept = await adminService.createDepartment(req.body, req.user, req.ip);
  return res.status(201).json({ success: true, message: 'Department created', department: dept });
}

async function updateDepartment(req, res) {
  const dept = await adminService.updateDepartment(req.params.code, req.body, req.user, req.ip);
  return res.json({ success: true, message: 'Department updated', department: dept });
}

async function deleteDepartment(req, res) {
  const result = await adminService.deleteDepartment(req.params.code, req.user, req.ip);
  return res.json({ success: true, ...result });
}

async function auditLogs(req, res) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};
  if (req.query.action) filter.action = { $regex: escapeRegex(req.query.action), $options: 'i' };
  if (req.query.role) filter.role = req.query.role;
  if (req.query.result) filter.result = req.query.result;
  if (req.query.from || req.query.to) {
    filter.timestamp = {};
    if (req.query.from) filter.timestamp.$gte = new Date(`${req.query.from}T00:00:00Z`);
    if (req.query.to) filter.timestamp.$lte = new Date(`${req.query.to}T23:59:59Z`);
  }
  if (req.query.q) {
    const re = { $regex: escapeRegex(req.query.q), $options: 'i' };
    filter.$or = [{ action: re }, { detail: re }, { resourceId: re }];
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).populate({ path: 'userId', select: 'name email' }).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    items: items.map((a) => ({
      id: a._id.toString(),
      logId: a.logId,
      timestamp: a.timestamp,
      user: a.userId ? a.userId.name : 'SYSTEM',
      email: a.userId ? a.userId.email : null,
      role: a.role,
      action: a.action,
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      result: a.result,
      ipAddress: a.ipAddress,
      detail: a.detail,
    })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  });
}

async function getSettings(_req, res) {
  const items = await adminService.getSettings();
  return res.json({ success: true, items });
}

async function updateSettings(req, res) {
  const items = await adminService.updateSettings(req.body.settings, req.user, req.ip);
  return res.json({ success: true, message: 'Settings saved', items });
}

module.exports = {
  dashboard,
  listPatients,
  getPatient,
  setPatientStatus,
  listDoctors,
  createDoctor,
  updateDoctor,
  setDoctorStatus,
  listAppointments,
  updateAppointmentStatus,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  auditLogs,
  getSettings,
  updateSettings,
};

wrapAll(module.exports);
