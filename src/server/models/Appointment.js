/**
 * Appointment model.
 * date is an ISO "YYYY-MM-DD" string; time is 24h "HH:MM".
 * A compound unique partial index { doctorId, date, time } guarantees one
 * live booking per doctor per slot at the database level (anti double-booking).
 */
const mongoose = require('mongoose');
const { APPOINTMENT_STATUS } = require('../config/constants');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 300 },
    status: { type: String, enum: APPOINTMENT_STATUS, default: 'Scheduled', index: true },

    // Clinical workflow linkage — populated when the booking issues a queue token.
    departmentCode: { type: String, trim: true, maxlength: 12, default: null },
    token: { type: String, trim: true, maxlength: 20, default: null },
    queueId: { type: mongoose.Schema.Types.ObjectId, ref: 'Queue', default: null },
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', default: null },

    cancelledBy: {
      role: { type: String, enum: ['PATIENT', 'DOCTOR', 'ADMIN', null], default: null },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },

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

/** Anti double-booking: unique per doctor/slot for live appointments only. */
appointmentSchema.index(
  { doctorId: 1, date: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['Scheduled', 'Confirmed', 'InQueue', 'NowServing'] } },
  }
);

/** Common queries. */
appointmentSchema.index({ patientId: 1, date: -1 });
appointmentSchema.index({ doctorId: 1, date: -1 });
appointmentSchema.index({ status: 1, date: 1 });

// Appointment model
module.exports = mongoose.model('Appointment', appointmentSchema);
