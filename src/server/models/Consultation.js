/**
 * Consultation model — the clinical consultation record.
 *
 * One consultation per active appointment consultation session. When a doctor
 * starts a consultation, the appointment moves to InConsultation and this
 * record is created. Completing the consultation records diagnosis, vitals,
 * notes, prescriptions, lab orders, follow-up and referral.
 *
 * Vitals are structured so they can be displayed in the consultation screen
 * and used by the 3D twin / admin dashboard.
 *
 * All medical content here is synthetic/demo data for development.
 */
const mongoose = require('mongoose');

const vitalsSchema = new mongoose.Schema(
  {
    bloodPressure: { type: String, trim: true, maxlength: 12, default: '' }, // e.g. '120/80'
    heartRate: { type: Number, min: 0, max: 300, default: null }, // bpm
    temperature: { type: Number, min: 30, max: 45, default: null }, // Celsius
    oxygenSaturation: { type: Number, min: 0, max: 100, default: null }, // SpO2 %
    respiratoryRate: { type: Number, min: 0, max: 60, default: null }, // breaths/min
    weight: { type: Number, min: 0, max: 400, default: null }, // kg
    height: { type: Number, min: 0, max: 250, default: null }, // cm
  },
  { _id: false }
);

const consultationSchema = new mongoose.Schema(
  {
    consultationId: { type: String, required: true, unique: true, index: true }, // e.g. CON-20261005-0012
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    departmentCode: { type: String, required: true, trim: true, maxlength: 12 },
    status: {
      type: String,
      enum: Object.freeze(['Pending', 'InProgress', 'Completed', 'Cancelled']),
      default: 'Pending',
      index: true,
    },
    // Chief complaint / reason the patient came in.
    chiefComplaint: { type: String, trim: true, maxlength: 300, default: '' },
    // Patient-reported symptoms.
    symptoms: { type: String, trim: true, maxlength: 600, default: '' },
    // Clinician observations (before diagnosis).
    observations: { type: String, trim: true, maxlength: 800, default: '' },
    // Working/final diagnosis.
    diagnosis: { type: String, trim: true, maxlength: 300, default: '' },
    // Vitals captured during consultation.
    vitals: { type: vitalsSchema, default: () => ({}) },
    // Free-text clinician notes.
    notes: { type: String, trim: true, maxlength: 1200, default: '' },
    // Prescriptions issued during this consultation (referenced by IDs).
    prescriptionIds: { type: [String], default: [] },
    // Lab orders issued during this consultation (referenced by IDs).
    labOrderIds: { type: [String], default: [] },
    // Recommended follow-up date.
    followUpDate: { type: String, trim: true, maxlength: 12, default: '' }, // \"YYYY-MM-DD\" or \"\"
    // Tests recommended for further investigation.
    recommendedTests: { type: String, trim: true, maxlength: 400, default: '' },
    // Referral to another department/specialist.
    referral: { type: String, trim: true, maxlength: 300, default: '' },
    // Who created/completed the consultation.
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
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

consultationSchema.index({ patientId: 1, createdAt: -1 });
consultationSchema.index({ doctorId: 1, createdAt: -1 });
consultationSchema.index({ appointmentId: 1 });
consultationSchema.index({ departmentCode: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Consultation', consultationSchema);
