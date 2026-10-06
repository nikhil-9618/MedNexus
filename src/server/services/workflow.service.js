/**
 * Workflow service — queue, consultation, prescription and lab-order lifecycle.
 *
 * Responsibilities:
 * - Create a Queue entry when an appointment is booked (token + department queue).
 * - Advance department queues (now-serving) when the doctor or admin calls it.
 * - Start a consultation: lock the appointment into InConsultation, create a
 *   Consultation record, and move the queue to InConsultation.
 * - Complete a consultation: record diagnosis, vitals, notes, prescriptions,
 *   lab orders, follow-up and referral; move appointment to Completed and the
 *   queue to Completed.
 * - Aggregate a patient's medical history (consultations, prescriptions, lab
 *   orders, medical records).
 * - Enforce object-level authorization on consultations, prescriptions and lab
 *   orders (patient owns own; doctor owns consultation's patient; admin all).
 *
 * All medical content is synthetic/demo data for development.
 */
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Queue = require('../models/Queue');
const Consultation = require('../models/Consultation');
const Prescription = require('../models/Prescription');
const LabOrder = require('../models/LabOrder');
const MedicalRecord = require('../models/MedicalRecord');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { ApiError } = require('../utils/ApiError');
const { auditAsync } = require('./audit.service');
const {
  APPOINTMENT_TRANSITIONS,
  CONSULTATION_STATUS,
  QUEUE_STATUS,
  HOSPITAL_DEPTS,
} = require('../config/constants');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
}

/**
 * Resolve a department code ("CARD") or a department name ("Cardiology") to
 * its canonical code. Doctors store the department NAME; queues store the CODE.
 */
function resolveDepartmentCode(value) {
  if (!value) return null;
  const lower = String(value).trim().toLowerCase();
  const byCode = HOSPITAL_DEPTS.find((d) => d.code.toLowerCase() === lower);
  if (byCode) return byCode.code;
  const byName = HOSPITAL_DEPTS.find((d) => d.name.toLowerCase() === lower);
  return byName ? byName.code : String(value).trim();
}

function departmentCodeFor(doc, appointment) {
  return (
    resolveDepartmentCode(appointment && appointment.departmentCode) ||
    resolveDepartmentCode(doc && doc.department) ||
    'GENMED'
  );
}

/** Generate a department-scoped token code like CAR-024. */
async function nextTokenCode(departmentCode) {
  const prefix = (departmentCode || 'APT').toUpperCase().slice(0, 6);
  const last = await Queue.findOne({ 'queue.departmentCode': departmentCode || 'APT' })
    .sort({ createdAt: -1 })
    .lean();
  let n = 1;
  if (last && last.queue && last.queue.tokenCode) {
    const m = String(last.queue.tokenCode).match(new RegExp(`^${escapeRe(prefix)}-(\\d+)$`));
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}-${String(n).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Queue lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a queue entry for a freshly booked appointment.
 */
async function createQueueForAppointment({ appointment, doctor, patient, actor }) {
  const departmentCode = departmentCodeFor(doctor, appointment);
  const tokenCode = await nextTokenCode(departmentCode);

  const queue = await Queue.create({
    appointmentId: appointment._id,
    patientId: patient._id,
    doctorId: doctor._id,
    queue: { status: 'Waiting', position: 0, tokenCode, departmentCode },
    arrivedAt: null,
    notes: '',
  });

  const waitingCount = await Queue.countDocuments({
    'queue.departmentCode': departmentCode,
    'queue.status': { $in: ['Waiting', 'NowServing', 'InConsultation'] },
  });
  await Queue.updateOne({ _id: queue._id }, { 'queue.position': waitingCount });

  appointment.token = tokenCode;
  appointment.queueId = queue._id;
  appointment.departmentCode = departmentCode;
  await appointment.save();

  auditAsync({
    action: 'QUEUE_CREATED',
    role: actor.role,
    userId: actor.userId,
    resourceType: 'QUEUE',
    resourceId: queue._id.toString(),
    result: 'SUCCESS',
    ipAddress: actor.ipAddress,
    detail: `Token ${tokenCode} for ${departmentCode}`,
  });

  return queue;
}

/**
 * List the department queue for a given department code.
 * Returns Waiting/NowServing/InConsultation entries ordered by position then created.
 */
async function departmentQueue(departmentCode, opts = {}) {
  const { statusFilter, page = 1, limit = 50 } = opts;
  const base = { 'queue.departmentCode': departmentCode, 'queue.status': { $in: ['Waiting', 'NowServing', 'InConsultation'] } };
  if (statusFilter) base['queue.status'] = statusFilter;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Queue.find(base)
      .sort({ 'queue.position': 1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate({ path: 'patientId', select: 'patientId userId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'doctorId', select: 'doctorId specialization department userId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'appointmentId', select: 'date time status token' })
      .lean(),
    Queue.countDocuments(base),
  ]);

  return {
    departmentCode,
    items: items.map(humanizeQueue),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Advance the department queue: move the earliest Waiting to NowServing.
 */
async function advanceDepartmentQueue(departmentCode, actor) {
  const waiters = await Queue.find({
    'queue.departmentCode': departmentCode,
    'queue.status': 'Waiting',
  }).sort({ 'queue.position': 1, createdAt: 1 }).limit(1).lean();

  if (!waiters.length) {
    return { advanced: false, message: 'No patients waiting for this department' };
  }

  const queue = await Queue.findById(waiters[0]._id);
  if (!queue) throw ApiError.notFound('Queue entry not found');

  queue.queue.status = 'NowServing';
  queue.queue.position = 0;
  queue.calledAt = new Date();
  await queue.save();

  const remaining = await Queue.find({
    'queue.departmentCode': departmentCode,
    'queue.status': { $in: ['Waiting', 'NowServing', 'InConsultation'] },
    _id: { $ne: queue._id },
  }).sort({ 'queue.position': 1, createdAt: 1 }).lean();

  await Promise.all(remaining.map((r, i) => Queue.updateOne({ _id: r._id }, { 'queue.position': i + 1 })));

  await Notification.create({
    patientId: queue.patientId,
    type: 'queue_called',
    title: `Now serving: ${queue.queue.tokenCode}`,
    message: `Your token ${queue.queue.tokenCode} is now being served at ${lookupDepartmentName(queue.queue.departmentCode)}. Please proceed to the reception.`,
    queueId: queue._id,
    tokenCode: queue.queue.tokenCode,
    read: false,
  });

  auditAsync({
    action: 'QUEUE_ADVANCE',
    role: actor.role,
    userId: actor.userId,
    resourceType: 'QUEUE',
    resourceId: queue._id.toString(),
    result: 'SUCCESS',
    ipAddress: actor.ipAddress,
    detail: `Advanced ${queue.queue.tokenCode} in ${queue.queue.departmentCode}`,
  });

  return { advanced: true, queue: humanizeQueue(queue.toObject()) };
}

function lookupDepartmentName(code) {
  const found = HOSPITAL_DEPTS.find((d) => d.code === code);
  return found ? found.name : code;
}

function humanizeQueue(q) {
  const p = q.patientId || {};
  const du = p.userId || {};
  const d = q.doctorId || {};
  const dd = d.userId || {};
  const a = q.appointmentId || {};
  return {
    id: q._id.toString(),
    queue: q.queue,
    tokenCode: q.queue.tokenCode,
    departmentCode: q.queue.departmentCode,
    departmentName: lookupDepartmentName(q.queue.departmentCode),
    patient: { patientId: p.patientId, name: du.name || '' },
    doctor: { doctorId: d.doctorId, name: dd.name || '', specialization: d.specialization },
    appointment: { date: a.date, time: a.time, status: a.status, token: a.token },
    arrivedAt: q.arrivedAt,
    calledAt: q.calledAt,
    consultationStartedAt: q.consultationStartedAt,
    completedAt: q.completedAt,
    notes: q.notes,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Consultation lifecycle
// ---------------------------------------------------------------------------

/**
 * Start a consultation. Moves the appointment to InConsultation, creates a
 * Consultation record, and moves the queue to InConsultation.
 */
async function startConsultation(appointmentId, body, actor) {
  const appointment = await Appointment.findById(appointmentId).populate('patientId doctorId');
  if (!appointment) throw ApiError.notFound('Appointment not found');

  if (actor.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: actor.userId });
    if (!doctor || String(appointment.doctorId._id) !== String(doctor._id)) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: actor.role,
        userId: actor.userId,
        resourceType: 'CONSULTATION',
        resourceId: appointmentId,
        result: 'DENIED',
        detail: 'Doctor attempted to start consultation on unassigned appointment',
      });
      throw ApiError.forbidden('Access denied');
    }
  } else if (actor.role !== 'ADMIN') {
    throw ApiError.forbidden('Access denied');
  }

  if (!APPOINTMENT_TRANSITIONS[appointment.status] || !APPOINTMENT_TRANSITIONS[appointment.status].includes('InConsultation')) {
    throw ApiError.conflict(`Cannot start consultation from ${appointment.status}`);
  }

  const doctorDoc = await Doctor.findById(appointment.doctorId);
  const departmentCode = departmentCodeFor(doctorDoc, appointment);

  const consultationId = await nextConsultationId();
  const consultation = await Consultation.create({
    consultationId,
    appointmentId: appointment._id,
    patientId: appointment.patientId._id,
    doctorId: appointment.doctorId._id,
    departmentCode,
    status: 'InProgress',
    chiefComplaint: body.chiefComplaint || appointment.reason || '',
    symptoms: body.symptoms || '',
    observations: body.observations || '',
    diagnosis: body.diagnosis || '',
    vitals: body.vitals || {},
    notes: body.notes || '',
    followUpDate: body.followUpDate || '',
    recommendedTests: body.recommendedTests || '',
    referral: body.referral || '',
    createdBy: actor.userId,
    startedAt: new Date(),
  });

  appointment.consultationId = consultation._id;
  appointment.status = 'InConsultation';
  await appointment.save();

  const queue = await Queue.findOne({ appointmentId: appointment._id });
  if (queue) {
    queue.queue.status = 'InConsultation';
    queue.consultationStartedAt = new Date();
    await queue.save();
  }

  auditAsync({
    action: 'START_CONSULTATION',
    role: actor.role,
    userId: actor.userId,
    resourceType: 'CONSULTATION',
    resourceId: consultation._id.toString(),
    result: 'SUCCESS',
    ipAddress: actor.ipAddress,
    detail: `Consultation ${consultationId} for ${departmentCode}`,
  });

  return { appointment: hydrateAppointment(appointment), consultation: hydrateConsultation(consultation) };
}

/**
 * Complete a consultation. Records clinical data, issues prescriptions and lab
 * orders if requested, moves appointment to Completed and queue to Completed.
 */
async function completeConsultation(appointmentId, body, actor) {
  const appointment = await Appointment.findById(appointmentId).populate('patientId doctorId');
  if (!appointment) throw ApiError.notFound('Appointment not found');

  if (actor.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: actor.userId });
    if (!doctor || String(appointment.doctorId._id) !== String(doctor._id)) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: actor.role,
        userId: actor.userId,
        resourceType: 'CONSULTATION',
        resourceId: appointmentId,
        result: 'DENIED',
        detail: 'Doctor attempted to complete consultation on unassigned appointment',
      });
      throw ApiError.forbidden('Access denied');
    }
  } else if (actor.role !== 'ADMIN') {
    throw ApiError.forbidden('Access denied');
  }

  if (appointment.status !== 'InConsultation') {
    throw ApiError.conflict('Consultation must be in progress to complete it');
  }

  const doctorDoc = await Doctor.findById(appointment.doctorId);
  const departmentCode = departmentCodeFor(doctorDoc, appointment);
  const existing = await Consultation.findOne({ appointmentId: appointment._id });

  if (!existing) throw ApiError.notFound('Consultation record not found');

  existing.status = 'Completed';
  existing.diagnosis = body.diagnosis || existing.diagnosis || '';
  existing.symptoms = body.symptoms || existing.symptoms;
  existing.observations = body.observations || existing.observations;
  existing.notes = body.notes || existing.notes;
  existing.vitals = body.vitals || existing.vitals || {};
  existing.followUpDate = body.followUpDate || existing.followUpDate || '';
  existing.recommendedTests = body.recommendedTests || existing.recommendedTests || '';
  existing.referral = body.referral || existing.referral || '';
  existing.completedBy = actor.userId;
  existing.completedAt = new Date();
  await existing.save();

  const createdPrescriptions = [];
  if (body.prescriptions && Array.isArray(body.prescriptions) && body.prescriptions.length > 0) {
    for (const p of body.prescriptions) {
      const rx = await createPrescription({
        consultationId: existing._id,
        appointmentId: appointment._id,
        patientId: appointment.patientId._id,
        doctorId: appointment.doctorId._id,
        departmentCode,
        items: p.items,
        notes: p.notes || '',
        issuedBy: actor.userId,
      });
      createdPrescriptions.push(hydratePrescription(rx));
      existing.prescriptionIds.push(rx._id.toString());
    }
    await existing.save();
  }

  const createdLabOrders = [];
  if (body.labOrders && Array.isArray(body.labOrders) && body.labOrders.length > 0) {
    for (const l of body.labOrders) {
      const order = await createLabOrder({
        consultationId: existing._id,
        appointmentId: appointment._id,
        patientId: appointment.patientId._id,
        doctorId: appointment.doctorId._id,
        departmentCode,
        tests: l.tests,
        notes: l.notes || '',
        orderedBy: actor.userId,
      });
      createdLabOrders.push(hydrateLabOrder(order));
      existing.labOrderIds.push(order._id.toString());
    }
    await existing.save();
  }

  appointment.status = 'Completed';
  await appointment.save();

  const queue = await Queue.findOne({ appointmentId: appointment._id });
  if (queue) {
    queue.queue.status = 'Completed';
    queue.completedAt = new Date();
    await queue.save();
  }

  if (body.recordId) {
    appointment.recordId = body.recordId;
    await appointment.save();
  }

  auditAsync({
    action: 'COMPLETE_CONSULTATION',
    role: actor.role,
    userId: actor.userId,
    resourceType: 'CONSULTATION',
    resourceId: existing._id.toString(),
    result: 'SUCCESS',
    ipAddress: actor.ipAddress,
    detail: `Consultation completed; ${createdPrescriptions.length} prescription(s), ${createdLabOrders.length} lab order(s)`,
  });

  await Notification.create({
    patientId: appointment.patientId._id,
    type: 'consultation_completed',
    title: 'Consultation completed',
    message: 'Your consultation has been completed. You can now view your prescription and any lab orders from your records.',
    consultationId: existing._id,
    read: false,
  });

  return {
    appointment: hydrateAppointment(appointment),
    consultation: hydrateConsultation(existing),
    prescriptions: createdPrescriptions,
    labOrders: createdLabOrders,
  };
}

// ---------------------------------------------------------------------------
// Prescription / Lab creation helpers
// ---------------------------------------------------------------------------

let consultCounter = 0;
async function nextConsultationId() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  consultCounter += 1;
  return `CON-${ymd}-${String(consultCounter).padStart(4, '0')}`;
}

async function createPrescription({ consultationId, appointmentId, patientId, doctorId, departmentCode, items, notes, issuedBy }) {
  const rxId = await nextPrescriptionId();
  const rx = await Prescription.create({
    prescriptionId: rxId,
    consultationId,
    appointmentId,
    patientId,
    doctorId,
    departmentCode,
    status: 'Issued',
    items,
    notes,
    issuedBy,
  });
  auditAsync({
    action: 'CREATE_PRESCRIPTION',
    role: 'DOCTOR',
    userId: issuedBy,
    resourceType: 'PRESCRIPTION',
    resourceId: rx._id.toString(),
    result: 'SUCCESS',
    ipAddress: '',
    detail: `RX ${rxId} issued`,
  });
  return rx;
}

async function nextPrescriptionId() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const last = await Prescription.findOne({}).sort({ createdAt: -1 }).lean();
  let n = 1;
  if (last && last.prescriptionId) {
    const m = String(last.prescriptionId).match(/^RX-(\\d{8})-(\\d+)$/);
    if (m) n = parseInt(m[2], 10) + 1;
  }
  return `RX-${ymd}-${String(n).padStart(4, '0')}`;
}

async function createLabOrder({ consultationId, appointmentId, patientId, doctorId, departmentCode, tests, notes, orderedBy }) {
  const orderId = await nextLabOrderId();
  const order = await LabOrder.create({
    orderId,
    consultationId,
    appointmentId,
    patientId,
    doctorId,
    departmentCode,
    status: 'Ordered',
    tests,
    notes,
    orderedBy,
  });
  auditAsync({
    action: 'ORDER_LAB_TEST',
    role: 'DOCTOR',
    userId: orderedBy,
    resourceType: 'LAB_ORDER',
    resourceId: order._id.toString(),
    result: 'SUCCESS',
    ipAddress: '',
    detail: `Lab order ${orderId} placed`,
  });
  return order;
}

async function nextLabOrderId() {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const last = await LabOrder.findOne({}).sort({ createdAt: -1 }).lean();
  let n = 1;
  if (last && last.orderId) {
    const m = String(last.orderId).match(/^LAB-(\\d{8})-(\\d+)$/);
    if (m) n = parseInt(m[2], 10) + 1;
  }
  return `LAB-${ymd}-${String(n).padStart(4, '0')}`;
}

// ---------------------------------------------------------------------------
// Patient history
// ---------------------------------------------------------------------------

/**
 * Aggregate a patient's medical history: consultations, prescriptions, lab
 * orders, medical records, in chronological order.
 */
async function patientHistory(patientId, opts = {}) {
  const { page = 1, limit = 50 } = opts;
  const skip = (page - 1) * limit;

  const [consultations, prescriptions, labOrders, medicalRecords] = await Promise.all([
    Consultation.find({ patientId }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('doctorId', 'doctorId specialization department userId').populate('createdBy', 'name').lean(),
    Prescription.find({ patientId }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('doctorId', 'doctorId specialization department userId').populate('issuedBy', 'name').lean(),
    LabOrder.find({ patientId }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('doctorId', 'doctorId specialization department userId').populate('orderedBy', 'name').lean(),
    MedicalRecord.find({ patientId }).sort({ date: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const events = [];
  for (const c of consultations) {
    events.push({
      type: 'consultation',
      id: c._id.toString(),
      consultationId: c.consultationId,
      date: c.createdAt ? new Date(c.createdAt).toISOString() : null,
      department: c.departmentCode,
      status: c.status,
      diagnosis: c.diagnosis || '',
      notes: c.notes || '',
      chiefComplaint: c.chiefComplaint || '',
      doctor: c.doctorId ? { doctorId: c.doctorId.doctorId, name: (c.doctorId.userId && c.doctorId.userId.name) || '' } : null,
    });
  }
  for (const rx of prescriptions) {
    events.push({
      type: 'prescription',
      id: rx._id.toString(),
      prescriptionId: rx.prescriptionId,
      date: rx.createdAt ? new Date(rx.createdAt).toISOString() : null,
      status: rx.status,
      items: rx.items,
      notes: rx.notes || '',
      doctor: rx.doctorId ? { doctorId: rx.doctorId.doctorId, name: (rx.doctorId.userId && rx.doctorId.userId.name) || '' } : null,
    });
  }
  for (const o of labOrders) {
    events.push({
      type: 'lab_order',
      id: o._id.toString(),
      orderId: o.orderId,
      date: o.createdAt ? new Date(o.createdAt).toISOString() : null,
      status: o.status,
      tests: o.tests,
      notes: o.notes || '',
      result: o.result || null,
      doctor: o.doctorId ? { doctorId: o.doctorId.doctorId, name: (o.doctorId.userId && o.doctorId.userId.name) || '' } : null,
    });
  }
  for (const r of medicalRecords) {
    events.push({
      type: 'medical_record',
      id: r._id.toString(),
      recordId: r.recordId,
      date: r.date,
      category: r.category,
      diagnosis: r.diagnosis || '',
      prescription: r.prescription || '',
      notes: r.notes || '',
    });
  }

  events.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });

  const total = await Promise.all([
    Consultation.countDocuments({ patientId }),
    Prescription.countDocuments({ patientId }),
    LabOrder.countDocuments({ patientId }),
    MedicalRecord.countDocuments({ patientId }),
  ]).then(([c, p, l, m]) => c + p + l + m);

  return {
    patientId,
    events,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

// ---------------------------------------------------------------------------
// Authorization helpers for consultation / prescription / lab order reads
// ---------------------------------------------------------------------------

async function getConsultationWithAuth(consultationIdOrAppointmentId, user) {
  let consultation;
  if (/^CON-\\d{8}-\\d+$/.test(consultationIdOrAppointmentId)) {
    consultation = await Consultation.findOne({ consultationId: consultationIdOrAppointmentId }).populate('patientId doctorId appointmentId');
  } else if (mongoose.isValidObjectId(consultationIdOrAppointmentId)) {
    consultation = await Consultation.findOne({ appointmentId: consultationIdOrAppointmentId }).populate('patientId doctorId appointmentId');
  } else {
    throw ApiError.badRequest('Invalid consultation identifier');
  }

  if (!consultation) throw ApiError.notFound('Consultation not found');

  if (user.role === 'PATIENT') {
    const patient = await Patient.findOne({ userId: user.id });
    if (!patient || String(consultation.patientId._id) !== String(patient._id)) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: user.role,
        userId: user.id,
        resourceType: 'CONSULTATION',
        resourceId: consultation._id.toString(),
        result: 'DENIED',
        detail: 'Patient attempted to access another patient consultation',
      });
      throw ApiError.forbidden('Access denied');
    }
  } else if (user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: user.id });
    if (!doctor || String(consultation.doctorId._id) !== String(doctor._id)) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: user.role,
        userId: user.id,
        resourceType: 'CONSULTATION',
        resourceId: consultation._id.toString(),
        result: 'DENIED',
        detail: 'Doctor attempted to view another doctor consultation',
      });
      throw ApiError.forbidden('Access denied');
    }
  }
  return consultation;
}

async function getPrescriptionWithAuth(prescriptionId, user) {
  const rx = await Prescription.findOne({ prescriptionId }).populate('patientId doctorId consultationId');
  if (!rx) throw ApiError.notFound('Prescription not found');

  if (user.role === 'PATIENT') {
    const patient = await Patient.findOne({ userId: user.id });
    if (!patient || String(rx.patientId._id) !== String(patient._id)) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: user.role,
        userId: user.id,
        resourceType: 'PRESCRIPTION',
        resourceId: rx._id.toString(),
        result: 'DENIED',
        detail: 'Patient attempted to access another patient prescription',
      });
      throw ApiError.forbidden('Access denied');
    }
  } else if (user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: user.id });
    if (!doctor || String(rx.doctorId._id) !== String(doctor._id)) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: user.role,
        userId: user.id,
        resourceType: 'PRESCRIPTION',
        resourceId: rx._id.toString(),
        result: 'DENIED',
        detail: 'Doctor attempted to view another doctor prescription',
      });
      throw ApiError.forbidden('Access denied');
    }
  }
  return rx;
}

async function getLabOrderWithAuth(orderId, user) {
  const order = await LabOrder.findOne({ orderId }).populate('patientId doctorId consultationId');
  if (!order) throw ApiError.notFound('Lab order not found');

  if (user.role === 'PATIENT') {
    const patient = await Patient.findOne({ userId: user.id });
    if (!patient || String(order.patientId._id) !== String(patient._id)) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: user.role,
        userId: user.id,
        resourceType: 'LAB_ORDER',
        resourceId: order._id.toString(),
        result: 'DENIED',
        detail: 'Patient attempted to access another patient lab order',
      });
      throw ApiError.forbidden('Access denied');
    }
  } else if (user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: user.id });
    if (!doctor || String(order.doctorId._id) !== String(doctor._id)) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: user.role,
        userId: user.id,
        resourceType: 'LAB_ORDER',
        resourceId: order._id.toString(),
        result: 'DENIED',
        detail: 'Doctor attempted to view another doctor lab order',
      });
      throw ApiError.forbidden('Access denied');
    }
  }
  return order;
}

// ---------------------------------------------------------------------------
// Hydrators (API shapes)
// ---------------------------------------------------------------------------

function hydrateAppointment(a) {
  const src = a.toObject ? a.toObject() : a;
  const d = src.doctorId || {};
  const p = src.patientId || {};
  const du = d.userId || {};
  const pu = p.userId || {};
  return {
    id: src._id.toString(),
    appointmentId: src._id.toString(),
    patientId: p.patientId,
    doctorId: d.doctorId,
    departmentCode: src.departmentCode || '',
    date: src.date,
    time: src.time,
    reason: src.reason,
    status: src.status,
    token: src.token || '',
    queueId: src.queueId ? src.queueId.toString() : null,
    consultationId: src.consultationId ? src.consultationId.toString() : null,
    cancelledBy: src.cancelledBy || null,
    recordId: src.recordId ? src.recordId.toString() : null,
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
    patient: { id: p._id ? p._id.toString() : null, patientId: p.patientId, name: pu.name || '' },
    doctor: { id: d._id ? d._id.toString() : null, doctorId: d.doctorId, name: du.name || '', specialization: d.specialization, department: d.department },
  };
}

function hydrateConsultation(c) {
  const src = c.toObject ? c.toObject() : c;
  const d = src.doctorId || {};
  const p = src.patientId || {};
  const du = d.userId || {};
  const pu = p.userId || {};
  return {
    id: src._id.toString(),
    consultationId: src.consultationId,
    appointmentId: src.appointmentId ? src.appointmentId.toString() : null,
    patientId: p.patientId,
    patient: { patientId: p.patientId, name: pu.name || '' },
    doctorId: d.doctorId,
    doctor: { doctorId: d.doctorId, name: du.name || '', specialization: d.specialization, department: d.department },
    departmentCode: src.departmentCode,
    status: src.status,
    chiefComplaint: src.chiefComplaint || '',
    symptoms: src.symptoms || '',
    observations: src.observations || '',
    diagnosis: src.diagnosis || '',
    vitals: src.vitals || {},
    notes: src.notes || '',
    prescriptionIds: src.prescriptionIds || [],
    labOrderIds: src.labOrderIds || [],
    followUpDate: src.followUpDate || '',
    recommendedTests: src.recommendedTests || '',
    referral: src.referral || '',
    createdBy: src.createdBy ? src.createdBy.toString() : null,
    completedBy: src.completedBy ? src.completedBy.toString() : null,
    startedAt: src.startedAt,
    completedAt: src.completedAt,
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
  };
}

function hydratePrescription(rx) {
  const src = rx.toObject ? rx.toObject() : rx;
  const d = src.doctorId || {};
  const p = src.patientId || {};
  const du = d.userId || {};
  const pu = p.userId || {};
  return {
    id: src._id.toString(),
    prescriptionId: src.prescriptionId,
    consultationId: src.consultationId ? src.consultationId.toString() : null,
    appointmentId: src.appointmentId ? src.appointmentId.toString() : null,
    patientId: p.patientId,
    patient: { patientId: p.patientId, name: pu.name || '' },
    doctorId: d.doctorId,
    doctor: { doctorId: d.doctorId, name: du.name || '' },
    departmentCode: src.departmentCode,
    status: src.status,
    items: src.items || [],
    notes: src.notes || '',
    issuedBy: src.issuedBy ? src.issuedBy.toString() : null,
    dispensedAt: src.dispensedAt,
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
  };
}

function hydrateLabOrder(o) {
  const src = o.toObject ? o.toObject() : o;
  const d = src.doctorId || {};
  const p = src.patientId || {};
  const du = d.userId || {};
  const pu = p.userId || {};
  return {
    id: src._id.toString(),
    orderId: src.orderId,
    consultationId: src.consultationId ? src.consultationId.toString() : null,
    appointmentId: src.appointmentId ? src.appointmentId.toString() : null,
    patientId: p.patientId,
    patient: { patientId: p.patientId, name: pu.name || '' },
    doctorId: d.doctorId,
    doctor: { doctorId: d.doctorId, name: du.name || '' },
    departmentCode: src.departmentCode,
    status: src.status,
    tests: src.tests || [],
    notes: src.notes || '',
    result: src.result || null,
    orderedBy: src.orderedBy ? src.orderedBy.toString() : null,
    completedAt: src.completedAt,
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
  };
}

module.exports = {
  createQueueForAppointment,
  departmentQueue,
  advanceDepartmentQueue,
  startConsultation,
  completeConsultation,
  patientHistory,
  getConsultationWithAuth,
  getPrescriptionWithAuth,
  getLabOrderWithAuth,
  hydrateAppointment,
  hydrateConsultation,
  hydratePrescription,
  hydrateLabOrder,
  createPrescription,
  createLabOrder,
  lookupDepartmentName,
  nextTokenCode,
};
