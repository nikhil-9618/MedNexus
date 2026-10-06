/**
 * Audit service — append-only trail. Failures never crash the request:
 * audit writes are fire-and-forget with error capture.
 */
const crypto = require('crypto');
const AuditLog = require('../models/AuditLog');

const MAX_DETAIL = 300;

/**
 * Build a human-readable, collision-resistant log id.
 *
 * The id used to be a truncated timestamp alone, so any two events written in
 * the same millisecond collided on the unique index and the second one was
 * lost — silently, because audit writes never throw into the request. Bunching
 * is normal (a seeded batch, or one request that emits several events), so the
 * id now carries 3 random bytes as well.
 */
function newLogId() {
  const stamp = String(Date.now()).slice(-6);
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `LOG-${stamp}-${rand}`;
}

/**
 * Record an audit event.
 * @param {object} p
 * @param {string} p.action - one of AUDIT_ACTIONS
 * @param {'PATIENT'|'DOCTOR'|'ADMIN'|'SYSTEM'} [p.role]
 * @param {string|null} [p.userId]
 * @param {string} [p.resourceType]
 * @param {string|null} [p.resourceId]
 * @param {'SUCCESS'|'DENIED'|'FAILED'} [p.result]
 * @param {string} [p.ipAddress]
 * @param {string} [p.detail] - short, secret-free description
 */
async function writeAudit(p) {
  const row = {
    userId: p.userId || null,
    role: p.role || 'SYSTEM',
    action: p.action,
    resourceType: p.resourceType || 'AUTH',
    resourceId: p.resourceId ? String(p.resourceId).slice(0, 64) : null,
    timestamp: new Date(),
    ipAddress: (p.ipAddress || '').slice(0, 60) || null,
    result: p.result || 'SUCCESS',
    detail: (p.detail || '').slice(0, MAX_DETAIL),
  };

  // One retry: a duplicate id must never cost us an audit event.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await AuditLog.create({ ...row, logId: newLogId() });
      return;
    } catch (err) {
      if (attempt === 1 || err?.code !== 11000) {
        console.error('[audit] failed to write audit log:', err && err.message);
        return;
      }
    }
  }
}

/** Fire-and-forget helper for hot paths. */
function auditAsync(p) {
  writeAudit(p).catch(() => {});
}

module.exports = { writeAudit, auditAsync };
