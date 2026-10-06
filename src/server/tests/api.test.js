/**
 * Security & functional test suite (node:test, zero extra deps).
 * Run: npm test  (inside server/)
 *
 * Covers: health, auth (valid/invalid/expired), RBAC isolation,
 * double-booking prevention, validation rejection, rate limiting,
 * audit logging, appointment lifecycle and record access control.
 *
 * IMPORTANT: every PASS below is executed against a live ephemeral
 * MongoDB; the security-checklist script re-runs these against a live
 * server and prints the PASS/FAIL table used in the README.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { startDB, stopDB, buildTestApp } = require('./helpers');

let app;
let server;
let base;

/** Minimal JSON fetch helper over the in-process server. */
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

async function registerAndLogin(email, password, role, extra = {}) {
  if (role === 'PATIENT') {
    const reg = await api('POST', '/api/auth/register', { body: { name: 'Test Patient', email, password, confirmPassword: password, phone: '+1-555-9999', dob: '1992-02-02', gender: 'Other', ...extra } });
    assert.equal(reg.status, 201, `register ${email} failed: ${reg.text}`);
    assert.equal(reg.body.otpRequired, true, 'patient registration must require email OTP');
    // The dev/test transport surfaces the code so the whole flow is testable
    // without an email provider. Production never returns it.
    assert.ok(reg.body.devOtp, 'test transport did not surface the OTP');
    const verified = await api('POST', '/api/auth/verify-otp', { body: { email, otp: reg.body.devOtp } });
    assert.equal(verified.status, 200, `otp verification ${email} failed: ${verified.text}`);
    return verified.body.token;
  }
  const res = await api('POST', '/api/auth/login', { body: { email, password, role } });
  assert.equal(res.status, 200, `login ${email} failed: ${res.text}`);
  return res.body.token;
}

before(async () => {
  await startDB();
  app = buildTestApp();
  server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await stopDB();
});

describe('health & security headers', () => {
  test('GET /api/health returns ok + service name', async () => {
    const res = await api('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'MedNexus API');
  });

  test('helmet security headers are present', async () => {
    const res = await api('GET', '/api/health');
    assert.ok(res.headers['x-content-type-options'] || res.headers['cross-origin-resource-policy'], 'no security headers');
    assert.ok(res.headers['x-frame-options'] || res.headers['content-security-policy'] || res.headers['cross-origin-opener-policy'], 'no framing/csp header');
  });
});

describe('authentication', () => {
  test('patient registration returns an OTP challenge, not a session', async () => {
    const reg = await api('POST', '/api/auth/register', {
      body: { name: 'Registration Tester', email: 'reg.test@example.demo', password: 'Str0ngPass!1', confirmPassword: 'Str0ngPass!1', phone: '+1-555-1234', dob: '1990-01-01', gender: 'Female' },
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.otpRequired, true);
    assert.equal(reg.body.token, undefined, 'no session may be issued before verification');
    assert.ok(reg.body.devOtp, 'test transport should surface the code');

    // Login is refused until the emailed code is confirmed.
    const blocked = await api('POST', '/api/auth/login', {
      body: { email: 'reg.test@example.demo', password: 'Str0ngPass!1', role: 'PATIENT' },
    });
    assert.equal(blocked.status, 403, 'an unverified email must not be able to sign in');

    // A wrong code is rejected with a non-enumerating 400.
    const wrongCode = reg.body.devOtp === '000000' ? '111111' : '000000';
    const wrong = await api('POST', '/api/auth/verify-otp', {
      body: { email: 'reg.test@example.demo', otp: wrongCode },
    });
    assert.equal(wrong.status, 400);

    // The real code verifies the account and issues a session.
    const ok = await api('POST', '/api/auth/verify-otp', {
      body: { email: 'reg.test@example.demo', otp: reg.body.devOtp },
    });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);
    assert.equal(ok.body.user.role, 'PATIENT');
    assert.equal(ok.body.user.passwordHash, undefined);
    assert.equal(ok.body.user.password, undefined);
  });

  test('duplicate email registration is rejected (409)', async () => {
    const res = await api('POST', '/api/auth/register', {
      body: { name: 'Dup Tester', email: 'reg.test@example.demo', password: 'Str0ngPass!1', confirmPassword: 'Str0ngPass!1', phone: '+1-555-1234', dob: '1990-01-01', gender: 'Female' },
    });
    assert.equal(res.status, 409);
  });

  test('invalid password (weak) is rejected (400)', async () => {
    const res = await api('POST', '/api/auth/register', {
      body: { name: 'Weak Tester', email: 'weak@example.demo', password: 'short', confirmPassword: 'short', phone: '+1-555-1234', dob: '1990-01-01', gender: 'Male' },
    });
    assert.equal(res.status, 400);
  });

  test('registration bot traps reject scripted signups (honeypot + fill time)', async () => {
    const fields = {
      name: 'Bot Filter',
      email: 'bot.trap@example.demo',
      password: 'Str0ngPass!9',
      confirmPassword: 'Str0ngPass!9',
      phone: '+1-555-1234',
      dob: '1990-01-01',
      gender: 'Male',
    };

    // 1. A hidden field that no human can reach or see.
    const honeypot = await api('POST', '/api/auth/register', {
      body: { ...fields, website: 'http://spam.example' },
    });
    assert.equal(honeypot.status, 400);
    assert.equal(honeypot.body.message, 'We could not process this registration. Please try again.');
    assert.equal(honeypot.body.devOtp, undefined, 'no OTP may ever be issued to a trapped submission');

    // 2. Submitted the instant the form rendered.
    const instant = await api('POST', '/api/auth/register', {
      body: { ...fields, email: 'bot.fast@example.demo', formStartedAt: Date.now() },
    });
    assert.equal(instant.status, 400);
    assert.equal(instant.body.devOtp, undefined);

    // 3. Nothing was written for either attempt: the address is still free and
    //    a plausible human payload still works.
    const human = await api('POST', '/api/auth/register', { body: fields });
    assert.equal(human.status, 201, `trapped submissions must not create accounts: ${human.text}`);
    assert.equal(human.body.otpRequired, true);

    // 4. Both rejections are still auditable by an administrator.
    const admin = await registerAndLogin(
      'admin@mednexus.demo',
      process.env.SEED_ADMIN_PASSWORD || 'Admin@MedNexus2026',
      'ADMIN'
    );
    const denied = await api('GET', '/api/admin/audit-logs?action=REGISTER&result=DENIED', { token: admin });
    assert.equal(denied.status, 200);
    assert.ok(denied.body.total >= 2, 'blocked registrations must leave an audit trail');
    const details = denied.body.items.map((r) => r.detail).join(' | ');
    assert.match(details, /Honeypot field was filled/);
    assert.match(details, /faster than a human/);
  });

  test('valid login works and role matches', async () => {
    const token = await registerAndLogin('login.test@example.demo', 'Str0ngPass!2', 'PATIENT');
    assert.ok(token.split('.').length === 3);
  });

  test('invalid password is rejected (401)', async () => {
    const res = await api('POST', '/api/auth/login', { body: { email: 'login.test@example.demo', password: 'WrongPass!1' } });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('expired JWT is rejected (401)', async () => {
    const jwt = require('jsonwebtoken');
    const { config } = require('../config/env');
    const expired = jwt.sign({ role: 'PATIENT', sub: '000000000000000000000000' }, config.jwt.secret, {
      expiresIn: '-10s', issuer: config.jwt.issuer, audience: config.jwt.audience,
    });
    const res = await api('GET', '/api/auth/me', { token: expired });
    assert.equal(res.status, 401);
  });

  test('missing token on protected route is rejected (401)', async () => {
    const res = await api('GET', '/api/appointments');
    assert.equal(res.status, 401);
  });

  test('role mismatch on login (patient using doctor portal) is denied (403)', async () => {
    const res = await api('POST', '/api/auth/login', { body: { email: 'login.test@example.demo', password: 'Str0ngPass!2', role: 'DOCTOR' } });
    assert.equal(res.status, 403);
  });
});

describe('RBAC & resource-level authorization', () => {
  let patientA;
  let patientB;
  let admin;

  before(async () => {
    patientA = await registerAndLogin('rbac.a@example.demo', 'Str0ngPass!3', 'PATIENT');
    patientB = await registerAndLogin('rbac.b@example.demo', 'Str0ngPass!4', 'PATIENT');
    admin = await registerAndLogin('admin@mednexus.demo', process.env.SEED_ADMIN_PASSWORD || 'Admin@MedNexus2026', 'ADMIN');
  });

  test('patient cannot read another patient\'s records (403)', async () => {
    const meA = await api('GET', '/api/patients/me', { token: patientA });
    const meB = await api('GET', '/api/patients/me', { token: patientB });
    const idA = meA.body.patient.id;
    const idB = meB.body.patient.id;

    const res = await api('GET', `/api/records/patient/${idB}`, { token: patientA });
    assert.equal(res.status, 403);
  });

  test('patient cannot reach admin APIs (403)', async () => {
    const res = await api('GET', '/api/admin/audit-logs', { token: patientA });
    assert.equal(res.status, 403);
  });

  test('patient cannot list all doctors\' patients or admin dashboards (403)', async () => {
    const res = await api('GET', '/api/admin/patients', { token: patientA });
    assert.equal(res.status, 403);
  });

  test('admin can read audit logs (200)', async () => {
    const res = await api('GET', '/api/admin/audit-logs', { token: admin });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
  });
});

describe('appointments', () => {
  let patientToken;
  let doctorToken;
  let doctorId;
  let appointmentId;
  let bookedDate;
  let bookedTime;

  before(async () => {
    patientToken = await registerAndLogin('appt.patient@example.demo', 'Str0ngPass!5', 'PATIENT');
    doctorToken = await registerAndLogin('doctor@mednexus.demo', process.env.SEED_DOCTOR_PASSWORD || 'Doctor@MedNexus2026', 'DOCTOR');
  });

  test('doctor directory is public and lists the demo doctor', async () => {
    const res = await api('GET', '/api/doctors');
    assert.equal(res.status, 200);
    const doc = res.body.items.find((d) => d.email === 'doctor@mednexus.demo');
    assert.ok(doc, 'demo doctor missing from directory');
    doctorId = doc.id;
  });

  test('availability endpoint returns slots with availability flags', async () => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const res = await api('GET', `/api/doctors/${doctorId}/availability?date=${tomorrow}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.slots));
    bookedDate = tomorrow;
  });

  test('patient books an appointment (201)', async () => {
    // Pick a day where the doctor works (Mon-Fri) to find a free slot.
    let date = bookedDate;
    let availability = await (await api('GET', `/api/doctors/${doctorId}/availability?date=${date}`)).body;
    let free = availability.slots.filter((s) => s.available);
    let guard = 0;
    while (free.length === 0 && guard < 10) {
      date = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
      availability = await (await api('GET', `/api/doctors/${doctorId}/availability?date=${date}`)).body;
      free = availability.slots.filter((s) => s.available);
      guard += 1;
    }
    assert.ok(free.length > 0, 'no free slots found in next 10 days');

    bookedTime = free[0].time;
    const res = await api('POST', '/api/appointments', {
      token: patientToken,
      body: { doctorId, date, time: bookedTime, reason: 'Testing booking flow (synthetic)' },
    });
    assert.equal(res.status, 201);
    appointmentId = res.body.appointment.id;
  });

  test('double booking the same slot is rejected (409)', async () => {
    const res = await api('POST', '/api/appointments', {
      token: patientToken,
      body: { doctorId, date: bookedDate, time: bookedTime, reason: 'Duplicate booking attempt (synthetic)' },
    });
    assert.equal(res.status, 409);
  });

  test('booking a non-working slot is rejected (400/409)', async () => {
    const res = await api('POST', '/api/appointments', {
      token: patientToken,
      body: { doctorId, date: bookedDate, time: '23:45', reason: 'Invalid slot attempt (synthetic)' },
    });
    // Zod rejects a non-clinic slot with 400; a clinic slot outside the doctor's
    // day is rejected with 409. Both mean "not bookable".
    assert.ok([400, 409].includes(res.status), `got ${res.status}`);
  });

  test('booking in the past is rejected (400)', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const res = await api('POST', '/api/appointments', {
      token: patientToken,
      body: { doctorId, date: yesterday, time: '09:00', reason: 'Past booking attempt (synthetic)' },
    });
    assert.equal(res.status, 400);
  });

  test('invalid reason (too short) is rejected (400)', async () => {
    const res = await api('POST', '/api/appointments', {
      token: patientToken,
      body: { doctorId, date: bookedDate, time: '11:30', reason: 'hi' },
    });
    assert.equal(res.status, 400);
  });

  test('invalid doctor id is rejected (400)', async () => {
    const res = await api('POST', '/api/appointments', {
      token: patientToken,
      body: { doctorId: 'not-an-id', date: bookedDate, time: '11:30', reason: 'Bad doctor id (synthetic)' },
    });
    assert.equal(res.status, 400);
  });

  test('doctor cannot book appointments (403)', async () => {
    const res = await api('POST', '/api/appointments', {
      token: doctorToken,
      body: { doctorId, date: bookedDate, time: '16:00', reason: 'Doctor booking attempt (synthetic)' },
    });
    assert.equal(res.status, 403);
  });

  test('patient confirms own appointment; doctor cannot book but can view', async () => {
    const view = await api('GET', `/api/appointments/${appointmentId}`, { token: patientToken });
    assert.equal(view.status, 200);

    const docView = await api('GET', `/api/appointments/${appointmentId}`, { token: doctorToken });
    assert.equal(docView.status, 200, 'assigned doctor should see the appointment');
  });

  test('invalid state transition Completed -> Scheduled is rejected (403/409)', async () => {
    await api('PUT', `/api/appointments/${appointmentId}`, { token: doctorToken, body: { status: 'Confirmed' } });
    await api('PUT', `/api/appointments/${appointmentId}`, { token: doctorToken, body: { status: 'Completed' } });
    // Doctors may only Confirm/Complete/Cancel, so "Scheduled" is 403 (role rule);
    // the transition rule itself returns 409 for admins. Either is a hard block.
    const res = await api('PUT', `/api/appointments/${appointmentId}`, { token: doctorToken, body: { status: 'Scheduled' } });
    assert.ok([403, 409].includes(res.status), `got ${res.status}`);
  });

  test('cancelled appointment cannot be completed (403/409)', async () => {
    // Find a genuinely free slot instead of assuming one.
    let date = bookedDate;
    let avail = (await api('GET', `/api/doctors/${doctorId}/availability?date=${date}`)).body;
    let free = avail.slots.filter((s) => s.available);
    let guard = 0;
    while (free.length === 0 && guard < 10) {
      date = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10);
      avail = (await api('GET', `/api/doctors/${doctorId}/availability?date=${date}`)).body;
      free = avail.slots.filter((s) => s.available);
      guard += 1;
    }
    const book = await api('POST', '/api/appointments', {
      token: patientToken,
      body: { doctorId, date, time: free[0].time, reason: 'Cancel flow test (synthetic)' },
    });
    const id = book.body?.appointment?.id;
    assert.ok(id, 'booking for cancel-flow failed');
    await api('DELETE', `/api/appointments/${id}`, { token: patientToken });
    const res = await api('PUT', `/api/appointments/${id}`, { token: doctorToken, body: { status: 'Completed' } });
    assert.ok([403, 409].includes(res.status), `got ${res.status}`);
  });
});

describe('medical records access control', () => {
  let patientToken;
  let doctorToken;
  let otherPatientToken;

  before(async () => {
    patientToken = await registerAndLogin('rec.patient@example.demo', 'Str0ngPass!6', 'PATIENT');
    otherPatientToken = await registerAndLogin('rec.other@example.demo', 'Str0ngPass!7', 'PATIENT');
    doctorToken = await registerAndLogin('doctor@mednexus.demo', process.env.SEED_DOCTOR_PASSWORD || 'Doctor@MedNexus2026', 'DOCTOR');
  });

  test('patient with no relationship cannot view another patient\'s records (403)', async () => {
    const me = await api('GET', '/api/patients/me', { token: patientToken });
    const other = await api('GET', '/api/patients/me', { token: otherPatientToken });
    const res = await api('GET', `/api/records/patient/${other.body.patient.id}`, { token: patientToken });
    assert.equal(res.status, 403);
  });

  test('patient cannot create records (403)', async () => {
    const me = await api('GET', '/api/patients/me', { token: patientToken });
    const res = await api('POST', '/api/records', {
      token: patientToken,
      body: { appointmentId: '000000000000000000000000', diagnosis: 'Fake diagnosis' },
    });
    assert.equal(res.status, 403);
  });
});

describe('rate limiting & audit', () => {
  test('audit log records security events', async () => {
    const admin = await registerAndLogin('admin@mednexus.demo', process.env.SEED_ADMIN_PASSWORD || 'Admin@MedNexus2026', 'ADMIN');
    // Trigger a FAILED_LOGIN
    await api('POST', '/api/auth/login', { body: { email: 'audit.test@example.demo', password: 'Nope!1234' } });
    const res = await api('GET', '/api/admin/audit-logs?action=FAILED_LOGIN', { token: admin });
    assert.equal(res.status, 200);
    assert.ok(res.body.items.length >= 1, 'expected at least one FAILED_LOGIN audit entry');
  });
});
describe('session revocation & brute-force lockout', () => {
  test('account locks after repeated failures and the lockout is auditable', async () => {
    const email = 'lockout.check@example.demo';
    const password = 'Str0ngPass!9';
    await registerAndLogin(email, password, 'PATIENT');

    // Five wrong passwords trip the lock on the fifth attempt, and each one
    // still looks like an ordinary failure to the caller.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const res = await api('POST', '/api/auth/login', {
        body: { email, password: 'WrongPass!9', role: 'PATIENT' },
      });
      assert.equal(res.status, 401, `attempt ${attempt} must be a generic 401`);
    }

    // The sixth attempt is refused before the password is compared, so even the
    // correct password cannot get in while the lock is active.
    const locked = await api('POST', '/api/auth/login', {
      body: { email, password, role: 'PATIENT' },
    });
    assert.equal(locked.status, 429, 'a locked account must refuse even the correct password');

    // An administrator can see why, which is the point of the audit trail.
    const admin = await registerAndLogin(
      'admin@mednexus.demo',
      process.env.SEED_ADMIN_PASSWORD || 'Admin@MedNexus2026',
      'ADMIN'
    );
    const audit = await api('GET', '/api/admin/audit-logs?action=SECURITY_EVENT&result=DENIED', { token: admin });
    assert.equal(audit.status, 200);
    assert.match(
      audit.body.items.map((r) => r.detail).join(' | '),
      /Account locked after 5 failed sign-in attempts/
    );
  });

  test('logout-all and a password change revoke previously issued tokens', async () => {
    const email = 'revoke.check@example.demo';
    const password = 'Str0ngPass!9';
    const token = await registerAndLogin(email, password, 'PATIENT');

    assert.equal((await api('GET', '/api/auth/me', { token })).status, 200);

    const revoke = await api('POST', '/api/auth/logout-all', { token });
    assert.equal(revoke.status, 200);

    // The signature and expiry are both still valid — only the account's
    // generation changed — so this is the revocation being exercised.
    assert.equal(
      (await api('GET', '/api/auth/me', { token })).status,
      401,
      'a revoked token must stop working'
    );

    const fresh = await api('POST', '/api/auth/login', { body: { email, password, role: 'PATIENT' } });
    assert.equal(fresh.status, 200);

    const changed = await api('POST', '/api/auth/change-password', {
      token: fresh.body.token,
      body: { currentPassword: password, newPassword: 'Even5tronger!9', confirmPassword: 'Even5tronger!9' },
    });
    assert.equal(changed.status, 200);
    assert.ok(changed.body.token, 'the device that changed the password stays signed in');

    assert.equal(
      (await api('GET', '/api/auth/me', { token: fresh.body.token })).status,
      401,
      'the pre-change token must be dead'
    );
    assert.equal(
      (await api('GET', '/api/auth/me', { token: changed.body.token })).status,
      200,
      'the replacement token must work'
    );
  });
});
