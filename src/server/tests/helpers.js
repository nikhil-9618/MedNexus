/**
 * Shared test helpers: ephemeral DB, fixture accounts + HTTP client.
 *
 * Nothing is seeded from the application seed any more (it writes reference
 * data only and creates no accounts), so this module bootstraps the accounts
 * the suite needs. Fixture doctors are created through the real admin service,
 * which keeps the fixtures honest: they exercise the same code path an operator
 * uses to provision a doctor.
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

// Fixture credentials. Deliberately not the old demo accounts: these exist only
// inside the test database and are never referenced by application code.
const TEST_ADMIN = Object.freeze({
  name: 'Test Administrator',
  email: 'admin@test.local',
  password: 'TestAdmin@12345',
});
const TEST_DOCTOR = Object.freeze({
  name: 'Dr. Test Doctor',
  email: 'doctor@test.local',
  password: 'TestDoctor@12345',
});

/** Start an ephemeral MongoDB, connect Mongoose, and write reference data. */
async function startDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('mednexus-test'));

  // Reference data (departments + settings). Creates no accounts.
  const { main: seed } = require('../seed/seed');
  await seed(true);

  await createTestAccounts();
  return mongod;
}

/**
 * Create the administrator and one fully-provisioned doctor.
 *
 * The doctor goes through the admin service, so it gets a real Doctor profile
 * with bookable availability — several tests depend on being able to book.
 */
async function createTestAccounts() {
  const User = require('../models/User');
  const { config } = require('../config/env');

  const adminHash = await User.hashPassword(TEST_ADMIN.password, config.bcrypt.rounds);
  const admin = await User.create({
    name: TEST_ADMIN.name,
    email: TEST_ADMIN.email,
    passwordHash: adminHash,
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerified: true,
  });

  const adminService = require('../services/admin.service');
  const availability = {};
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((day) => {
    availability[day] = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00'];
  });

  await adminService.createDoctor(
    {
      name: TEST_DOCTOR.name,
      email: TEST_DOCTOR.email,
      password: TEST_DOCTOR.password,
      specialization: 'General Physician',
      department: 'General Medicine',
      experience: 10,
      qualification: 'MD (General Medicine)',
      bio: 'Test fixture profile.',
      consultationFee: 50,
      availability,
    },
    { id: admin._id.toString(), role: 'ADMIN' },
    '127.0.0.1'
  );

  return { admin };
}

async function stopDB() {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

/** Build the app with a test-only secret for isolation. */
function buildTestApp() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-for-mednexus-unit-tests-0123456789abcdef';
  // env.js was required earlier (config module) — refresh its secret.
  const { config } = require('../config/env');
  config.jwt.secret = process.env.JWT_SECRET;
  const { buildApp } = require('../app');
  return buildApp();
}

module.exports = {
  startDB,
  stopDB,
  buildTestApp,
  createTestAccounts,
  TEST_ADMIN,
  TEST_DOCTOR,
};
