/**
 * MedNexus reference-data seed.
 *
 * Creates configuration only:
 *   - Departments (the clinic directory)
 *   - Settings (booking rules, clinic name)
 *
 * NO ACCOUNTS ARE CREATED. There are no seeded logins of any kind.
 *
 * To get in for the first time, create the first administrator:
 *   npm run create-admin
 * Then sign in and provision doctors from Admin → Manage Doctors. Patients
 * self-register through the normal signup flow.
 *
 * This script never touches users or clinical collections, so running it is
 * safe on a live database — it cannot delete real accounts, appointments or
 * records.
 *
 * Run:  npm run seed  (from server/)
 */
const Department = require('../models/Department');
const Setting = require('../models/Setting');
const { connectDB, disconnectDB } = require('../config/db');
const { DEPARTMENTS } = require('./data');

/**
 * Clear and recreate only the reference/config collections.
 *
 * The ID counters are deliberately NOT cleared: they are monotonic, and
 * resetting them would hand a new patient a P#### code that an existing
 * patient already holds.
 */
async function reset() {
  await Promise.all([
    Department.deleteMany({}),
    Setting.deleteMany({}),
  ]);
}

async function main(keepAlive = false) {
  await connectDB();
  await reset();
  console.log('[seed] reference collections cleared');

  await Department.insertMany(DEPARTMENTS.map((d) => ({ ...d, isActive: true })));
  console.log(`[seed] ${DEPARTMENTS.length} departments`);

  await Setting.insertMany([
    { key: 'booking.cancellationCutOffHours', value: 2, label: 'Hours before appointment when cancellation closes' },
    { key: 'booking.maxUpcomingPerPatient', value: 5, label: 'Maximum upcoming appointments per patient' },
    { key: 'clinic.name', value: 'MedNexus Clinic', label: 'Clinic display name' },
    { key: 'assistant.enabled', value: true, label: 'Enable AI assistant' },
  ]);
  console.log('[seed] 4 settings');

  console.log('[seed] DONE — reference data only, no accounts created.');
  console.log('   Next: npm run create-admin   (creates the first administrator)');

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
