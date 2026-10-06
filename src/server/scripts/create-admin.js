#!/usr/bin/env node
/**
 * Bootstrap the first administrator.
 *
 * No accounts are seeded any more (see seed/seed.js), so a fresh database has
 * nobody who can sign in. This is the one-time command that creates the account
 * you then use to provision doctors from the admin console.
 *
 * Usage (from src/server):
 *   npm run create-admin                              # generates a password
 *   npm run create-admin -- --email me@clinic.test --name "Dr. A Rao"
 *   ADMIN_EMAIL=me@clinic.test ADMIN_PASSWORD='...' npm run create-admin
 *   npm run create-admin -- --promote                 # promote an existing user
 *
 * The password is printed once, here and nowhere else. It is never stored in
 * plaintext, never written to a file, and never returned by any API.
 *
 * Flags:
 *   --email <address>     default: ADMIN_EMAIL, else prompted-for default
 *   --name  <full name>   default: ADMIN_NAME, else "Clinic Administrator"
 *   --password <value>    default: ADMIN_PASSWORD, else a strong one is generated
 *   --promote             allow promoting an existing non-admin account
 *   --quiet               print only the generated password (for scripting)
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const { connectDB, disconnectDB } = require('../config/db');
const { config } = require('../config/env');
const { writeAudit } = require('../services/audit.service');

const MIN_PASSWORD_LENGTH = 12;

/** Read `--flag value` from argv. */
function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  const inline = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  return fallback;
}

const hasFlag = (name) => process.argv.includes(`--${name}`);

/**
 * A strong, typeable password: three character classes plus symbols, drawn from
 * a CSPRNG (never Math.random), with no ambiguous glyphs such as O/0/I/l so it
 * can be read off a terminal and retyped.
 */
function generatePassword() {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+';
  const all = lower + upper + digits + symbols;
  const pick = (set) => set[crypto.randomInt(0, set.length)];

  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < 20) chars.push(pick(all));
  // Shuffle so the guaranteed classes are not always in the same positions.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** Reject a password the API's own policy would refuse. */
function validatePassword(password) {
  const problems = [];
  if (password.length < MIN_PASSWORD_LENGTH) problems.push(`${MIN_PASSWORD_LENGTH}+ characters`);
  if (!/[A-Z]/.test(password)) problems.push('an uppercase letter');
  if (!/[a-z]/.test(password)) problems.push('a lowercase letter');
  if (!/[0-9]/.test(password)) problems.push('a number');
  if (/^(password|mednexus|admin|changeme)/i.test(password)) problems.push('something less guessable');
  return problems;
}

async function main() {
  const email = String(arg('email', process.env.ADMIN_EMAIL || '')).trim().toLowerCase();
  const name = String(arg('name', process.env.ADMIN_NAME || 'Clinic Administrator')).trim();
  const quiet = hasFlag('quiet');

  if (!email) {
    console.error('An email address is required: --email <address> or ADMIN_EMAIL=<address>');
    process.exit(1);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error(`"${email}" is not a valid email address.`);
    process.exit(1);
  }

  try {
    await connectDB();
  } catch (err) {
    const message = String((err && err.message) || err);
    if (/DBPathInUse|lock file|already running/i.test(message)) {
      // The zero-setup local database is owned by whichever process started it,
      // so a second process cannot open the same files.
      console.error(
        '[create-admin] The API is already running against the local database, and that\n' +
          '  database can only be opened by one process at a time. Either:\n' +
          '    1. stop the API and re-run this command, or\n' +
          '    2. leave ADMIN_EMAIL and ADMIN_PASSWORD set in src/server/.env — the API\n' +
          '       creates the administrator itself during boot, or\n' +
          '    3. point MONGODB_URI at a standalone MongoDB that both can reach.'
      );
    } else {
      console.error(`[create-admin] could not reach the database: ${message}`);
    }
    process.exit(1);
  }

  const existing = await User.findOne({ email }).select('+passwordHash');
  const supplied = arg('password', process.env.ADMIN_PASSWORD || '');
  const generated = supplied ? '' : generatePassword();
  const password = supplied || generated;

  const problems = validatePassword(password);
  if (problems.length) {
    console.error(`That password needs ${problems.join(', ')}.`);
    await disconnectDB();
    process.exit(1);
  }

  const passwordHash = await User.hashPassword(password, config.bcrypt.rounds);
  let action = 'ADMIN_BOOTSTRAPPED';

  if (existing) {
    if (existing.role !== 'ADMIN' && !hasFlag('promote')) {
      console.error(
        `${email} already exists as ${existing.role}. Re-run with --promote to make it an administrator.`
      );
      await disconnectDB();
      process.exit(1);
    }
    // Idempotent: re-running resets the password, which is the recovery path
    // when the only administrator credential is lost.
    existing.passwordHash = passwordHash;
    existing.role = 'ADMIN';
    existing.status = 'ACTIVE';
    existing.emailVerified = true;
    existing.failedLoginAttempts = 0;
    existing.lockedUntil = null;
    if (existing.revokeTokens) existing.revokeTokens();
    await existing.save();
    action = 'ADMIN_PASSWORD_RESET_BY_OPERATOR';
  } else {
    await User.create({
      name,
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      // The operator running this command has already asserted the address.
      emailVerified: true,
    });
  }

  // Audited as a SYSTEM action so it is visible in the admin audit log.
  await writeAudit({
    role: 'SYSTEM',
    action,
    resourceType: 'AUTH',
    resourceId: email,
    result: 'SUCCESS',
    detail: `${existing ? 'Reset' : 'Created'} administrator account ${email} from the operator CLI`,
  });

  const user = await User.findOne({ email });
  if (!quiet) {
    console.log('\n────────────────────────────────────────────────────────');
    console.log(`  Administrator: ${user.email}`);
    if (generated) {
      console.log(`  Password:      ${generated}`);
      console.log('  (generated now — it is not stored anywhere in plain text)');
    } else {
      console.log('  Password:      the value you supplied');
    }
    console.log('────────────────────────────────────────────────────────');
    console.log('  Sign in at /login choosing the Admin portal.');
    console.log('  Create doctors under Admin → Manage Doctors.\n');
  } else if (generated) {
    console.log(generated);
  }

  await disconnectDB();
  await mongoose.connection.close().catch(() => {});
}

main().catch(async (err) => {
  console.error(`[create-admin] ${err && err.message ? err.message : err}`);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
