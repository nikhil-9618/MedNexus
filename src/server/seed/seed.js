/**
 * MedNexus seed script — 100% SYNTHETIC demo data.
 *
 * Creates:
 *   - Departments, 8 doctors, 22 patients (plus 3 demo accounts)
 *   - 55+ appointments across the past 30 days and the next 14 days
 *   - Medical records for completed consultations
 *   - Audit log entries
 *
 * Run:  npm run seed  (from server/) — wipes and re-creates collections.
 * Demo passwords come from SEED_* env vars with safe local defaults.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const MedicalRecord = require('../models/MedicalRecord');
const AuditLog = require('../models/AuditLog');
const Department = require('../models/Department');
const Setting = require('../models/Setting');
const Counter = require('../models/Counter');
const Queue = require('../models/Queue');
const { connectDB, disconnectDB } = require('../config/db');
const { config } = require('../config/env');
const { DEPARTMENTS, DOCTORS, PATIENTS, REASONS, DIAGNOSES } = require('./data');
const { addDaysISO, todayISO } = require('../utils/datetime');
const { WEEKDAYS, HOSPITAL_DEPTS } = require('../config/constants');
const { nextDoctorCode, nextPatientCode } = require('../utils/ids');

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];

async function reset() {
  await Promise.all([
    User.deleteMany({}),
    Patient.deleteMany({}),
    Doctor.deleteMany({}),
    Appointment.deleteMany({}),
    MedicalRecord.deleteMany({}),
    AuditLog.deleteMany({}),
    Department.deleteMany({}),
    Setting.deleteMany({}),
    Counter.deleteMany({}),
    Queue.deleteMany({}),
  ]);
}

async function createUser(name, email, passwordHash, role) {
  return User.create({ name, email, passwordHash, role, status: 'ACTIVE' });
}

async function main(keepAlive = false) {
  await connectDB();
  await reset();
  console.log('[seed] collections cleared');

  // ---------------- Departments ----------------
  await Department.insertMany(DEPARTMENTS.map((d) => ({ ...d, isActive: true })));
  console.log(`[seed] ${DEPARTMENTS.length} departments`);

  // ---------------- Admin ----------------
  const adminHash = await User.hashPassword(config.seedPasswords.admin, config.bcrypt.rounds);
  const admin = await createUser('Dr. Nadia Fielding (Admin)', 'admin@mednexus.demo', adminHash, 'ADMIN');
  console.log('[seed] admin account created');

  // ---------------- Doctors ----------------
  const doctorDocs = [];
  for (const d of DOCTORS) {
    const hash = await User.hashPassword(config.seedPasswords.doctor, config.bcrypt.rounds);
    const user = await createUser(d.name, d.email, hash, 'DOCTOR');
    const weekdays = {};
    WEEKDAYS.forEach((wd) => { weekdays[wd] = d.availability[wd] || []; });
    const doc = await Doctor.create({
      userId: user._id,
      doctorId: await nextDoctorCode(),
      specialization: d.specialization,
      department: d.department,
      experience: d.experience,
      qualification: d.qualification,
      bio: d.bio,
      rating: d.rating,
      reviewsCount: d.reviewsCount,
      consultationFee: d.fee,
      availability: weekdays,
      isAcceptingNew: true,
    });
    doctorDocs.push({ user, doc });
  }
  console.log(`[seed] ${doctorDocs.length} doctors`);

  // ---------------- Patients ----------------
  const patientDocs = [];
  for (const p of PATIENTS) {
    const hash = await User.hashPassword(config.seedPasswords.patient, config.bcrypt.rounds);
    const user = await createUser(p.name, p.email, hash, 'PATIENT');
    const doc = await Patient.create({
      userId: user._id,
      patientId: await nextPatientCode(),
      dob: p.dob,
      gender: p.gender,
      phone: p.phone,
      address: p.address,
      bloodGroup: p.bloodGroup || '',
    });
    patientDocs.push({ user, doc });
  }
  // The primary demo patient gets the documented demo password.
  console.log(`[seed] ${patientDocs.length} patients`);

  // ---------------- Appointments + records ----------------
  const today = todayISO();
  const slots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  const used = new Set(); // doctor|date|time
  let created = 0;

  const plan = [];
  // Past 30 days: mostly Completed, some Cancelled.
  for (let off = -30; off <= -1; off += 1) {
    const date = addDaysISO(today, off);
    const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    for (const { doc } of doctorDocs) {
      const working = (doc.availability.get(weekday) || []).filter((t) => slots.includes(t));
      const n = rnd(2); // 0 or 1 per doctor per day
      for (let i = 0; i < n; i += 1) {
        const time = pick(working);
        if (!time) break;
        const key = `${doc._id}|${date}|${time}`;
        if (used.has(key)) continue;
        used.add(key);
        plan.push({ date, time, status: Math.random() < 0.85 ? 'Completed' : 'Cancelled' });
      }
    }
  }
  // Today & next 14 days: Scheduled/Confirmed on working slots.
  for (let off = 0; off <= 14; off += 1) {
    const date = addDaysISO(today, off);
    const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    for (const { doc } of doctorDocs) {
      const working = (doc.availability.get(weekday) || []).filter((t) => slots.includes(t));
      const n = rnd(3); // 0-2 per doctor per day
      for (let i = 0; i < n; i += 1) {
        const time = pick(working);
        if (!time) break;
        const key = `${doc._id}|${date}|${time}`;
        if (used.has(key)) continue;
        used.add(key);
        plan.push({ date, time, status: off === 0 && Math.random() < 0.4 ? 'Confirmed' : 'Scheduled' });
      }
    }
  }

  const appointmentDocs = [];
  for (const item of plan) {
    const patient = pick(patientDocs);
    const doctor = pick(doctorDocs);
    // keep doctor availability consistent for the slot
    const weekday = WEEKDAYS[new Date(`${item.date}T00:00:00Z`).getUTCDay()];
    if (!(doctor.doc.availability.get(weekday) || []).includes(item.time)) continue;

    // re-check the unique slot against the actually-picked doctor
    const slotKey = `${doctor.doc._id}|${item.date}|${item.time}`;
    if (used.has(slotKey)) continue;
    used.add(slotKey);

    appointmentDocs.push({
      patientId: patient.doc._id,
      doctorId: doctor.doc._id,
      date: item.date,
      time: item.time,
      reason: pick(REASONS),
      status: item.status,
      createdAt: new Date(`${item.date}T08:00:00Z`),
      updatedAt: new Date(`${item.date}T08:00:00Z`),
    });
  }

  // ---- Guarantee the demo patient (Priya Sharma) a reference-aligned history ----
  // 3 completed past visits + 1 confirmed upcoming visit with Dr. Ananya Reddy,
  // so the dashboard, history and records pages always have realistic demo data.
  const demoPatient = patientDocs[0];
  const demoPlan = [
    { off: -9, doctorIdx: 0, reason: 'General Checkup', status: 'Completed' },
    { off: -21, doctorIdx: 1, reason: 'Fever', status: 'Completed' },
    { off: -34, doctorIdx: 2, reason: 'Skin Issues', status: 'Completed' },
    { off: 3, doctorIdx: 0, reason: 'Follow-up consultation', status: 'Confirmed' },
  ];
  for (const item of demoPlan) {
    const date = addDaysISO(today, item.off);
    const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    const doc = doctorDocs[item.doctorIdx].doc;
    const working = (doc.availability.get(weekday) || []).filter((t) => slots.includes(t));
    const time = working.find((t) => !used.has(`${doc._id}|${date}|${t}`));
    if (!time) continue;
    used.add(`${doc._id}|${date}|${time}`);
    appointmentDocs.push({
      patientId: demoPatient.doc._id,
      doctorId: doc._id,
      date,
      time,
      reason: item.reason,
      status: item.status,
      createdAt: new Date(`${date}T08:00:00Z`),
      updatedAt: new Date(`${date}T08:00:00Z`),
    });
  }
  console.log('[seed] demo patient (Priya Sharma) appointment plan applied');

  const appts = await Appointment.insertMany(appointmentDocs, { ordered: false }).catch((err) => {
    // Tolerate rare race duplicates from the unique index; keep inserted docs.
    if (err && err.insertedDocs) return err.insertedDocs;
    throw err;
  });
  created = appts.length;
  console.log(`[seed] ${created} appointments`);

  // ---------------- Queue tokens (one per live appointment) ----------------
  // Mirrors what the booking flow does: every non-cancelled appointment gets a
  // department token. Today's flow is advanced so the live views have data.
  const deptCodeOf = (name) => {
    const lower = String(name || '').trim().toLowerCase();
    const byName = HOSPITAL_DEPTS.find((d) => d.name.toLowerCase() === lower);
    if (byName) return byName.code;
    const byCode = HOSPITAL_DEPTS.find((d) => d.code.toLowerCase() === lower);
    return byCode ? byCode.code : 'GENMED';
  };
  const doctorDepartment = new Map(doctorDocs.map((d) => [String(d.doc._id), d.doc.department]));
  const tokenCounters = new Map();
  const liveToday = new Map();
  const ordered = [...appts].sort(
    (a, b) => String(a.date).localeCompare(String(b.date)) || String(a.time).localeCompare(String(b.time))
  );

  const queueDocs = ordered
    .filter((a) => a.status !== 'Cancelled')
    .map((appt) => {
      const code = deptCodeOf(doctorDepartment.get(String(appt.doctorId)));
      const n = (tokenCounters.get(code) || 0) + 1;
      tokenCounters.set(code, n);

      const stamp = new Date(`${appt.date}T${appt.time || '09:00'}:00Z`);
      const completed = appt.status === 'Completed';

      let status = completed ? 'Completed' : 'Waiting';
      let calledAt = null;
      let consultationStartedAt = null;

      // Today's live flow: the first two tokens per department are being served.
      if (!completed && appt.date === today) {
        const served = liveToday.get(code) || 0;
        if (served === 0) {
          status = 'NowServing';
          calledAt = stamp;
        } else if (served === 1) {
          status = 'InConsultation';
          calledAt = stamp;
          consultationStartedAt = stamp;
        }
        if (served < 2) liveToday.set(code, served + 1);
      }

      return {
        appointmentId: appt._id,
        patientId: appt.patientId,
        doctorId: appt.doctorId,
        queue: {
          status,
          position: 0,
          tokenCode: `${code}-${String(n).padStart(3, '0')}`,
          departmentCode: code,
        },
        arrivedAt: completed ? stamp : null,
        calledAt,
        consultationStartedAt,
        completedAt: completed ? stamp : null,
        notes: '',
        createdAt: stamp,
        updatedAt: stamp,
      };
    });

  // Queue positions are per-department and count only entries still in flow.
  const positionByDept = new Map();
  for (const q of queueDocs) {
    if (q.queue.status === 'Completed') continue;
    const p = (positionByDept.get(q.queue.departmentCode) || 0) + 1;
    positionByDept.set(q.queue.departmentCode, p);
    q.queue.position = p;
  }

  const createdQueues = await Queue.insertMany(queueDocs, { ordered: false });
  await Appointment.bulkWrite(
    createdQueues.map((q) => ({
      updateOne: {
        filter: { _id: q.appointmentId },
        update: {
          $set: {
            departmentCode: q.queue.departmentCode,
            token: q.queue.tokenCode,
            queueId: q._id,
          },
        },
      },
    })),
    { ordered: false }
  );
  console.log(`[seed] ${createdQueues.length} queue tokens`);

  // ---------------- Medical records for completed appointments ----------------
  const completed = appts.filter((a) => a.status === 'Completed');
  const records = [];
  for (const appt of completed) {
    const d = pick(DIAGNOSES);
    records.push({
      recordId: `R${1000 + records.length + 1}`,
      patientId: appt.patientId,
      doctorId: appt.doctorId,
      appointmentId: appt._id,
      diagnosis: d.diagnosis,
      prescription: d.prescription,
      notes: d.notes,
      category: d.category || 'history',
      date: appt.date,
      createdAt: new Date(`${appt.date}T09:00:00Z`),
      updatedAt: new Date(`${appt.date}T09:00:00Z`),
    });
  }
  await MedicalRecord.insertMany(records);
  console.log(`[seed] ${records.length} medical records (all synthetic)`);

  // ---------------- Audit history ----------------
  const audits = [];
  appts.slice(0, 120).forEach((a) => {
    const p = patientDocs.find((x) => x.doc._id.equals(a.patientId));
    audits.push({
      logId: `LOG-${String(100000 + audits.length)}`,
      userId: p ? p.user._id : null,
      role: 'PATIENT',
      action: 'BOOK_APPOINTMENT',
      resourceType: 'APPOINTMENT',
      resourceId: a._id.toString(),
      timestamp: new Date(`${a.date}T08:00:00Z`),
      ipAddress: '127.0.0.1',
      result: 'SUCCESS',
      detail: 'Seeded booking (synthetic)',
    });
  });
  doctorDocs.forEach(({ user, doc }) => {
    audits.push({
      logId: `LOG-${String(200000 + audits.length)}`,
      userId: user._id,
      role: 'ADMIN',
      action: 'DOCTOR_CREATED',
      resourceType: 'DOCTOR',
      resourceId: doc.doctorId,
      timestamp: new Date(Date.now() - 40 * 86400000),
      ipAddress: '127.0.0.1',
      result: 'SUCCESS',
      detail: `Seeded Dr ${doc.doctorId} (synthetic)`,
    });
  });
  await AuditLog.insertMany(audits);
  console.log(`[seed] ${audits.length} audit entries`);

  // ---------------- Settings ----------------
  await Setting.insertMany([
    { key: 'booking.cancellationCutOffHours', value: 2, label: 'Hours before appointment when cancellation closes' },
    { key: 'booking.maxUpcomingPerPatient', value: 5, label: 'Maximum upcoming appointments per patient' },
    { key: 'clinic.name', value: 'MedNexus Clinic', label: 'Clinic display name' },
    { key: 'assistant.enabled', value: true, label: 'Enable AI assistant' },
  ]);  console.log('[seed] DONE — demo accounts:');
  console.log('   PATIENT  patient@mednexus.demo  (password: ' + config.seedPasswords.patient + ')');
  console.log('   DOCTOR   doctor@mednexus.demo   (password: ' + config.seedPasswords.doctor + ') — Dr. Ananya Reddy');
  console.log('   ADMIN    admin@mednexus.demo    (password: ' + config.seedPasswords.admin + ')');
  console.log('   All 8 doctors use the same demo password. All data is synthetic.');

  // Keep the connection open when invoked in-process by server.js auto-seed.
  if (keepAlive) return;
  await disconnectDB();
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error('[seed] failed:', err);
    await disconnectDB().catch(() => {});
    process.exit(1);
  });
}

module.exports = { main };
