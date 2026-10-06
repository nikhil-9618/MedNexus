/**
 * MedicalRecord model — synthetic consultation records.
 * Every diagnosis/prescription in seed data is clearly fictional.
 */
const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema(
  {
    recordId: { type: String, required: true, unique: true }, // e.g. "R1024"
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    diagnosis: { type: String, required: true, trim: true, maxlength: 200 },
    prescription: { type: String, trim: true, maxlength: 400, default: '' },
    notes: { type: String, trim: true, maxlength: 600, default: '' },
    category: {
      type: String,
      enum: ['history', 'lab', 'prescription', 'note'],
      default: 'history',
      index: true,
    },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

medicalRecordSchema.index({ patientId: 1, date: -1 });
medicalRecordSchema.index({ doctorId: 1, date: -1 });
medicalRecordSchema.index({ appointmentId: 1 });

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);
