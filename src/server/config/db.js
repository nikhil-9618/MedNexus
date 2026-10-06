/**
 * MongoDB connection manager.
 * - If MONGODB_URI is set, connect to that instance (local or Atlas).
 * - If MONGODB_URI is empty, auto-start a local MongoDB via
 *   mongodb-memory-server (optional dependency) — zero-setup development.
 *
 * The zero-setup instance is NOT ephemeral: it is backed by a real data
 * directory (src/server/.data/mongodb) so accounts and their pending OTPs
 * survive a server restart. A purely in-memory store silently erased every
 * registration on each restart, which made signup look broken — the code
 * shown for a pending account would no longer match anything on disk.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { config } = require('../config/env');

// Persistent store for the zero-setup instance (tests keep a throwaway one).
const DATA_DIR = path.resolve(__dirname, '..', '.data', 'mongodb');

let memoryServer = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (config.mongo.uri) {
    await mongoose.connect(config.mongo.uri, { dbName: config.mongo.dbName });
    console.log(`[db] Connected to MongoDB at ${config.mongo.uri}`);
    return mongoose.connection;
  }

  // ---- Zero-setup fallback: a local MongoDB owned by this process ----
  let MongoMemoryServer;
  try {
    ({ MongoMemoryServer } = require('mongodb-memory-server'));
  } catch {
    throw new Error(
      'MONGODB_URI is not set and mongodb-memory-server is not installed. ' +
        'Set MONGODB_URI (e.g. mongodb://127.0.0.1:27017/mednexus) or run: npm i mongodb-memory-server'
    );
  }

  // Tests get a throwaway store so runs never inherit each other's state.
  const persistent = !config.isTest;
  if (persistent) {
    // mongodb-memory-server will NOT create the directory; mongod fails with
    // ENOENT on scandir if it is missing.
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  memoryServer = await MongoMemoryServer.create(
    persistent
      ? { instance: { dbPath: DATA_DIR, storageEngine: 'wiredTiger' } }
      : undefined
  );
  const uri = memoryServer.getUri('mednexus');
  await mongoose.connect(uri);
  console.log(
    persistent
      ? `[db] Started a local MongoDB at ${DATA_DIR} (MONGODB_URI not set). Data is kept across restarts.`
      : '[db] Started an ephemeral in-memory MongoDB for tests.'
  );
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
