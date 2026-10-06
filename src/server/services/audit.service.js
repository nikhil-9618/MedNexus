/**
 * Audit service — append-only trail. Failures never crash the request:
 * audit writes are fire-and-forget with error capture.
 */
const AuditLog = require('../models/AuditLog');

const MAX_DETAIL = 300;

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
  try {
    const seq = Math.floor(Date.now() / 1000) % 1000000;
    const logId = `LOG-${String(Date.now()).slice(-6)}${String(seq).slice(-2)}`;
    await AuditLog.create({
      logId,
      userId: p.userId || null,
      role: p.role || 'SYSTEM',
      action: p.action,
      resourceType: p.resourceType || 'AUTH',
      resourceId: p.resourceId ? String(p.resourceId).slice(0, 64) : null,
      timestamp: new Date(),
      ipAddress: (p.ipAddress || '').slice(0, 60) || null,
      result: p.result || 'SUCCESS',
      detail: (p.detail || '').slice(0, MAX_DETAIL),
    });
  } catch (err) {
    console.error('[audit] failed to write audit log:', err && err.message);
  }
}

/** Fire-and-forget helper for hot paths. */
function auditAsync(p) {
  writeAudit(p).catch(() => {});
}

module.exports = { writeAudit, auditAsync };
