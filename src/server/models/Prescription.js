/**
 * Prescription model — prescriptions issued during a consultation.
 *
 * Each prescription has a unique RX id and contains one or more prescription
 * items (medicine, dosage, frequency, duration, instructions).
 *
 * Prescriptions are referenced from consultations and patient medical history.
 * Only authorized users may view them (patient whose record, the issuing doctor,
 * or admin).
 *
 * All prescription content here is synthetic/demo data for development.
 */
const mongoose = require('mongoose');

const prescriptionItemSchema = new mongoose.Schema(
  {
    medicine: { type: String, required: true, trim: true, maxlength: 120 },
    dosage: { type: String, required: true, trim: true, maxlength: 60 }, // e.g. '500 mg'
    frequency: { type: String, required: true, trim: true, maxlength: 80 }, // e.g. 'Twice daily after meals'
    duration: { type: String, required: true, trim: true, maxlength: 80 }, // e.g. '5 days'
    instructions: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: false }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionId: { type: String, required: true, unique: true }, // e.g. RX-20261005-0012
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    departmentCode: { type: String, required: true, trim: true, maxlength: 12 },
    status: {
      type: String,
      enum: Object.freeze(['Issued', 'Dispensed', 'Completed']),
      default: 'Issued',
      index: true,
    },
    items: { type: [prescriptionItemSchema], default: [], validate: { validator: function (arr) { return Array.isArray(arr) && arr.length > 0; }, message: 'A prescription must contain at least one medicine item' } },
    notes: { type: String, trim: true, maxlength: 400, default: '' },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dispensedAt: { type: Date, default: null },
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

prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
