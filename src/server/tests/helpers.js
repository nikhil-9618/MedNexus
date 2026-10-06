/** Shared test helpers: ephemeral DB + HTTP client against the Express app. */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

/** Start an ephemeral MongoDB and connect Mongoose to it. */
async function startDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('mednexus-test'));
  // Seed synthetic demo data once so tests can use demo accounts.
  const User = require('../models/User');
  if ((await User.countDocuments({})) === 0) {
    const { main: seed } = require('../seed/seed');
    await seed(true);
  }
  return mongod;
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

module.exports = { startDB, stopDB, buildTestApp };
