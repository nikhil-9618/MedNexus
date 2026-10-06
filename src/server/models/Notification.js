/**
 * Notification model — patient-facing notifications.
 *
 * Used for queue call announcements, appointment reminders, lab-report-ready
 * and prescription-ready notices. Patients see only their own notifications;
 * doctors and admins may query by patient where authorized.
 *
 * All notification content here is synthetic/demo data for development.
 */
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    type: {
      type: String,
      enum: Object.freeze([
        'appointment_reminder',
        'queue_called',
        'consultation_started',
        'consultation_completed',
        'prescription_ready',
        'lab_report_ready',
        'lab_order_confirmed',
        'follow_up_reminder',
        'system',
      ]),
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 400 },
    // Reference identifiers for the related resource.
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    queueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue', default: null },
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', default: null },
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', default: null },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'LabOrder', default: null },
    tokenCode: { type: String, trim: true, maxlength: 20, default: '' },
    // Read/unread tracking.
    read: { type: Boolean, default: false, index: true },
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

notificationSchema.index({ patientId: 1, createdAt: -1 });
notificationSchema.index({ patientId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
