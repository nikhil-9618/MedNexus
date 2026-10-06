/**
 * AuditLog model — append-only trail of security-relevant events.
 * Never stores passwords, tokens, or other secrets.
 */
const mongoose = require('mongoose');
const { AUDIT_ACTIONS, AUDIT_RESULTS, RESOURCE_TYPES } = require('../config/constants');

const auditLogSchema = new mongoose.Schema(
  {
    logId: { type: String, required: true, unique: true }, // e.g. "LOG-100231"
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    role: { type: String, enum: ['PATIENT', 'DOCTOR', 'ADMIN', 'SYSTEM'], default: 'SYSTEM', index: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, enum: RESOURCE_TYPES, default: 'AUTH' },
    resourceId: { type: String, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
    ipAddress: { type: String, default: null },
    result: { type: String, enum: AUDIT_RESULTS, default: 'SUCCESS' },
    detail: { type: String, maxlength: 300, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ role: 1, action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
