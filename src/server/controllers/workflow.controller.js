const { wrapAll } = require('../utils/asyncHandler');
/**
 * Workflow controller — queue, consultation, prescription, lab and patient
 * history endpoints. Authorization is enforced in the service layer; this
 * controller only orchestrates and shapes responses.
 */
const workflowService = require('../services/workflow.service');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const { getPagination } = require('../utils/query');

/**
 * GET /api/queues — list department queues (admin/doctor scope).
 * Query: departmentCode, status, page, limit
 */
async function listQueues(req, res) {
  const { page, limit } = getPagination(req.query);
  const dept = req.query.departmentCode || '';
  const status = req.query.status || null;

  if (req.user.role === 'ADMIN') {
    // Admin may list all departments if no filter.
    if (!dept) {
      const depts = await listAllDepartmentQueues({ page, limit });
      return res.json({ success: true, departments: depts });
    }
    const result = await workflowService.departmentQueue(dept, { statusFilter: status || undefined, page, limit });
    return res.json({ success: true, ...result });
  }

  // DOCTOR: only see queues for their assigned department(s) when authorized.
  if (req.user.role === 'DOCTOR') {
    const Doctor = require('../models/Doctor');
    const doctor = await Doctor.findOne({ userId: req.user.id });
    if (!doctor) return res.json({ success: true, items: [], total: 0, page, limit, pages: 1 });
    const result = await workflowService.departmentQueue(doctor.department, { statusFilter: status || undefined, page, limit });
    return res.json({ success: true, departmentCode: doctor.department, ...result });
  }

  return res.json({ success: true, items: [], total: 0, page, limit, pages: 1 });
}

async function listAllDepartmentQueues({ page = 1, limit = 50 }) {
  const depts = await Promise.all(
    (require('../config/constants').HOSPITAL_DEPTS || []).map(async (d) => {
      const r = await workflowService.departmentQueue(d.code, { page, limit });
      return { departmentCode: d.code, departmentName: d.name, ...r };
    })
  );
  return depts;
}

/**
 * POST /api/queues/advance — advance now-serving in a department.
 * Body: departmentCode
 */
async function advanceQueue(req, res) {
  const dept = req.body.departmentCode || '';
  if (!dept) throw require('../utils/ApiError').badRequest('departmentCode is required');

  if (req.user.role === 'PATIENT') {
    throw require('../utils/ApiError').forbidden('Patients cannot advance queues');
  }

  const result = await workflowService.advanceDepartmentQueue(dept, { role: req.user.role, userId: req.user.id, ipAddress: req.ip });
  return res.json({ success: true, ...result });
}

/**
 * GET /api/consultations/:identifier — read a consultation for an authorized user.
 * Identifier may be a consultationId (CON-...) or the appointmentId.
 */
async function getConsultation(req, res) {
  const c = await workflowService.getConsultationWithAuth(req.params.identifier, req.user);
  return res.json({ success: true, consultation: workflowService.hydrateConsultation(c) });
}

/**
 * POST /api/consultations/:appointmentId/start — start a consultation.
 * Body: chiefComplaint, symptoms, observations, diagnosis, vitals, notes,
 *       followUpDate, recommendedTests, referral
 */
async function startConsultation(req, res) {
  const result = await workflowService.startConsultation(req.params.appointmentId, req.body, { role: req.user.role, userId: req.user.id, ipAddress: req.ip });
  return res.status(201).json({ success: true, message: 'Consultation started', ...result });
}

/**
 * POST /api/consultations/:appointmentId/complete — complete a consultation.
 * Body: diagnosis, symptoms, observations, vitals, notes, prescriptions,
 *       labOrders, followUpDate, recommendedTests, referral, recordId
 */
async function completeConsultation(req, res) {
  const result = await workflowService.completeConsultation(req.params.appointmentId, req.body, { role: req.user.role, userId: req.user.id, ipAddress: req.ip });
  return res.json({ success: true, message: 'Consultation completed', ...result });
}

/**
 * GET /api/patients/me/history — patient's full medical history (timeline).
 */
async function patientHistory(req, res) {
  const patient = await Patient.findOne({ userId: req.user.id });
  if (!patient) throw require('../utils/ApiError').notFound('Patient profile not found');
  const { page, limit } = getPagination(req.query);
  const result = await workflowService.patientHistory(patient._id, { page, limit });
  return res.json({ success: true, ...result });
}

/**
 * GET /api/patients/me/prescriptions — patient's prescriptions.
 */
async function patientPrescriptions(req, res) {
  const patient = await Patient.findOne({ userId: req.user.id });
  if (!patient) throw require('../utils/ApiError').notFound('Patient profile not found');
  const { page, limit } = getPagination(req.query);
  const Prescription = require('../models/Prescription');
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Prescription.find({ patientId: patient._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('doctorId', 'doctorId specialization department userId')
      .populate('issuedBy', 'name')
      .lean(),
    Prescription.countDocuments({ patientId: patient._id }),
  ]);
  return res.json({
    success: true,
    items: items.map(workflowService.hydratePrescription),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  });
}

/**
 * GET /api/patients/me/lab-orders — patient's lab orders.
 */
async function patientLabOrders(req, res) {
  const patient = await Patient.findOne({ userId: req.user.id });
  if (!patient) throw require('../utils/ApiError').notFound('Patient profile not found');
  const { page, limit } = getPagination(req.query);
  const LabOrder = require('../models/LabOrder');
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    LabOrder.find({ patientId: patient._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('doctorId', 'doctorId specialization department userId')
      .populate('orderedBy', 'name')
      .lean(),
    LabOrder.countDocuments({ patientId: patient._id }),
  ]);
  return res.json({
    success: true,
    items: items.map(workflowService.hydrateLabOrder),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  });
}

/**
 * GET /api/patients/me/notifications — patient's notifications (read + mark read supported via PUT).
 */
async function patientNotifications(req, res) {
  const patient = await Patient.findOne({ userId: req.user.id });
  if (!patient) throw require('../utils/ApiError').notFound('Patient profile not found');
  const { page, limit } = getPagination(req.query);
  const Notification = require('../models/Notification');
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Notification.find({ patientId: patient._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ patientId: patient._id }),
  ]);
  return res.json({
    success: true,
    items: items.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      tokenCode: n.tokenCode || '',
      read: n.read,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  });
}

/**
 * PUT /api/patients/me/notifications/:id/read — mark a notification read.
 */
async function markNotificationRead(req, res) {
  const patient = await Patient.findOne({ userId: req.user.id });
  if (!patient) throw require('../utils/ApiError').notFound('Patient profile not found');
  const Notification = require('../models/Notification');
  const n = await Notification.findOne({ _id: req.params.id, patientId: patient._id });
  if (!n) throw require('../utils/ApiError').notFound('Notification not found');
  n.read = true;
  await n.save();
  return res.json({ success: true, message: 'Notification marked read' });
}

module.exports = {
  listQueues,
  advanceQueue,
  getConsultation,
  startConsultation,
  completeConsultation,
  patientHistory,
  patientPrescriptions,
  patientLabOrders,
  patientNotifications,
  markNotificationRead,
};

wrapAll(module.exports);
