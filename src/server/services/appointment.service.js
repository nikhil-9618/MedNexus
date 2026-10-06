/**
 * Appointment service — booking, conflict detection, transitions,
 * rescheduling and scoped listing. All authorization is enforced here
 * and in middleware; controllers only orchestrate.
 */
const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const User = require('../models/User');
const { ApiError } = require('../utils/ApiError');
const { auditAsync } = require('./audit.service');
const workflowService = require('./workflow.service');
const { DOCTOR_SLOTS, APPOINTMENT_TRANSITIONS, WEEKDAYS } = require('../config/constants');

const LIVE_STATUSES = ['Scheduled', 'Confirmed'];

/** Turn a Doctor doc + its User into the public API shape. */
function doctorPublic(doctorDoc, userDoc) {
  const availability = {};
  const av = doctorDoc.availability;
  if (av) {
    if (typeof av.entries === 'function') {
      for (const [k, v] of av.entries()) availability[k] = v;
    } else {
      Object.assign(availability, av);
    }
  }
  return {
    id: doctorDoc._id.toString(),
    doctorId: doctorDoc.doctorId,
    name: userDoc ? userDoc.name : '',
    email: userDoc ? userDoc.email : '',
    specialization: doctorDoc.specialization,
    department: doctorDoc.department,
    experience: doctorDoc.experience,
    qualification: doctorDoc.qualification,
    bio: doctorDoc.bio,
    rating: doctorDoc.rating,
    reviewsCount: doctorDoc.reviewsCount,
    consultationFee: doctorDoc.consultationFee,
    clinicInformation: doctorDoc.clinicInformation,
    availability,
    isAcceptingNew: doctorDoc.isAcceptingNew,
    accountStatus: userDoc ? userDoc.status : 'ACTIVE',
  };
}

/**
 * Doctor directory with search/filter/pagination.
 * availableToday=true keeps only doctors with slots on today's weekday.
 */
async function listDoctors({ q, specialization, department, availableToday, page, limit }) {
  const skip = (page - 1) * limit;

  const userFilter = { role: 'DOCTOR', status: 'ACTIVE' };
  if (q) userFilter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };

  const doctorFilter = {};
  if (specialization) doctorFilter.specialization = { $regex: `^${escapeRe(specialization)}$`, $options: 'i' };
  if (department) doctorFilter.department = { $regex: `^${escapeRe(department)}$`, $options: 'i' };
  if (availableToday === true) {
    const weekday = WEEKDAYS[new Date().getUTCDay()];
    doctorFilter[`availability.${weekday}.0`] = { $exists: true };
  }

  // Doctor docs keyed by their User for name/status filtering.
  const doctorDocs = await Doctor.find(doctorFilter).lean();
  const byUserId = new Map(doctorDocs.map((d) => [String(d.userId), d]));
  const userIds = [...byUserId.keys()];

  const userQuery = { ...userFilter, _id: { $in: userIds } };
  const [users, total] = await Promise.all([
    User.find(userQuery).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(userQuery),
  ]);

  const items = users.map((u) => doctorPublic(byUserId.get(String(u._id)), u));
  return { items, total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

function escapeRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Load one doctor (public profile) by Doctor _id or doctorId code. */
async function getDoctorById(idOrCode) {
  let doctorDoc;
  if (mongoose.isValidObjectId(idOrCode)) {
    doctorDoc = await Doctor.findById(idOrCode);
  } else if (/^D\d{3,6}$/.test(String(idOrCode))) {
    doctorDoc = await Doctor.findOne({ doctorId: idOrCode });
  }
  if (!doctorDoc) return null;
  const userDoc = await User.findOne({ _id: doctorDoc.userId, status: 'ACTIVE' }).lean();
  if (!userDoc) return null; // deactivated doctors are hidden from the directory
  return doctorPublic(doctorDoc, userDoc);
}

/**
 * Availability for a doctor on a specific date.
 * Returns every clinic slot with booked/free status.
 */
async function getAvailability(doctorDoc, dateISO) {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const weekday = WEEKDAYS[d.getUTCDay()];
  let slots = [];
  if (doctorDoc.availability) {
    const av = doctorDoc.availability;
    slots = typeof av.get === 'function' ? (av.get(weekday) || []) : (av[weekday] || []);
  }

  const booked = await Appointment.find(
    { doctorId: doctorDoc._id, date: dateISO, status: { $in: LIVE_STATUSES } },
    { time: 1, _id: 0 }
  ).lean();
  const bookedSet = new Set(booked.map((b) => b.time));

  return {
    date: dateISO,
    weekday,
    workingDay: slots.length > 0,
    slots: DOCTOR_SLOTS.filter((t) => slots.includes(t)).map((t) => ({
      time: t,
      available: !bookedSet.has(t),
    })),
  };
}

/** Verify slot is bookable right now; throws 409 on conflict. */
async function assertSlotFree({ doctor, date, time }) {
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const av = doctor.availability;
  const allowed = av
    ? (typeof av.get === 'function' ? (av.get(weekday) || []) : (av[weekday] || []))
    : [];

  if (!allowed.includes(time)) {
    throw ApiError.conflict('Doctor is not available at the selected slot');
  }

  const clash = await Appointment.exists({
    doctorId: doctor._id,
    date,
    time,
    status: { $in: LIVE_STATUSES },
  });
  if (clash) throw ApiError.conflict('This slot was just booked. Please pick another time.');
}

/**
 * Book an appointment. Runs slot verification immediately before insert
 * and relies on the partial unique index as the final guard.
 */
async function bookAppointment({ patient, doctor, date, time, reason, actor }) {
  if (!doctor.isAcceptingNew) {
    throw ApiError.conflict('This doctor is not accepting new appointments');
  }

  await assertSlotFree({ doctor, date, time });

  let appointment;
  try {
    appointment = await Appointment.create({
      patientId: patient._id,
      doctorId: doctor._id,
      date,
      time,
      reason,
      status: 'Scheduled',
    });
  } catch (err) {
    if (err && err.code === 11000) {
      throw ApiError.conflict('This slot was just booked. Please pick another time.');
    }
    throw err;
  }

  // Issue the department token + queue entry. Every live appointment must have
  // exactly one queue entry, so roll the appointment back if this fails.
  try {
    await workflowService.createQueueForAppointment({ appointment, doctor, patient, actor });
  } catch (err) {
    await Appointment.deleteOne({ _id: appointment._id }).catch(() => {});
    throw err;
  }

  auditAsync({
    action: 'BOOK_APPOINTMENT',
    role: actor.role,
    userId: actor.userId,
    resourceType: 'APPOINTMENT',
    resourceId: appointment._id.toString(),
    result: 'SUCCESS',
    ipAddress: actor.ipAddress,
    detail: `Dr ${doctorPublic(doctor).name || 'doctor'} on ${date} ${time}`,
  });

  return appointment;
}

/** Load appointment with role-based authorization. Audits denials. */
async function getAuthorizedAppointment(appointmentId, user) {
  if (!mongoose.isValidObjectId(appointmentId)) throw ApiError.badRequest('Invalid appointment id');
  const appt = await Appointment.findById(appointmentId).populate('doctorId patientId');
  if (!appt) throw ApiError.notFound('Appointment not found');

  if (user.role === 'PATIENT') {
    const patient = await Patient.findOne({ userId: user.id });
    if (!patient || appt.patientId._id.toString() !== patient._id.toString()) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: user.role,
        userId: user.id,
        resourceType: 'APPOINTMENT',
        resourceId: appointmentId,
        result: 'DENIED',
        detail: 'Patient attempted to access foreign appointment',
      });
      throw ApiError.forbidden('Access denied');
    }
  } else if (user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: user.id });
    if (!doctor || appt.doctorId._id.toString() !== doctor._id.toString()) {
      auditAsync({
        action: 'SECURITY_EVENT',
        role: user.role,
        userId: user.id,
        resourceType: 'APPOINTMENT',
        resourceId: appointmentId,
        result: 'DENIED',
        detail: 'Doctor attempted to access unassigned appointment',
      });
      throw ApiError.forbidden('Access denied');
    }
  }
  // ADMIN may view all appointments.
  return appt;
}

/** Apply a status change with transition validation. */
async function changeStatus(appointment, nextStatus, actor, note) {
  const allowed = APPOINTMENT_TRANSITIONS[appointment.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw ApiError.conflict(`Cannot move appointment from ${appointment.status} to ${nextStatus}`);
  }

  appointment.status = nextStatus;
  if (nextStatus === 'Cancelled') {
    appointment.cancelledBy = { role: actor.role, userId: actor.userId };
  }
  await appointment.save();

  const actionMap = {
    Cancelled: 'CANCEL_APPOINTMENT',
    Confirmed: 'UPDATE_APPOINTMENT',
    Completed: 'UPDATE_APPOINTMENT',
    Scheduled: 'UPDATE_APPOINTMENT',
  };
  auditAsync({
    action: actionMap[nextStatus] || 'UPDATE_APPOINTMENT',
    role: actor.role,
    userId: actor.userId,
    resourceType: 'APPOINTMENT',
    resourceId: appointment._id.toString(),
    result: 'SUCCESS',
    ipAddress: actor.ipAddress,
    detail: `${appointment.status} -> ${nextStatus}`,
  });
  return appointment;
}

/** Reschedule with conflict check. */
async function reschedule(appointment, { date, time }, actor) {
  if (appointment.status === 'Cancelled' || appointment.status === 'Completed') {
    throw ApiError.conflict(`Cannot reschedule a ${appointment.status.toLowerCase()} appointment`);
  }

  const doctor = await Doctor.findById(appointment.doctorId);
  if (!doctor) throw ApiError.notFound('Doctor not found');
  await assertSlotFree({ doctor, date, time });

  appointment.date = date;
  appointment.time = time;
  await appointment.save();

  auditAsync({
    action: 'RESCHEDULE_APPOINTMENT',
    role: actor.role,
    userId: actor.userId,
    resourceType: 'APPOINTMENT',
    resourceId: appointment._id.toString(),
    result: 'SUCCESS',
    ipAddress: actor.ipAddress,
    detail: `Moved to ${date} ${time}`,
  });
  return appointment;
}

/** Role-scoped appointment listing. */
async function listAppointments(user, { page, limit, status, date, from, to, doctorId, patientId, q }) {
  const filter = {};
  if (user.role === 'PATIENT') {
    const patient = await Patient.findOne({ userId: user.id });
    if (!patient) return { items: [], total: 0, page, limit, pages: 1 };
    filter.patientId = patient._id;
  } else if (user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: user.id });
    if (!doctor) return { items: [], total: 0, page, limit, pages: 1 };
    filter.doctorId = doctor._id;
  } else if (user.role === 'ADMIN') {
    if (doctorId && mongoose.isValidObjectId(doctorId)) filter.doctorId = doctorId;
    if (patientId && mongoose.isValidObjectId(patientId)) filter.patientId = patientId;
  }

  if (status) filter.status = status;
  if (date) filter.date = date;
  else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  if (q) filter.reason = { $regex: escapeRe(q), $options: 'i' };

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ date: -1, time: -1 })
      .skip(skip)
      .limit(limit)
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

  return {
    items: items.map(hydrateAppointment),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

/** Flatten an appointment (lean or doc) into API shape. */
function hydrateAppointment(a) {
  const src = a.toObject ? a.toObject({ depopulate: false }) : a;
  const doctor = src.doctorId || {};
  const patient = src.patientId || {};
  const doctorUser = doctor.userId || {};
  const patientUser = patient.userId || {};
  return {
    id: (src._id || src.id).toString(),
    appointmentId: (src._id || src.id).toString(),
    date: src.date,
    time: src.time,
    reason: src.reason,
    status: src.status,
    // Department token issued at booking time (queue linkage).
    token: src.token || null,
    departmentCode: src.departmentCode || null,
    queueId: src.queueId ? src.queueId.toString() : null,
    consultationId: src.consultationId ? src.consultationId.toString() : null,
    createdAt: src.createdAt,
    updatedAt: src.updatedAt,
    doctor: {
      id: doctor._id ? doctor._id.toString() : undefined,
      doctorId: doctor.doctorId,
      name: doctorUser.name,
      specialization: doctor.specialization,
      department: doctor.department,
    },
    patient: {
      id: patient._id ? patient._id.toString() : undefined,
      patientId: patient.patientId,
      name: patientUser.name,
    },
  };
}

/** Dashboard summary for the logged-in patient or doctor. */
async function summaryFor(user) {
  const today = new Date().toISOString().slice(0, 10);
  const base = {};
  if (user.role === 'PATIENT') {
    const patient = await Patient.findOne({ userId: user.id });
    if (!patient) return null;
    base.patientId = patient._id;
  } else if (user.role === 'DOCTOR') {
    const doctor = await Doctor.findOne({ userId: user.id });
    if (!doctor) return null;
    base.doctorId = doctor._id;
  }

  const next = await Appointment.findOne({ ...base, date: { $gte: today }, status: { $in: LIVE_STATUSES } })
    .sort({ date: 1, time: 1 })
    .populate({
      path: 'doctorId',
      select: 'doctorId specialization department userId',
      populate: { path: 'userId', select: 'name' },
    })
    .populate({
      path: 'patientId',
      select: 'patientId userId',
      populate: { path: 'userId', select: 'name' },
    });

  const [upcomingCount, completedCount, cancelledCount, todayCount] = await Promise.all([
    Appointment.countDocuments({ ...base, date: { $gte: today }, status: { $in: LIVE_STATUSES } }),
    Appointment.countDocuments({ ...base, status: 'Completed' }),
    Appointment.countDocuments({ ...base, status: 'Cancelled' }),
    Appointment.countDocuments({ ...base, date: today }),
  ]);

  return {
    nextAppointment: next ? hydrateAppointment(next) : null,
    upcomingCount,
    completedCount,
    cancelledCount,
    todayCount,
  };
}

module.exports = {
  doctorPublic,
  listDoctors,
  getDoctorById,
  getAvailability,
  bookAppointment,
  getAuthorizedAppointment,
  changeStatus,
  reschedule,
  listAppointments,
  hydrateAppointment,
  summaryFor,
  assertSlotFree,
  LIVE_STATUSES,
};
