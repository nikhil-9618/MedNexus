const { wrapAll } = require('../utils/asyncHandler');
/**
 * Doctor controller — directory, profile, availability (public),
 * plus doctor-scoped appointment/record views.
 */
const appointmentService = require('../services/appointment.service');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const { ApiError } = require('../utils/ApiError');
const { getPagination } = require('../utils/query');
const { appointmentQuerySchema } = require('../validators/appointment.validator');

/** GET /api/doctors — public directory with filters. */
async function listDoctors(req, res) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
  const { q, specialization, department } = req.query;
  const availableToday = req.query.availableToday === 'true';

  const result = await appointmentService.listDoctors({
    q,
    specialization,
    department,
    availableToday,
    page,
    limit,
  });
  res.json({ success: true, ...result });
}

/** GET /api/doctors/:id — public profile. */
async function getDoctor(req, res) {
  const doctor = await appointmentService.getDoctorById(req.params.id);
  if (!doctor) throw ApiError.notFound('Doctor not found');
  res.json({ success: true, doctor });
}

/** GET /api/doctors/:id/availability?date=YYYY-MM-DD */
async function getAvailability(req, res) {
  const doctor = await appointmentService.getDoctorById(req.params.id);
  if (!doctor) throw ApiError.notFound('Doctor not found');

  const date = req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  const doctorDoc = await Doctor.findById(doctor.id);
  const availability = await appointmentService.getAvailability(doctorDoc, date);
  res.json({ success: true, ...availability });
}

/** GET /api/doctors/me/appointments — doctor's own appointments. */
async function getMyAppointments(req, res) {
  const parsed = appointmentQuerySchema.safeParse(req.query);
  if (!parsed.success) throw ApiError.badRequest('Invalid query parameters');
  const { page, limit } = getPagination(req.query);
  const result = await appointmentService.listAppointments(req.user, {
    ...req.query,
    page,
    limit,
  });
  res.json({ success: true, ...result });
}

/** GET /api/doctors/me/patients — patients assigned to this doctor. */
async function getMyPatients(req, res) {
  const doctor = await Doctor.findOne({ userId: req.user.id });
  if (!doctor) throw ApiError.forbidden('Doctor profile not found');

  const { page, limit, skip } = getPagination(req.query);
  const q = (req.query.q || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const appts = await Appointment.find({ doctorId: doctor._id }).select('patientId').lean();
  const patientIds = [...new Set(appts.map((a) => String(a.patientId)))];

  const filter = { _id: { $in: patientIds } };
  const base = await Patient.find(filter)
    .populate({ path: 'userId', select: 'name email status', match: q ? { name: { $regex: q, $options: 'i' } } : {} })
    .lean();

  let items = base.filter((p) => p.userId);
  const total = items.length;
  items = items.slice(skip, skip + limit);

  const detailed = await Promise.all(items.map(async (p) => {
    const [appointments, lastVisit] = await Promise.all([
      Appointment.countDocuments({ doctorId: doctor._id, patientId: p._id }),
      Appointment.findOne({ doctorId: doctor._id, patientId: p._id, status: 'Completed' })
        .sort({ date: -1 }).select('date').lean(),
    ]);
    return {
      id: p._id.toString(),
      patientId: p.patientId,
      name: p.userId.name,
      email: p.userId.email,
      status: p.userId.status,
      gender: p.gender,
      dob: p.dob,
      appointments,
      lastVisit: lastVisit ? lastVisit.date : null,
      authorized: true,
    };
  }));

  res.json({ success: true, items: detailed, total, page, limit, pages: Math.ceil(total / limit) || 1 });
}

/** GET /api/doctors/me/dashboard — doctor stats. */
async function getMyDashboard(req, res) {
  const doctor = await Doctor.findOne({ userId: req.user.id });
  if (!doctor) throw ApiError.forbidden('Doctor profile not found');
  const analyticsService = require('../services/analytics.service');
  const stats = await analyticsService.getDoctorStats(doctor._id);
  res.json({ success: true, stats, doctor: appointmentService.doctorPublic(doctor, { name: req.user.name, email: req.user.email, status: 'ACTIVE' }) });
}

module.exports = { listDoctors, getDoctor, getAvailability, getMyAppointments, getMyPatients, getMyDashboard };

wrapAll(module.exports);
