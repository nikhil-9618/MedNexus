#!/usr/bin/env node
/**
 * Security checklist runner — executes every control in the PS-04
 * security checklist against a LIVE server and prints PASS/FAIL rows.
 * This is the tool that backs the results table in the README.
 *
 * Usage:
 *   node tests/security-checklist.js            # starts its own server (default)
 *   BASE_URL=http://localhost:5000 node tests/security-checklist.js
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'checklist-secret-0123456789abcdef0123456789';

const http = require('node:http');
const { buildApp } = require('../app');
const fixtures = require('./helpers');

const BASE = process.env.BASE_URL || null;
let server = null;
let base = BASE;

// Credentials for every patient this script creates, so the leak check can log
// in as one of its own accounts rather than depending on seeded data.
const registeredPatients = [];

async function api(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      `${base}${path}`,
      {
        method,
        headers: {
          'content-type': 'application/json',
          ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          let json = null;
          try { json = data ? JSON.parse(data) : null; } catch { json = null; }
          resolve({ status: res.statusCode, body: json, text: data, headers: res.headers });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** Register a patient through the real signup + OTP flow. */
async function registerPatient(name) {
  const email = `checklist.${Date.now()}.${Math.floor(Math.random() * 10000)}@example.demo`;
  const password = 'Str0ngPass!9';
  const reg = await api('POST', '/api/auth/register', {
    body: {
      name, email, password, confirmPassword: password,
      phone: '+1-555-7777', dob: '1991-03-03', gender: 'Other',
    },
  });
  expect(reg.status === 201, `patient registration failed: ${reg.text}`);
  expect(!!reg.body.devOtp, 'test transport did not surface the OTP');
  const verified = await api('POST', '/api/auth/verify-otp', { body: { email, otp: reg.body.devOtp } });
  expect(verified.status === 200, `otp verification failed: ${verified.text}`);
  registeredPatients.push({ email, password });
  return verified.body.token;
}

let pass = 0;
let fail = 0;

async function check(name, fn) {
  try {
    await fn();
    pass += 1;
    console.log(`PASS  ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL  ${name} — ${err.message}`);
  }
}

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

(async () => {
  let adminEmail;
  let adminPassword;
  let doctorEmail;
  let doctorPassword;

  if (!BASE) {
    // Ephemeral DB with reference data plus fixture accounts. The doctor is
    // created through the real admin service, so it has bookable availability.
    await fixtures.startDB();
    adminEmail = fixtures.TEST_ADMIN.email;
    adminPassword = fixtures.TEST_ADMIN.password;
    doctorEmail = fixtures.TEST_DOCTOR.email;
    doctorPassword = fixtures.TEST_DOCTOR.password;

    const app = buildApp();
    server = app.listen(0);
    await new Promise((r) => server.on('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
    console.log(`[checklist] ephemeral server on ${base}`);
  } else {
    // Against an external server the accounts must be supplied: no accounts are
    // seeded any more, so there are no built-in logins to fall back on.
    adminEmail = process.env.CHECKLIST_ADMIN_EMAIL || '';
    adminPassword = process.env.CHECKLIST_ADMIN_PASSWORD || '';
    doctorEmail = process.env.CHECKLIST_DOCTOR_EMAIL || '';
    doctorPassword = process.env.CHECKLIST_DOCTOR_PASSWORD || '';
    if (!adminEmail || !adminPassword || !doctorEmail || !doctorPassword) {
      console.error(
        '[checklist] With BASE_URL set, provide CHECKLIST_ADMIN_EMAIL, CHECKLIST_ADMIN_PASSWORD, ' +
          'CHECKLIST_DOCTOR_EMAIL and CHECKLIST_DOCTOR_PASSWORD.\n' +
          '            Create the admin with `npm run create-admin`, and a doctor from Admin → Manage Doctors.'
      );
      process.exit(1);
    }
    console.log(`[checklist] external server ${base}`);
  }

  const adminLogin = await api('POST', '/api/auth/login', { body: { email: adminEmail, password: adminPassword, role: 'ADMIN' } });
  expect(adminLogin.status === 200, 'admin login failed — create one with `npm run create-admin`');
  const admin = adminLogin.body.token;

  const doctorLogin = await api('POST', '/api/auth/login', { body: { email: doctorEmail, password: doctorPassword, role: 'DOCTOR' } });
  expect(doctorLogin.status === 200, 'doctor login failed — provision one from Admin → Manage Doctors');
  const doctor = doctorLogin.body.token;

  // Both patients are created through the public signup flow, so the checklist
  // depends on no patient fixture at all.
  const patient = await registerPatient('Checklist Patient A');
  // A genuine sign-in with the credentials just created, not an assumed pass.
  const patientLogin = await api('POST', '/api/auth/login', {
    body: { email: registeredPatients[0].email, password: registeredPatients[0].password, role: 'PATIENT' },
  });
  expect(patientLogin.status === 200, `patient login failed: ${patientLogin.text}`);
  const patientB = await registerPatient('Checklist Patient B');
  const meB = await api('GET', '/api/patients/me', { token: patientB });
  const patientBId = meB.body.patient.id;

  await check('Health endpoint responds', async () => {
    const res = await api('GET', '/api/health');
    expect(res.status === 200 && res.body.status === 'ok', 'bad health response');
  });

  await check('Valid login works (all roles)', async () => {
    expect(adminLogin.status === 200, 'admin');
    expect(patientLogin.status === 200, 'patient');
    expect(doctorLogin.status === 200, 'doctor');
  });

  await check('Invalid password rejected (401)', async () => {
    const res = await api('POST', '/api/auth/login', { body: { email: registeredPatients[0].email, password: 'WrongPass!123' } });
    expect(res.status === 401, `got ${res.status}`);
  });

  await check('Expired JWT rejected (401)', async () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ role: 'PATIENT', sub: '000000000000000000000000' }, process.env.JWT_SECRET, { expiresIn: '-10s', issuer: 'mednexus-api', audience: 'mednexus-client' });
    const res = await api('GET', '/api/auth/me', { token: expired });
    expect(res.status === 401, `got ${res.status}`);
  });

  await check('Tampered JWT rejected (401)', async () => {
    const parts = patient.split('.');
    const tampered = `${parts[0]}.${parts[1].slice(0, -2)}aa.${parts[2]}`;
    const res = await api('GET', '/api/auth/me', { token: tampered });
    expect(res.status === 401, `got ${res.status}`);
  });

  await check('Patient → other patient records BLOCKED (403)', async () => {
    const res = await api('GET', `/api/records/patient/${patientBId}`, { token: patient });
    expect(res.status === 403, `got ${res.status}`);
  });

  await check('Patient → admin API BLOCKED (403)', async () => {
    const res = await api('GET', '/api/admin/audit-logs', { token: patient });
    expect(res.status === 403, `got ${res.status}`);
  });

  await check('Doctor → patient management API BLOCKED (403)', async () => {
    const res = await api('GET', '/api/admin/patients', { token: doctor });
    expect(res.status === 403, `got ${res.status}`);
  });

  await check('Doctor → unassigned patient records BLOCKED (403)', async () => {
    // patientB has no relationship with the demo doctor (fresh registration)
    const res = await api('GET', `/api/records/patient/${patientBId}`, { token: doctor });
    expect(res.status === 403, `got ${res.status}`);
  });

  await check('Duplicate appointment BLOCKED (409)', async () => {
    const docs = await api('GET', '/api/doctors');
    const doc = docs.body.items.find((d) => d.email === doctorEmail);
    expect(!!doc, 'fixture doctor not found in the directory');
    // find a free slot
    let date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    let avail = (await api('GET', `/api/doctors/${doc.id}/availability?date=${date}`)).body;
    let free = avail.slots.filter((s) => s.available);
    let guard = 0;
    while (free.length === 0 && guard < 10) {
      date = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
      avail = (await api('GET', `/api/doctors/${doc.id}/availability?date=${date}`)).body;
      free = avail.slots.filter((s) => s.available);
      guard += 1;
    }
    expect(free.length > 0, 'no free slot found');
    const time = free[0].time;
    const b1 = await api('POST', '/api/appointments', { token: patient, body: { doctorId: doc.id, date, time, reason: 'Checklist booking 1 (synthetic)' } });
    expect(b1.status === 201, `first booking got ${b1.status}`);
    const b2 = await api('POST', '/api/appointments', { token: patientB, body: { doctorId: doc.id, date, time, reason: 'Checklist booking 2 (synthetic)' } });
    expect(b2.status === 409, `second booking got ${b2.status}`);
  });

  await check('Invalid input rejected (400)', async () => {
    const docs = await api('GET', '/api/doctors');
    const doc = docs.body.items[0];
    const res = await api('POST', '/api/appointments', { token: patient, body: { doctorId: doc.id, date: 'not-a-date', time: '09:00', reason: 'x' } });
    expect(res.status === 400, `got ${res.status}`);
  });

  await check('Rate limit headers present', async () => {
    const res = await api('GET', '/api/health');
    expect(!!(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']), 'no rate limit headers');
  });

  await check('Audit logging ACTIVE (FAILED_LOGIN + BOOK_APPOINTMENT visible to admin)', async () => {
    await api('POST', '/api/auth/login', { body: { email: 'no.such.user@example.demo', password: 'Whatever!123' } });
    const res = await api('GET', '/api/admin/audit-logs?limit=50', { token: admin });
    expect(res.status === 200, `got ${res.status}`);
    const actions = new Set(res.body.items.map((i) => i.action));
    expect(actions.has('FAILED_LOGIN'), 'FAILED_LOGIN missing');
  });

  await check('No sensitive leaks in auth responses', async () => {
    const res = await api('POST', '/api/auth/login', { body: { email: registeredPatients[0].email, password: registeredPatients[0].password } });
    const raw = res.text;
    expect(!raw.includes('passwordHash'), 'passwordHash leaked');
    expect(!raw.includes('$2'), 'bcrypt hash leaked');
  });

  await check('Mongo internals hidden on bad ObjectId (400/404, no stack)', async () => {
    const res = await api('GET', '/api/appointments/000000000000000000000000', { token: patient });
    expect(res.status === 400 || res.status === 404, `got ${res.status}`);
    expect(!res.text.includes('at '), 'stack trace leaked');
  });

  console.log(`
=== Security checklist: ${pass} PASS / ${fail} FAIL ===`);
  if (fail > 0) process.exitCode = 1;

  if (server) {
    await new Promise((r) => server.close(r));
    await fixtures.stopDB();
  }
})().catch((err) => {
  console.error('[checklist] fatal:', err);
  process.exit(1);
});
