/**
 * Queue model — each booked appointment gets exactly one queue entry.
 * Token is a clinic token code (e.g. CAR-024) shown to patients/admins.
 *
 * Department queues are ordered by (status priority, position). The
 * "now serving" token is the earliest Waiting/NowServing entry for that
 * department whose appointment is on/attached to today's flow.
 *
 * Every queue change is audited by the service layer.
 *
 * All data here is synthetic/demo for development.
 */
const mongoose = require('mongoose');

const queueStatusSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['Waiting', 'NowServing', 'InConsultation', 'Completed', 'Cancelled'],
    default: 'Waiting',
  },
  position: { type: Number, default: 0, min: 0 },
  tokenCode: { type: String, required: true, trim: true, maxlength: 20 },
  departmentCode: { type: String, required: true, trim: true, maxlength: 12 },
});

const queueSchema = new mongoose.Schema(
  {
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    queue: queueStatusSchema,
    arrivedAt: { type: Date, default: null },
    calledAt: { type: Date, default: null },
    consultationStartedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
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

queueSchema.index({ 'queue.departmentCode': 1, 'queue.status': 1, 'queue.position': 1 });
queueSchema.index({ 'queue.departmentCode': 1, 'queue.status': 1 });
queueSchema.index({ 'queue.departmentCode': 1, 'queue.position': 1 });

module.exports = mongoose.model('Queue', queueSchema);
