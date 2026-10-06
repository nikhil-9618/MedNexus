/**
 * Analytics service — all numbers come from real MongoDB aggregations.
 * Used by the admin dashboard charts (Recharts on the client).
 */
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { addDaysISO, todayISO } = require('../utils/datetime');

/** Count documents matching base filters by status. */
async function countByStatus(base) {
  const rows = await Appointment.aggregate([
    { $match: base },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const out = { Scheduled: 0, Confirmed: 0, Completed: 0, Cancelled: 0 };
  rows.forEach((r) => { out[r._id] = r.count; });
  return out;
}

/** Admin dashboard totals + chart series. */
async function getAdminOverview({ days = 14 } = {}) {
  const today = todayISO();
  const from = addDaysISO(today, -(days - 1));

  const [totalPatients, totalDoctors, byStatus, totals, activeDoctors] = await Promise.all([
    Patient.countDocuments({}),
    Doctor.countDocuments({}),
    countByStatus({}),
    (async () => {
      const t = await countByStatus({ date: today });
      return { today: t.Scheduled + t.Confirmed, ...t };
    })(),
    User.countDocuments({ role: 'DOCTOR', status: 'ACTIVE' }),
  ]);

  // Appointments per day over the window (all statuses).
  const perDayRows = await Appointment.aggregate([
    { $match: { date: { $gte: from, $lte: today } } },
    { $group: { _id: '$date', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } } } },
    { $sort: { _id: 1 } },
  ]);
  const perDayMap = new Map(perDayRows.map((r) => [r._id, r]));
  const appointmentsByDay = [];
  for (let i = 0; i < days; i += 1) {
    const d = addDaysISO(from, i);
    const row = perDayMap.get(d) || { total: 0, completed: 0, cancelled: 0 };
    appointmentsByDay.push({ date: d, total: row.total, completed: row.completed, cancelled: row.cancelled });
  }

  // Specialization distribution across active doctors.
  const specRows = await Doctor.aggregate([
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $match: { 'user.status': 'ACTIVE', 'user.role': 'DOCTOR' } },
    { $group: { _id: '$specialization', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  // Status distribution for pie chart.
  const statusDist = Object.entries(byStatus).map(([name, value]) => ({ name, value }));

  const [recentAudit, lastLogins] = await Promise.all([
    AuditLog.find().sort({ timestamp: -1 }).limit(6)
      .populate({ path: 'userId', select: 'name' })
      .lean(),
    User.countDocuments({ lastLoginAt: { $ne: null } }),
  ]);

  return {
    totals: {
      patients: totalPatients,
      doctors: totalDoctors,
      activeDoctors,
      appointments: byStatus.Scheduled + byStatus.Confirmed + byStatus.Completed + byStatus.Cancelled,
      todayAppointments: totals.today,
      completed: byStatus.Completed,
      cancelled: byStatus.Cancelled,
      upcoming: byStatus.Scheduled + byStatus.Confirmed,
    },
    appointmentsByDay,
    statusDist,
    specializationDist: specRows.map((r) => ({ name: r._id, value: r.count })),
    recentAudit: recentAudit.map((a) => ({
      id: a._id.toString(),
      action: a.action,
      role: a.role,
      user: a.userId ? a.userId.name : 'SYSTEM',
      resourceType: a.resourceType,
      resourceId: a.resourceId,
      result: a.result,
      timestamp: a.timestamp,
    })),
    usersSeen: lastLogins,
  };
}

/** Doctor dashboard stats. */
async function getDoctorStats(doctorDocId) {
  const today = todayISO();
  const byStatus = await countByStatus({ doctorId: doctorDocId, date: today });

  const [upcoming, completedTotal, patientsSeen] = await Promise.all([
    Appointment.countDocuments({ doctorId: doctorDocId, status: { $in: ['Scheduled', 'Confirmed'] }, date: { $gte: today } }),
    Appointment.countDocuments({ doctorId: doctorDocId, status: 'Completed' }),
    Appointment.distinct('patientId', { doctorId: doctorDocId, status: 'Completed' }),
  ]);

  return {
    todayTotal: byStatus.Scheduled + byStatus.Confirmed + byStatus.Completed,
    todayCompleted: byStatus.Completed,
    todayCancelled: byStatus.Cancelled,
    waiting: byStatus.Scheduled + byStatus.Confirmed - 0,
    upcoming,
    completedTotal,
    patientsSeen: patientsSeen.length,
  };
}

/** Patient-facing quick stats (used on patient dashboard). */
async function getPatientStats(patientDocId) {
  const today = todayISO();
  const [upcoming, completed, next] = await Promise.all([
    Appointment.countDocuments({ patientId: patientDocId, status: { $in: ['Scheduled', 'Confirmed'] }, date: { $gte: today } }),
    Appointment.countDocuments({ patientId: patientDocId, status: 'Completed' }),
    Appointment.findOne({ patientId: patientDocId, status: { $in: ['Scheduled', 'Confirmed'] }, date: { $gte: today } })
      .sort({ date: 1, time: 1 })
      .populate({ path: 'doctorId', select: 'doctorId specialization userId', populate: { path: 'userId', select: 'name' } }),
  ]);
  const MedicalRecord = require('../models/MedicalRecord');
  const recordCount = await MedicalRecord.countDocuments({ patientId: patientDocId });
  const total = await Appointment.countDocuments({ patientId: patientDocId });
  const doctorIds = await Appointment.distinct('doctorId', { patientId: patientDocId });

  return {
    upcoming,
    completed,
    records: recordCount,
    total,
    doctorsVisited: doctorIds.length,
    nextAppointment: next ? require('./appointment.service').hydrateAppointment(next) : null,
  };
}

module.exports = { getAdminOverview, getDoctorStats, getPatientStats };
