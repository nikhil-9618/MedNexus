/**
 * MedNexus API entry point.
 * - Validates configuration (hard-fails in production on missing secrets)
 * - Connects MongoDB (or starts the in-memory dev fallback)
 * - Starts the HTTP server
 */
const { config, validateProductionConfig } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { buildApp } = require('./app');
const Department = require('./models/Department');

/**
 * Create the first administrator from ADMIN_EMAIL + ADMIN_PASSWORD, once.
 *
 * `npm run create-admin` is the documented way to do this, but the zero-setup
 * local database is locked to a single process, so the command cannot run while
 * the API holds it. Doing it here makes local setup work with no second process
 * and lets a hosted instance bootstrap without a shell.
 *
 * Strictly create-only: an existing ADMIN is never touched, so a password can
 * never be silently reset by a restart.
 */
async function bootstrapAdmin() {
  const { adminEmail } = config;
  const password = process.env.ADMIN_PASSWORD || '';
  if (!adminEmail || !password) return;

  const User = require('./models/User');
  const existingAdmin = await User.findOne({ role: 'ADMIN' });
  if (existingAdmin) return;

  if (password.length < 12) {
    console.warn('[security] ADMIN_PASSWORD is shorter than 12 characters — refusing to create the administrator.');
    return;
  }

  const { writeAudit } = require('./services/audit.service');
  await User.create({
    name: process.env.ADMIN_NAME || 'Clinic Administrator',
    email: adminEmail.toLowerCase(),
    passwordHash: await User.hashPassword(password, config.bcrypt.rounds),
    role: 'ADMIN',
    status: 'ACTIVE',
    emailVerified: true,
  });
  await writeAudit({
    role: 'SYSTEM',
    action: 'ADMIN_BOOTSTRAPPED',
    resourceType: 'AUTH',
    resourceId: adminEmail,
    result: 'SUCCESS',
    detail: 'First administrator created at boot from ADMIN_EMAIL/ADMIN_PASSWORD',
  });
  console.log(`[api] created the first administrator: ${adminEmail}`);
}

/**
 * First-run convenience: seed reference data (departments, settings) once.
 *
 * Development and test always do this. A hosted demo has no shell to run
 * `npm run seed` in, so it can opt in with SEED_ON_EMPTY=true.
 *
 * Emptiness is judged by a reference collection, never by User: no accounts are
 * seeded any more, so counting users would stay at zero forever and re-run the
 * seed on every single boot, wiping the departments it had just written.
 */
async function seedIfEmpty() {
  if (!config.isDev && !config.isTest && !config.seedOnEmpty) return;
  const departments = await Department.countDocuments({});
  if (departments === 0) {
    console.log('[api] empty database — seeding reference data…');
    const { main: seed } = require('./seed/seed');
    await seed(true); // keepAlive: reuse this connection
  }
}

/** Log which transport verification codes would use, and whether it works. */
function reportEmailTransport() {
  const emailService = require('./services/email.service');
  const transport = emailService.activeTransport();
  if (transport === 'none') {
    // Production has already warned loudly in validateProductionConfig(). In
    // development nothing used to be printed at all, which left "no code ever
    // arrives" with no explanation anywhere in the startup output.
    console.warn(
      '[email] NO TRANSPORT CONFIGURED (RESEND_API_KEY and SMTP_* are empty) — ' +
        'verification codes will not be emailed. ' +
        (config.otpEcho
          ? 'OTP_DEV_ECHO is on, so codes are returned to the client instead.'
          : config.isDev
            ? 'In development the code is printed below and returned to the client.'
            : 'Registration will report that no code could be delivered.')
    );
    return;
  }
  emailService.verifyTransport().then((result) => {
    if (result.ok) {
      console.log(`[email] verification codes will be sent via ${result.transport} (${result.reason})`);
    } else {
      console.error(
        `[email] ${result.transport} is configured but unusable: ${result.reason} — ` +
          "signup verification emails will not be delivered. Codes are still logged server-side."
      );
    }
  }).catch(() => { /* a diagnostic must never affect startup */ });
}

async function main() {
  const problems = validateProductionConfig();
  if (problems.length) {
    console.error('[config] refusing to start: ' + problems.join(' - '));
    process.exit(1);
  }

  await connectDB();
  await seedIfEmpty();
  await bootstrapAdmin();

  const app = buildApp();
  const server = app.listen(config.port, () => {
    console.log(`[api] MedNexus API running on http://localhost:${config.port} (${config.nodeEnv})`);
    // Report the mail path at boot: a bad credential should be visible here,
    // not discovered by the first patient who never receives a code.
    reportEmailTransport();
  });

  const shutdown = async (signal) => {
    console.log(`
[api] ${signal} received — shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[api] fatal startup error:', err && err.message);
    process.exit(1);
  });
}

module.exports = { main };
