const { wrapAll } = require('../utils/asyncHandler');
/**
 * Appointment controller. Authorization:
 * - POST   /api/appointments        -> PATIENT or ADMIN
 * - GET    /api/appointments        -> role-scoped list
 * - GET    /api/appointments/:id    -> owner / assigned doctor / admin
 * - PUT    /api/appointments/:id    -> status transitions (role-checked)
 * - DELETE /api/appointments/:id    -> cancel (owner patient or admin)
 */
const appointmentService = require('../services/appointment.service');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const { ApiError } = require('../utils/ApiError');
const { getPagination } = require('../utils/query');

/** POST /api/appointments */
async function book(req, res) {
  if (!['PATIENT', 'ADMIN'].includes(req.user.role)) {
    throw ApiError.forbidden('Only patients can book appointments');
  }

  const { doctorId, date, time, reason } = req.body;

  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw ApiError.notFound('Doctor not found');
  const doctorUser = await require('../models/User').findById(doctor.userId);
  if (!doctorUser || doctorUser.status !== 'ACTIVE') {
    throw ApiError.conflict('This doctor is not currently available');
  }

  // Resolve acting patient: the patient themself, or admin booking on behalf.
  let patient;
  if (req.user.role === 'PATIENT') {
    patient = await Patient.findOne({ userId: req.user.id });
    if (!patient) throw ApiError.notFound('Patient profile not found');
  } else {
    patient = await Patient.findById(req.body.patientId);
    if (!patient) throw ApiError.badRequest('patientId is required when booking as admin');
  }

  const appointment = await appointmentService.bookAppointment({
    patient,
    doctor,
    date,
    time,
    reason,
    actor: { role: req.user.role, userId: req.user.id, ipAddress: req.ip },
  });

  res.status(201).json({
    success: true,
    message: 'Appointment booked',
    appointment: appointmentService.hydrateAppointment(appointment),
  });
}

/** GET /api/appointments */
async function list(req, res) {
  const { page, limit } = getPagination(req.query);
  const result = await appointmentService.listAppointments(req.user, { ...req.query, page, limit });
  res.json({ success: true, ...result });
}

/** GET /api/appointments/:id */
async function getOne(req, res) {
  const appt = await appointmentService.getAuthorizedAppointment(req.params.id, req.user);
  res.json({ success: true, appointment: appointmentService.hydrateAppointment(appt) });
}

/** PUT /api/appointments/:id — status change or reschedule by role. */
async function update(req, res) {
  const appt = await appointmentService.getAuthorizedAppointment(req.params.id, req.user);

  if (req.body.date && req.body.time) {
    // Reschedule: patient owner or admin.
    if (!['PATIENT', 'ADMIN'].includes(req.user.role)) {
      throw ApiError.forbidden('Only the patient or an admin can reschedule');
    }
    const updated = await appointmentService.reschedule(
      appt,
      { date: req.body.date, time: req.body.time },
      { role: req.user.role, userId: req.user.id, ipAddress: req.ip }
    );
    return res.json({ success: true, message: 'Appointment rescheduled', appointment: appointmentService.hydrateAppointment(updated) });
  }

  if (req.body.status) {
    const next = req.body.status;
    // Role rules for transitions.
    if (req.user.role === 'PATIENT') {
      if (!['Cancelled'].includes(next)) {
        throw ApiError.forbidden('Patients can only cancel their appointments');
      }
    } else if (req.user.role === 'DOCTOR') {
      if (!['Confirmed', 'Completed', 'Cancelled'].includes(next)) {
        throw ApiError.forbidden('Doctors can confirm, complete, or cancel assigned appointments');
      }
    } // ADMIN: any permitted transition by lifecycle rules.

    const updated = await appointmentService.changeStatus(
      appt,
      next,
      { role: req.user.role, userId: req.user.id, ipAddress: req.ip },
      req.body.note
    );
    return res.json({ success: true, message: `Appointment ${next.toLowerCase()}`, appointment: appointmentService.hydrateAppointment(updated) });
  }

  throw ApiError.badRequest('Provide status or date/time to update');
}

/** DELETE /api/appointments/:id — soft cancel. */
async function cancel(req, res) {
  const appt = await appointmentService.getAuthorizedAppointment(req.params.id, req.user);
  if (!['PATIENT', 'ADMIN'].includes(req.user.role)) {
    throw ApiError.forbidden('Only the patient or an admin can cancel');
  }
  const updated = await appointmentService.changeStatus(
    appt,
    'Cancelled',
    { role: req.user.role, userId: req.user.id, ipAddress: req.ip }
  );
  res.json({ success: true, message: 'Appointment cancelled', appointment: appointmentService.hydrateAppointment(updated) });
}

module.exports = { book, list, getOne, update, cancel };

wrapAll(module.exports);
