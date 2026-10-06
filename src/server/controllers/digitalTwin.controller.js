const { wrapAll } = require('../utils/asyncHandler');
const { ApiError } = require('../utils/ApiError');
const { auditAsync } = require('../services/audit.service');
const Queue = require('../models/Queue');
const Consultation = require('../models/Consultation');
const Prescription = require('../models/Prescription');
const LabOrder = require('../models/LabOrder');
const Notification = require('../models/Notification');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Setting = require('../models/Setting');
const { HOSPITAL_DEPTS } = require('../config/constants');

async function getDigitalTwin(req, res) {
  if (req.user.role !== 'ADMIN') {
    auditAsync({
      action: 'SECURITY_EVENT',
      role: req.user.role,
      userId: req.user.id,
      resourceType: 'ADMIN',
      resourceId: 'digital-twin',
      result: 'DENIED',
      ipAddress: req.ip,
      detail: 'Non-admin attempted to access the 3D digital twin API',
    });
    throw ApiError.forbidden('Access denied');
  }

  const today = new Date().toISOString().slice(0, 10);
  const dept = (name) => (HOSPITAL_DEPTS.find((d) => d.code === name) || { name }).name;

  // Doctors store the department NAME ("Cardiology"); queues store the CODE
  // ("CARD"). Both must resolve to the same key for the twin to group them.
  const toDeptCode = (value) => {
    if (!value) return null;
    const lower = String(value).trim().toLowerCase();
    const byCode = HOSPITAL_DEPTS.find((d) => d.code.toLowerCase() === lower);
    if (byCode) return byCode.code;
    const byName = HOSPITAL_DEPTS.find((d) => d.name.toLowerCase() === lower);
    return byName ? byName.code : String(value).trim();
  };

  const [
    departments,
    doctors,
    patients,
    queues,
    activeConsultations,
    appointmentsToday,
    consultationsToday,
    pendingPrescriptions,
    pendingLabOrders,
    notifications,
    bedOccupancy,
    emergencyIndicators,
    todaySummary,
  ] = await Promise.all([
    Promise.all(
      HOSPITAL_DEPTS.map(async (d) => {
        const q = await Queue.find({ 'queue.departmentCode': d.code })
          .sort({ 'queue.position': 1, createdAt: 1 })
          .populate({
            path: 'patientId',
            select: 'patientId userId',
            populate: { path: 'userId', select: 'name' },
          })
          .populate({
            path: 'doctorId',
            select: 'doctorId specialization department userId',
            populate: { path: 'userId', select: 'name' },
          })
          .lean();
        const waiting = q.filter((x) => x.queue.status === 'Waiting');
        const nowServing = q.find((x) => x.queue.status === 'NowServing');
        const inConsultation = q.filter((x) => x.queue.status === 'InConsultation');
        const completed = q.filter((x) => x.queue.status === 'Completed');
        return {
          code: d.code,
          name: dept(d.code),
          waiting: waiting.map((x) => ({
            queueId: x._id.toString(),
            tokenCode: x.queue.tokenCode,
            position: x.queue.position,
            patient: {
              patientId: x.patientId?.patientId,
              name: x.patientId?.userId?.name || 'Unknown',
            },
            doctor: {
              doctorId: x.doctorId?.doctorId,
              name: x.doctorId?.userId?.name || '',
            },
            appointment: {
              date: x.appointmentId?.date,
              time: x.appointmentId?.time,
              status: x.appointmentId?.status,
            },
            status: x.queue.status,
            arrivedAt: x.arrivedAt,
            calledAt: x.calledAt,
            consultationStartedAt: x.consultationStartedAt,
            completedAt: x.completedAt,
          })),
          nowServing: nowServing
            ? {
                queueId: nowServing._id.toString(),
                tokenCode: nowServing.queue.tokenCode,
                position: nowServing.queue.position,
                patient: {
                  patientId: nowServing.patientId?.patientId,
                  name: nowServing.patientId?.userId?.name || 'Unknown',
                },
                doctor: {
                  doctorId: nowServing.doctorId?.doctorId,
                  name: nowServing.doctorId?.userId?.name || '',
                },
                appointment: {
                  date: nowServing.appointmentId?.date,
                  time: nowServing.appointmentId?.time,
                  status: nowServing.appointmentId?.status,
                },
                status: nowServing.queue.status,
                arrivedAt: nowServing.arrivedAt,
                calledAt: nowServing.calledAt,
                consultationStartedAt: nowServing.consultationStartedAt,
                completedAt: nowServing.completedAt,
              }
            : null,
          inConsultation: inConsultation.map((x) => ({
            queueId: x._id.toString(),
            tokenCode: x.queue.tokenCode,
            position: x.queue.position,
            patient: {
              patientId: x.patientId?.patientId,
              name: x.patientId?.userId?.name || 'Unknown',
            },
            doctor: {
              doctorId: x.doctorId?.doctorId,
              name: x.doctorId?.userId?.name || '',
            },
            appointment: {
              date: x.appointmentId?.date,
              time: x.appointmentId?.time,
              status: x.appointmentId?.status,
            },
            status: x.queue.status,
            consultationStartedAt: x.consultationStartedAt,
          })),
          completedCount: completed.length,
          totalInDepartment: q.length,
        };
      })
    ),
    Doctor.find()
      .populate({ path: 'userId', select: 'name email status' })
      .lean(),
    Patient.find().populate({ path: 'userId', select: 'name email status' }).lean(),
    Queue.find()
      .sort({ 'queue.position': 1, createdAt: 1 })
      .populate({
        path: 'patientId',
        select: 'patientId userId',
        populate: { path: 'userId', select: 'name' },
      })
      .populate({
        path: 'doctorId',
        select: 'doctorId specialization department userId',
        populate: { path: 'userId', select: 'name' },
      })
      .lean(),
    Consultation.find({ status: 'InProgress' })
      .sort({ startedAt: -1 })
      .populate({
        path: 'patientId',
        select: 'patientId userId',
        populate: { path: 'userId', select: 'name' },
      })
      .populate({
        path: 'doctorId',
        select: 'doctorId specialization department userId',
        populate: { path: 'userId', select: 'name' },
      })
      .lean(),
    Appointment.find({ date: today }).lean(),
    Consultation.find({ status: 'Completed', completedAt: { $gte: new Date(`${today}T00:00:00Z`) } }).lean(),
    Prescription.find({ status: { $in: ['Issued', 'Dispensed'] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({ path: 'patientId', select: 'patientId userId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'doctorId', select: 'doctorId specialization department userId', populate: { path: 'userId', select: 'name' } })
      .lean(),
    LabOrder.find({ status: { $in: ['Ordered', 'Processing'] } })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate({ path: 'patientId', select: 'patientId userId', populate: { path: 'userId', select: 'name' } })
      .populate({ path: 'doctorId', select: 'doctorId specialization department userId', populate: { path: 'userId', select: 'name' } })
      .lean(),
    Notification.find({ read: false }).sort({ createdAt: -1 }).limit(50).lean(),
    Promise.resolve(null),
    Promise.resolve([]),
    Promise.resolve({}),
  ]);

  const bedOccupancyOut = bedOccupancy || { total: 0, occupied: 0, available: 0 };
  const emergencyIndicatorsOut = emergencyIndicators || [];

  const todaySummaryOut = {
    appointmentsToday: appointmentsToday.length,
    consultationsToday: consultationsToday.length,
    pendingPrescriptions: pendingPrescriptions.length,
    pendingLabOrders: pendingLabOrders.length,
    unreadNotifications: notifications.length,
    emergencyCases: emergencyIndicatorsOut.length,
    totalWaiting: queues.filter((q) => q.queue.status === 'Waiting').length,
    totalInConsultation: queues.filter((q) => q.queue.status === 'InConsultation').length,
    totalNowServing: queues.filter((q) => q.queue.status === 'NowServing').length,
    bedOccupancy,
  };

  return res.json({
    success: true,
    departments: departments.map((d, i) => ({
      ...d,
      doctors: doctors.filter(
        (doc) => toDeptCode(doc.department) === d.code && doc.userId?.status === 'ACTIVE'
      ).map((doc) => ({
        id: doc._id.toString(),
        doctorId: doc.doctorId,
        name: doc.userId?.name || '',
        specialization: doc.specialization,
        department: doc.department,
        departmentCode: toDeptCode(doc.department),
        status: doc.userId?.status || 'UNKNOWN',
      })),
      ...queues.find((q) => q.queue.departmentCode === d.code) || { queue: null },
      // Map stored queue shapes back into department blocks.
      waiting: d.waiting ?? [],
      nowServing: d.nowServing ?? null,
      inConsultation: d.inConsultation ?? [],
    })),
    doctors: doctors
      .filter((d) => d.userId)
      .map((d) => ({
        id: d._id.toString(),
        doctorId: d.doctorId,
        name: d.userId.name,
        email: d.userId.email,
        status: d.userId.status,
        specialization: d.specialization,
        department: d.department,
        departmentCode: toDeptCode(d.department),
        experience: d.experience,
        isAcceptingNew: d.isAcceptingNew,
        rating: d.rating,
      })),
    patients: patients
      .filter((p) => p.userId)
      .map((p) => ({
        id: p._id.toString(),
        patientId: p.patientId,
        name: p.userId.name,
        email: p.userId.email,
        status: p.userId.status,
        bloodGroup: p.bloodGroup || null,
        dateOfBirth: p.dateOfBirth || null,
        gender: p.gender || null,
      })),
    queues: queues.map((q) => ({
      id: q._id.toString(),
      tokenCode: q.queue.tokenCode,
      departmentCode: q.queue.departmentCode,
      departmentName: dept(q.queue.departmentCode),
      status: q.queue.status,
      position: q.queue.position,
      patient: {
        patientId: q.patientId?.patientId,
        name: q.patientId?.userId?.name || 'Unknown',
      },
      doctor: {
        doctorId: q.doctorId?.doctorId,
        name: q.doctorId?.userId?.name || '',
        specialization: q.doctorId?.specialization,
      },
      appointment: {
        date: q.appointmentId?.date,
        time: q.appointmentId?.time,
        status: q.appointmentId?.status,
      },
      arrivedAt: q.arrivedAt,
      calledAt: q.calledAt,
      consultationStartedAt: q.consultationStartedAt,
      completedAt: q.completedAt,
    })),
    activeConsultations: activeConsultations.map((c) => ({
      id: c._id.toString(),
      consultationId: c.consultationId,
      appointmentId: c.appointmentId?.toString() || null,
      patient: {
        patientId: c.patientId?.patientId,
        name: c.patientId?.userId?.name || 'Unknown',
      },
      doctor: {
        doctorId: c.doctorId?.doctorId,
        name: c.doctorId?.userId?.name || '',
        specialization: c.doctorId?.specialization,
      },
      departmentCode: c.departmentCode,
      departmentName: dept(c.departmentCode),
      status: c.status,
      startedAt: c.startedAt,
      chiefComplaint: c.chiefComplaint || '',
    })),
    appointmentsToday: appointmentsToday.length,
    consultationsToday: consultationsToday.length,
    pendingPrescriptions: pendingPrescriptions.map((rx) => ({
      id: rx._id.toString(),
      prescriptionId: rx.prescriptionId,
      patient: {
        patientId: rx.patientId?.patientId,
        name: rx.patientId?.userId?.name || 'Unknown',
      },
      doctor: {
        doctorId: rx.doctorId?.doctorId,
        name: rx.doctorId?.userId?.name || '',
      },
      status: rx.status,
      itemsCount: Array.isArray(rx.items) ? rx.items.length : 0,
      departmentCode: rx.departmentCode,
      createdAt: rx.createdAt,
    })),
    pendingLabOrders: pendingLabOrders.map((o) => ({
      id: o._id.toString(),
      orderId: o.orderId,
      patient: {
        patientId: o.patientId?.patientId,
        name: o.patientId?.userId?.name || 'Unknown',
      },
      doctor: {
        doctorId: o.doctorId?.doctorId,
        name: o.doctorId?.userId?.name || '',
      },
      status: o.status,
      testsCount: Array.isArray(o.tests) ? o.tests.length : 0,
      departmentCode: o.departmentCode,
      createdAt: o.createdAt,
    })),
    notifications: notifications.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      tokenCode: n.tokenCode || '',
      read: n.read,
      createdAt: n.createdAt,
    })),
    bedOccupancy: bedOccupancyOut,
    emergencyIndicators: emergencyIndicatorsOut,
    todaySummary: todaySummaryOut,
    generated: false,
    dataSource: 'MedNexus database',
  });
}

module.exports = { getDigitalTwin };

wrapAll(module.exports);
