/**
 * MongoDB connection manager.
 * - If MONGODB_URI is set, connect to that instance (local or Atlas).
 * - If MONGODB_URI is empty, auto-start a local in-memory MongoDB via
 *   mongodb-memory-server (optional dependency) — zero-setup development.
 */
const mongoose = require('mongoose');
const { config } = require('../config/env');

let memoryServer = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (config.mongo.uri) {
    await mongoose.connect(config.mongo.uri, { dbName: config.mongo.dbName });
    console.log(`[db] Connected to MongoDB at ${config.mongo.uri}`);
    return mongoose.connection;
  }

  // ---- Zero-setup fallback: ephemeral in-memory MongoDB ----
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch {
    throw new Error(
      'MONGODB_URI is not set and mongodb-memory-server is not installed. ' +
        'Set MONGODB_URI (e.g. mongodb://127.0.0.1:27017/mednexus) or run: npm i mongodb-memory-server'
    );
  }
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri('mednexus');
  await mongoose.connect(uri);
  console.log('[db] Started ephemeral in-memory MongoDB (MONGODB_URI not set). Data resets on restart.');
  return mongoose.connection;
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDB, disconnectDB };
