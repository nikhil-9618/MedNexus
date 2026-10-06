/**
 * MedNexus API entry point.
 * - Validates configuration (hard-fails in production on missing secrets)
 * - Connects MongoDB (or starts the in-memory dev fallback)
 * - Starts the HTTP server
 */
const { config, validateProductionConfig } = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { buildApp } = require('./app');
const User = require('./models/User');

/**
 * First-run convenience: seed synthetic demo data when the database is empty.
 *
 * Development and test always do this. A hosted demo has no shell to run
 * `npm run seed` in, so it can opt in with SEED_ON_EMPTY=true — the seed only
 * runs while the database is empty and only writes synthetic records.
 */
async function seedIfEmpty() {
  if (!config.isDev && !config.isTest && !config.seedOnEmpty) return;
  const count = await User.countDocuments({});
  if (count === 0) {
    console.log('[api] empty database — seeding synthetic demo data…');
    const { main: seed } = require('./seed/seed');
    await seed(true); // keepAlive: reuse this connection
    if (config.isProd) console.warn('[security] seeded demo accounts — synthetic data only, never real patients');
  }
}

/** Log which transport verification codes would use, and whether it works. */
function reportEmailTransport() {
  const emailService = require('./services/email.service');
  const transport = emailService.activeTransport();
  if (transport === 'none') return; // validateProductionConfig already warned
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
